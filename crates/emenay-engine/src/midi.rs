//! Shared MIDI→CV voice bus + optional `midir` input host.
//!
//! Audio thread reads lock-free channel state; the MIDI callback updates it.

use parking_lot::Mutex;
use std::sync::atomic::{AtomicU16, AtomicU32, AtomicU8, Ordering};
use std::sync::{Arc, OnceLock};
use thiserror::Error;

/// Eurorack 1V/oct zero: MIDI note 60 (C4) → 0 V.
pub const MIDI_NOTE_ZERO_V: i32 = 60;
/// Pitch-bend center (14-bit).
const BEND_CENTER: u16 = 8192;
const CHANNELS: usize = 16;
const STACK_CAP: usize = 8;

#[derive(Debug, Error)]
pub enum MidiError {
    #[error("no MIDI input device")]
    NoDevice,
    #[error("MIDI device not found: {0}")]
    DeviceNotFound(String),
    #[error("MIDI init failed: {0}")]
    Init(String),
    #[error("MIDI connect failed: {0}")]
    Connect(String),
}

#[derive(Clone, Debug)]
pub struct MidiDeviceInfo {
    pub name: String,
}

/// Monophonic last-note stack for one MIDI channel (MIDI-thread only).
#[derive(Clone, Copy, Default)]
struct NoteStack {
    notes: [u8; STACK_CAP],
    len: u8,
}

impl NoteStack {
    fn push(&mut self, note: u8) {
        // Drop duplicate if already held, then append (last = top).
        self.remove(note);
        if (self.len as usize) >= STACK_CAP {
            // Shift oldest out.
            self.notes.copy_within(1..STACK_CAP, 0);
            self.len = (STACK_CAP - 1) as u8;
        }
        self.notes[self.len as usize] = note;
        self.len += 1;
    }

    fn remove(&mut self, note: u8) {
        let mut w = 0u8;
        for r in 0..self.len {
            let n = self.notes[r as usize];
            if n != note {
                self.notes[w as usize] = n;
                w += 1;
            }
        }
        self.len = w;
    }

    fn clear(&mut self) {
        self.len = 0;
    }

    fn top(&self) -> Option<u8> {
        if self.len == 0 {
            None
        } else {
            Some(self.notes[(self.len - 1) as usize])
        }
    }
}

/// Packed voice: note (low 8), velocity (bits 8–14), gate (bit 15).
#[derive(Default)]
struct ChannelLive {
    packed: AtomicU16,
}

impl ChannelLive {
    fn store(&self, note: u8, velocity: u8, gate: bool) {
        let vel = (velocity & 0x7f) as u16;
        let g = if gate { 1u16 << 15 } else { 0 };
        self.packed
            .store((note as u16) | (vel << 8) | g, Ordering::Release);
    }

    fn load(&self) -> (u8, u8, bool) {
        let p = self.packed.load(Ordering::Acquire);
        let note = (p & 0xff) as u8;
        let vel = ((p >> 8) & 0x7f) as u8;
        let gate = (p & (1 << 15)) != 0;
        (note, vel, gate)
    }

    fn clear_gate(&self) {
        let (note, _, _) = self.load();
        self.store(note, 0, false);
    }
}

/// Process-wide MIDI voice state shared by hosts and MidiCv modules.
pub struct MidiBus {
    channels: [ChannelLive; CHANNELS],
    /// Omni voice: last-note priority across every MIDI channel (for cv1/gate1).
    omni: ChannelLive,
    stacks: Mutex<[NoteStack; CHANNELS]>,
    omni_stack: Mutex<NoteStack>,
    /// 14-bit pitch bend (0…16383, center 8192) — last message wins (omni).
    pitch_bend: AtomicU16,
    /// CC1 mod wheel 0…127 — last message wins (omni).
    mod_wheel: AtomicU8,
    /// Decaying activity counter for panel LED (MIDI thread bumps; audio decays).
    activity: AtomicU32,
}

impl MidiBus {
    pub fn new() -> Self {
        // Idle at C4 (0 V) so unplayed voices don't yank v/oct to −5 V.
        let idle = ChannelLive::default();
        idle.store(MIDI_NOTE_ZERO_V as u8, 0, false);
        let omni = ChannelLive::default();
        omni.store(MIDI_NOTE_ZERO_V as u8, 0, false);
        Self {
            channels: std::array::from_fn(|_| {
                let c = ChannelLive::default();
                c.store(MIDI_NOTE_ZERO_V as u8, 0, false);
                c
            }),
            omni,
            stacks: Mutex::new([NoteStack::default(); CHANNELS]),
            omni_stack: Mutex::new(NoteStack::default()),
            pitch_bend: AtomicU16::new(BEND_CENTER),
            mod_wheel: AtomicU8::new(0),
            activity: AtomicU32::new(0),
        }
    }

    pub fn handle_message(&self, message: &[u8]) {
        if message.is_empty() {
            return;
        }
        self.activity.store(48_000 / 8, Ordering::Relaxed); // ~125 ms @ 48 kHz

        let status = message[0];
        // Ignore real-time / sys-common that aren't note/CC/bend.
        if status == 0xf8 || status == 0xfa || status == 0xfb || status == 0xfc {
            return;
        }
        let hi = status & 0xf0;
        let ch = (status & 0x0f) as usize;

        match hi {
            0x90 => {
                // Note on (vel 0 = note off)
                if message.len() < 3 {
                    return;
                }
                let note = message[1] & 0x7f;
                let vel = message[2] & 0x7f;
                if vel == 0 {
                    self.note_off(ch, note);
                } else {
                    self.note_on(ch, note, vel);
                }
            }
            0x80 => {
                if message.len() < 2 {
                    return;
                }
                self.note_off(ch, message[1] & 0x7f);
            }
            0xb0 => {
                if message.len() < 3 {
                    return;
                }
                let cc = message[1] & 0x7f;
                let val = message[2] & 0x7f;
                if cc == 1 {
                    // Mod wheel
                    self.mod_wheel.store(val, Ordering::Release);
                } else if cc == 120 || cc == 123 || (cc == 121 && val == 0) {
                    self.all_notes_off(Some(ch));
                }
            }
            0xe0 => {
                // Pitch bend: LSB, MSB → 14-bit
                if message.len() < 3 {
                    return;
                }
                let lsb = (message[1] & 0x7f) as u16;
                let msb = (message[2] & 0x7f) as u16;
                self.pitch_bend
                    .store(lsb | (msb << 7), Ordering::Release);
            }
            0xff => self.all_notes_off(None),
            _ => {}
        }
    }

    fn note_on(&self, ch: usize, note: u8, vel: u8) {
        if ch >= CHANNELS {
            return;
        }
        {
            let mut stacks = self.stacks.lock();
            stacks[ch].push(note);
            self.channels[ch].store(note, vel, true);
        }
        // Omni stack: any channel drives the shared voice (MIDI keys presets).
        let mut omni = self.omni_stack.lock();
        omni.push(note);
        self.omni.store(note, vel, true);
    }

    fn note_off(&self, ch: usize, note: u8) {
        if ch >= CHANNELS {
            return;
        }
        {
            let mut stacks = self.stacks.lock();
            stacks[ch].remove(note);
            if let Some(top) = stacks[ch].top() {
                let (_, vel, _) = self.channels[ch].load();
                self.channels[ch].store(top, vel.max(1), true);
            } else {
                self.channels[ch].clear_gate();
            }
        }
        let mut omni = self.omni_stack.lock();
        omni.remove(note);
        if let Some(top) = omni.top() {
            let (_, vel, _) = self.omni.load();
            self.omni.store(top, vel.max(1), true);
        } else {
            self.omni.clear_gate();
        }
    }

    pub fn all_notes_off(&self, only_ch: Option<usize>) {
        let mut stacks = self.stacks.lock();
        match only_ch {
            Some(ch) if ch < CHANNELS => {
                stacks[ch].clear();
                self.channels[ch].clear_gate();
            }
            _ => {
                for ch in 0..CHANNELS {
                    stacks[ch].clear();
                    self.channels[ch].clear_gate();
                }
            }
        }
        // Omni always clears on any all-notes-off (including per-channel CC).
        drop(stacks);
        self.omni_stack.lock().clear();
        self.omni.clear_gate();
        self.pitch_bend.store(BEND_CENTER, Ordering::Release);
        // Leave mod wheel as-is (expression often stays).
    }

    fn voice_from(live: &ChannelLive) -> (f32, f32, f32) {
        let (note, vel, gate) = live.load();
        let cv = (note as i32 - MIDI_NOTE_ZERO_V) as f32 / 12.0;
        let gate_v = if gate { 5.0 } else { 0.0 };
        let velocity = if gate { vel as f32 / 127.0 } else { 0.0 };
        (cv, gate_v, velocity)
    }

    /// Pitch-bend as volts at 1V/oct for `range_semis` (±). Center = 0 V.
    pub fn pitch_bend_volts(&self, range_semis: f32) -> f32 {
        let raw = self.pitch_bend.load(Ordering::Acquire) as f32;
        let norm = (raw - BEND_CENTER as f32) / BEND_CENTER as f32; // −1…+1
        norm * (range_semis.clamp(0.0, 24.0) / 12.0)
    }

    /// Mod wheel (CC1) as 0…5 V.
    pub fn mod_wheel_volts(&self) -> f32 {
        self.mod_wheel.load(Ordering::Acquire) as f32 / 127.0 * 5.0
    }

    /// Pitch CV (1V/oct), gate (0/5 V), velocity 0…1 for MIDI channel `ch` (0-based).
    /// Pitch holds the last note while the gate is low (standard MIDI→CV).
    pub fn voice(&self, ch: usize) -> (f32, f32, f32) {
        if ch >= CHANNELS {
            return (0.0, 0.0, 0.0);
        }
        Self::voice_from(&self.channels[ch])
    }

    /// Omni voice: responds to notes on **any** MIDI channel.
    pub fn omni_voice(&self) -> (f32, f32, f32) {
        Self::voice_from(&self.omni)
    }

    pub fn omni_gate_led(&self) -> f32 {
        let (_, _, gate) = self.omni.load();
        if gate {
            1.0
        } else {
            0.05
        }
    }

    /// Sample activity LED brightness; decays toward 0 when called each audio sample.
    pub fn activity_led(&self, sample_rate: f32) -> f32 {
        let cur = self.activity.load(Ordering::Relaxed);
        if cur > 0 {
            let step = (sample_rate / 48_000.0).max(0.25) as u32;
            let next = cur.saturating_sub(step.max(1));
            self.activity.store(next, Ordering::Relaxed);
            1.0
        } else {
            0.06
        }
    }

    pub fn gate_led(&self, ch: usize) -> f32 {
        if ch >= CHANNELS {
            return 0.0;
        }
        let (_, _, gate) = self.channels[ch].load();
        if gate {
            1.0
        } else {
            0.05
        }
    }
}

impl Default for MidiBus {
    fn default() -> Self {
        Self::new()
    }
}

static MIDI_BUS: OnceLock<Arc<MidiBus>> = OnceLock::new();

/// Global bus used by MidiCv modules and the desktop MIDI host.
pub fn global_midi_bus() -> Arc<MidiBus> {
    MIDI_BUS
        .get_or_init(|| Arc::new(MidiBus::new()))
        .clone()
}

/// MIDI input host (USB class-compliant devices + interfaces via OS MIDI).
pub struct MidiHost {
    _connection: midir::MidiInputConnection<()>,
    pub info: MidiDeviceInfo,
}

impl MidiHost {
    pub fn list_devices() -> Result<Vec<MidiDeviceInfo>, MidiError> {
        let midi_in =
            midir::MidiInput::new("emenay midi scan").map_err(|e| MidiError::Init(e.to_string()))?;
        Ok(midi_in
            .ports()
            .iter()
            .filter_map(|p| {
                midi_in
                    .port_name(p)
                    .ok()
                    .map(|name| MidiDeviceInfo { name })
            })
            .collect())
    }

    pub fn start(device_name: Option<String>, bus: Arc<MidiBus>) -> Result<Self, MidiError> {
        let midi_in =
            midir::MidiInput::new("emenay midi").map_err(|e| MidiError::Init(e.to_string()))?;
        let ports = midi_in.ports();
        if ports.is_empty() {
            return Err(MidiError::NoDevice);
        }

        let port = if let Some(want) = device_name.as_ref() {
            ports
                .iter()
                .find(|p| midi_in.port_name(p).ok().as_ref() == Some(want))
                .ok_or_else(|| MidiError::DeviceNotFound(want.clone()))?
        } else {
            &ports[0]
        };

        let name = midi_in
            .port_name(port)
            .unwrap_or_else(|_| "MIDI".into());

        let connection = midi_in
            .connect(
                port,
                "emenay-in",
                move |_stamp, message, _| {
                    bus.handle_message(message);
                },
                (),
            )
            .map_err(|e| MidiError::Connect(e.to_string()))?;

        Ok(Self {
            _connection: connection,
            info: MidiDeviceInfo { name },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn note_on_off_last_priority() {
        let bus = MidiBus::new();
        bus.handle_message(&[0x90, 60, 100]); // ch1 C4
        let (cv, gate, _) = bus.voice(0);
        assert!((cv - 0.0).abs() < 1e-5);
        assert!((gate - 5.0).abs() < 1e-5);

        bus.handle_message(&[0x90, 72, 80]); // C5 on top
        let (cv, gate, _) = bus.voice(0);
        assert!((cv - 1.0).abs() < 1e-5);
        assert!(gate > 0.0);

        bus.handle_message(&[0x80, 72, 0]); // release C5 → back to C4
        let (cv, gate, _) = bus.voice(0);
        assert!((cv - 0.0).abs() < 1e-5);
        assert!(gate > 0.0);

        bus.handle_message(&[0x80, 60, 0]);
        let (cv, gate, _) = bus.voice(0);
        assert!((cv - 0.0).abs() < 1e-5); // pitch holds
        assert_eq!(gate, 0.0);
    }

    #[test]
    fn eight_channels_independent() {
        let bus = MidiBus::new();
        for ch in 0u8..8 {
            bus.handle_message(&[0x90 | ch, 60 + ch, 100]);
        }
        for ch in 0..8 {
            let (cv, gate, _) = bus.voice(ch);
            assert!((cv - (ch as f32) / 12.0).abs() < 1e-5);
            assert!(gate > 0.0);
        }
    }

    #[test]
    fn omni_follows_any_channel() {
        let bus = MidiBus::new();
        bus.handle_message(&[0x93, 72, 100]); // ch4 C5
        let (cv, gate, _) = bus.omni_voice();
        assert!((cv - 1.0).abs() < 1e-5);
        assert!(gate > 0.0);
        bus.handle_message(&[0x83, 72, 0]);
        let (_, gate, _) = bus.omni_voice();
        assert_eq!(gate, 0.0);
    }

    #[test]
    fn pitch_bend_and_mod_wheel() {
        let bus = MidiBus::new();
        // Full up bend (MSB=127, LSB=127) → +range
        bus.handle_message(&[0xe0, 0x7f, 0x7f]);
        let v = bus.pitch_bend_volts(12.0);
        assert!((v - 1.0).abs() < 0.02, "bend volts {v}");
        // Center
        bus.handle_message(&[0xe0, 0x00, 0x40]);
        assert!(bus.pitch_bend_volts(12.0).abs() < 0.02);
        // Mod wheel full
        bus.handle_message(&[0xb0, 0x01, 0x7f]);
        assert!((bus.mod_wheel_volts() - 5.0).abs() < 0.05);
    }
}
