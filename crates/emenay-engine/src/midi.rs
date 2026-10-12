//! Shared MIDI→CV voice bus + optional `midir` input host.
//!
//! Audio thread reads lock-free channel state; the MIDI callback updates it.

use parking_lot::Mutex;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicU32, AtomicU8, Ordering};
use std::sync::{Arc, OnceLock};
use thiserror::Error;

/// Eurorack 1V/oct zero: MIDI note 60 (C4) → 0 V.
pub const MIDI_NOTE_ZERO_V: i32 = 60;
/// Pitch-bend center (14-bit).
const BEND_CENTER: u16 = 8192;
const CHANNELS: usize = 16;
const STACK_CAP: usize = 8;
/// Polyphonic voice pool (chords on one MIDI channel).
pub const POLY_VOICES: usize = 8;

/// UI / transport actions enqueued from the MIDI thread.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum MidiAppAction {
    Start = 0,
    Stop = 1,
    Rest = 2,
    PresetPrev = 3,
    PresetNext = 4,
    PresetSave = 5,
    Panic = 6,
}

/// CC or note binding for an app action (`None` = unbound / stolen by Learn).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MidiBinding {
    None,
    Cc(u8),
    Note(u8),
}

/// Default Oxygen Preset-mode style bindings (overridable via Learn).
#[derive(Clone, Debug)]
pub struct MidiActionBindings {
    pub start: MidiBinding,
    pub stop: MidiBinding,
    pub rest: MidiBinding,
    pub preset_prev: MidiBinding,
    pub preset_next: MidiBinding,
    pub preset_save: MidiBinding,
    pub panic: MidiBinding,
}

impl Default for MidiActionBindings {
    fn default() -> Self {
        Self {
            start: MidiBinding::Cc(115),
            stop: MidiBinding::Cc(116),
            rest: MidiBinding::Cc(117),
            preset_prev: MidiBinding::Cc(110),
            preset_next: MidiBinding::Cc(111),
            preset_save: MidiBinding::Cc(112),
            panic: MidiBinding::Cc(118),
        }
    }
}

/// Captured event while MIDI Learn is armed.
#[derive(Clone, Copy, Debug)]
pub struct MidiLearnEvent {
    pub is_cc: bool,
    pub number: u8,
    pub value: u8,
}

/// CC → module param learn entry (`module_id` is Engine ModuleId.0).
#[derive(Clone, Debug)]
pub struct MidiParamLearn {
    pub cc: u8,
    pub module_id: u64,
    pub param: String,
}

/// Pending param write for the UI / engine to apply.
#[derive(Clone, Debug)]
pub struct MidiParamSet {
    pub module_id: u64,
    pub param: String,
    pub value: f32,
}

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

/// Voice allocator state (MIDI thread only).
#[derive(Clone, Copy)]
struct PolyAlloc {
    /// Note held on each voice (`None` = free).
    notes: [Option<u8>; POLY_VOICES],
    /// Assignment age — lower = older (steal candidate).
    age: [u32; POLY_VOICES],
    clock: u32,
}

impl Default for PolyAlloc {
    fn default() -> Self {
        Self {
            notes: [None; POLY_VOICES],
            age: [0; POLY_VOICES],
            clock: 1,
        }
    }
}

/// Process-wide MIDI voice state shared by hosts and MidiCv modules.
pub struct MidiBus {
    channels: [ChannelLive; CHANNELS],
    /// Omni voice: last-note priority across every MIDI channel (for cv1/gate1).
    omni: ChannelLive,
    /// Polyphonic voices for chord playing (independent of channel mono stacks).
    poly: [ChannelLive; POLY_VOICES],
    stacks: Mutex<[NoteStack; CHANNELS]>,
    omni_stack: Mutex<NoteStack>,
    poly_alloc: Mutex<PolyAlloc>,
    /// How many poly slots are active for allocate/steal (1…8).
    poly_count: AtomicU8,
    /// 14-bit pitch bend (0…16383, center 8192) — last message wins (omni).
    pitch_bend: AtomicU16,
    /// CC1 mod wheel 0…127 — last message wins (omni).
    mod_wheel: AtomicU8,
    /// Channel aftertouch 0…127.
    aftertouch: AtomicU8,
    /// Sustain pedal (CC64) down.
    sustain: AtomicBool,
    /// Full CC table (0…127).
    ccs: [AtomicU8; 128],
    /// Notes waiting for sustain release: (channel, note).
    sustain_ch: Mutex<HashSet<(usize, u8)>>,
    /// Poly notes waiting for sustain release.
    sustain_poly: Mutex<HashSet<u8>>,
    action_bindings: Mutex<MidiActionBindings>,
    action_queue: Mutex<Vec<MidiAppAction>>,
    param_learns: Mutex<Vec<MidiParamLearn>>,
    param_sets: Mutex<Vec<MidiParamSet>>,
    /// CC→param writes for UI knob sync (normalized 0…1). Published as soon
    /// as MIDI is decoded — does not wait for the audio graph lock.
    ui_param_echo: Mutex<Vec<MidiParamSet>>,
    learn_armed: AtomicBool,
    /// When true, only CC messages can complete Learn (knob / param targets).
    learn_cc_only: AtomicBool,
    learn_capture: Mutex<Option<MidiLearnEvent>>,
    /// Last interesting MIDI event (atomics — no alloc on the MIDI callback).
    /// kind: 0=none 1=CC 2=note 3=bend 4=AT 5=raw
    last_midi_kind: AtomicU8,
    last_midi_num: AtomicU8,
    last_midi_val: AtomicU8,
    /// Which MIDI notes are currently held (lock-free; for midi_pads etc.).
    notes_held: [AtomicBool; 128],
    /// Decaying activity counter for panel LED (MIDI thread bumps; audio decays).
    activity: AtomicU32,
    /// Raw MIDI bytes from the CoreMIDI/midir callback. The callback only
    /// appends here (never decodes / never takes voice locks) so it cannot
    /// stall behind the audio graph mutex. Drained by the audio callback and
    /// by UI MIDI polls.
    ingress: Mutex<Vec<u8>>,
    /// Running-status decoder owned by the drain side (not the MIDI callback).
    decoder: Mutex<MidiDecoder>,
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
            poly: std::array::from_fn(|_| {
                let c = ChannelLive::default();
                c.store(MIDI_NOTE_ZERO_V as u8, 0, false);
                c
            }),
            stacks: Mutex::new([NoteStack::default(); CHANNELS]),
            omni_stack: Mutex::new(NoteStack::default()),
            poly_alloc: Mutex::new(PolyAlloc::default()),
            poly_count: AtomicU8::new(POLY_VOICES as u8),
            pitch_bend: AtomicU16::new(BEND_CENTER),
            mod_wheel: AtomicU8::new(0),
            aftertouch: AtomicU8::new(0),
            sustain: AtomicBool::new(false),
            ccs: std::array::from_fn(|_| AtomicU8::new(0)),
            sustain_ch: Mutex::new(HashSet::new()),
            sustain_poly: Mutex::new(HashSet::new()),
            action_bindings: Mutex::new(MidiActionBindings::default()),
            action_queue: Mutex::new(Vec::new()),
            param_learns: Mutex::new(Vec::new()),
            param_sets: Mutex::new(Vec::new()),
            ui_param_echo: Mutex::new(Vec::new()),
            learn_armed: AtomicBool::new(false),
            learn_cc_only: AtomicBool::new(false),
            learn_capture: Mutex::new(None),
            last_midi_kind: AtomicU8::new(0),
            last_midi_num: AtomicU8::new(0),
            last_midi_val: AtomicU8::new(0),
            notes_held: std::array::from_fn(|_| AtomicBool::new(false)),
            activity: AtomicU32::new(0),
            ingress: Mutex::new(Vec::with_capacity(512)),
            decoder: Mutex::new(MidiDecoder::default()),
        }
    }

    /// Copy raw MIDI bytes from the OS callback (lock held only briefly).
    pub fn push_raw_midi(&self, bytes: &[u8]) {
        if bytes.is_empty() {
            return;
        }
        // Strip high-rate realtime *before* enqueue. 24ppqn clock (0xF8) was
        // filling the ingress and shredding CC/note streams on overflow drops.
        // Keep Start/Continue/Stop — transport still needs those.
        let mut filtered = Vec::with_capacity(bytes.len());
        for &b in bytes {
            if b >= 0xf8 {
                if b == 0xfa || b == 0xfb || b == 0xfc {
                    filtered.push(b);
                }
                continue;
            }
            filtered.push(b);
        }
        if filtered.is_empty() {
            return;
        }
        let mut q = self.ingress.lock();
        const CAP: usize = 16_384;
        if q.len() >= CAP {
            let drop_n = q.len() - (CAP / 2);
            q.drain(..drop_n);
        }
        q.extend_from_slice(&filtered);
    }

    /// Drop queued bytes + running-status state (call on host reconnect).
    pub fn clear_ingress(&self) {
        self.ingress.lock().clear();
        *self.decoder.lock() = MidiDecoder::default();
    }

    /// Decode and apply queued MIDI. Safe from the audio thread or UI poll.
    pub fn drain_midi(&self) {
        let chunk = {
            let mut q = self.ingress.lock();
            if q.is_empty() {
                return;
            }
            std::mem::take(&mut *q)
        };
        // Take the decoder out so `handle_message` can borrow `self` freely.
        let mut dec = std::mem::take(&mut *self.decoder.lock());
        dec.push(&chunk, self);
        *self.decoder.lock() = dec;
    }

    /// Limit poly allocate/steal to the first `n` voices (1…8).
    pub fn set_poly_voices(&self, n: u8) {
        self.poly_count
            .store(n.clamp(1, POLY_VOICES as u8), Ordering::Release);
    }

    pub fn poly_voices(&self) -> u8 {
        self.poly_count.load(Ordering::Acquire)
    }

    pub fn set_action_bindings(&self, bindings: MidiActionBindings) {
        *self.action_bindings.lock() = bindings;
    }

    pub fn action_bindings(&self) -> MidiActionBindings {
        self.action_bindings.lock().clone()
    }

    pub fn set_param_learns(&self, learns: Vec<MidiParamLearn>) {
        // One CC → one param (last entry wins).
        let mut by_cc: std::collections::BTreeMap<u8, MidiParamLearn> = std::collections::BTreeMap::new();
        for learn in learns {
            by_cc.insert(learn.cc, learn);
        }
        *self.param_learns.lock() = by_cc.into_values().collect();
    }

    pub fn arm_learn(&self, armed: bool) {
        self.arm_learn_filtered(armed, false);
    }

    /// Arm Learn. `cc_only` ignores notes so a key press cannot steal a knob Learn.
    pub fn arm_learn_filtered(&self, armed: bool, cc_only: bool) {
        self.learn_cc_only.store(cc_only, Ordering::Release);
        self.learn_armed.store(armed, Ordering::Release);
        if armed {
            *self.learn_capture.lock() = None;
        }
    }

    pub fn take_learn_event(&self) -> Option<MidiLearnEvent> {
        self.learn_capture.lock().take()
    }

    pub fn learn_armed(&self) -> bool {
        self.learn_armed.load(Ordering::Acquire)
    }

    pub fn last_midi_message(&self) -> Option<String> {
        match self.last_midi_kind.load(Ordering::Acquire) {
            1 => Some(format!(
                "CC{}={}",
                self.last_midi_num.load(Ordering::Acquire),
                self.last_midi_val.load(Ordering::Acquire)
            )),
            2 => Some(format!(
                "N{} vel={}",
                self.last_midi_num.load(Ordering::Acquire),
                self.last_midi_val.load(Ordering::Acquire)
            )),
            3 => Some(format!(
                "bend={}",
                self.last_midi_val.load(Ordering::Acquire)
            )),
            4 => Some(format!(
                "AT={}",
                self.last_midi_val.load(Ordering::Acquire)
            )),
            5 => Some(format!(
                "raw {:02X}",
                self.last_midi_num.load(Ordering::Acquire)
            )),
            6 => Some(format!(
                "PC{}",
                self.last_midi_num.load(Ordering::Acquire)
            )),
            7 => Some("RT Start".into()),
            8 => Some("RT Stop".into()),
            _ => None,
        }
    }

    /// Last CC or note (for Learn “use last” / UI). Ignores bend/AT/raw/PC.
    pub fn last_learnable_event(&self) -> Option<MidiLearnEvent> {
        match self.last_midi_kind.load(Ordering::Acquire) {
            1 => Some(MidiLearnEvent {
                is_cc: true,
                number: self.last_midi_num.load(Ordering::Acquire),
                value: self.last_midi_val.load(Ordering::Acquire),
            }),
            2 => Some(MidiLearnEvent {
                is_cc: false,
                number: self.last_midi_num.load(Ordering::Acquire),
                value: self.last_midi_val.load(Ordering::Acquire),
            }),
            _ => None,
        }
    }

    /// Record UI monitor event without allocating (safe on the MIDI callback).
    fn note_last_midi(&self, kind: u8, num: u8, val: u8) {
        self.last_midi_num.store(num, Ordering::Release);
        self.last_midi_val.store(val, Ordering::Release);
        self.last_midi_kind.store(kind, Ordering::Release);
    }

    pub fn poll_actions(&self) -> Vec<MidiAppAction> {
        std::mem::take(&mut *self.action_queue.lock())
    }

    pub fn poll_param_sets(&self) -> Vec<MidiParamSet> {
        std::mem::take(&mut *self.param_sets.lock())
    }

    pub fn requeue_param_sets(&self, mut sets: Vec<MidiParamSet>) {
        if sets.is_empty() {
            return;
        }
        let mut q = self.param_sets.lock();
        sets.append(&mut *q);
        *q = sets;
        if q.len() > 64 {
            let drain = q.len() - 64;
            q.drain(0..drain);
        }
    }

    /// Queue normalized (0…1) param writes for the UI knob sync poll.
    pub fn echo_ui_params(&self, sets: &[MidiParamSet]) {
        if sets.is_empty() {
            return;
        }
        let mut q = self.ui_param_echo.lock();
        for s in sets {
            if let Some(existing) = q
                .iter_mut()
                .find(|e| e.module_id == s.module_id && e.param == s.param)
            {
                existing.value = s.value;
            } else {
                q.push(s.clone());
            }
        }
        if q.len() > 128 {
            let drain = q.len() - 128;
            q.drain(0..drain);
        }
    }

    pub fn poll_ui_params(&self) -> Vec<MidiParamSet> {
        std::mem::take(&mut *self.ui_param_echo.lock())
    }

    fn push_action(&self, action: MidiAppAction) {
        let mut q = self.action_queue.lock();
        // Coalesce duplicates at the tail.
        if q.last() == Some(&action) {
            return;
        }
        q.push(action);
        if q.len() > 32 {
            q.remove(0);
        }
    }

    fn maybe_capture_learn(&self, is_cc: bool, number: u8, value: u8) -> bool {
        if !self.learn_armed.load(Ordering::Acquire) {
            return false;
        }
        // Knob / param Learn: only CCs (notes must not cancel the arm).
        if self.learn_cc_only.load(Ordering::Acquire) && !is_cc {
            return false;
        }
        // Ignore note-off / CC release so a button-up cannot steal Learn.
        if value == 0 {
            return false;
        }
        *self.learn_capture.lock() = Some(MidiLearnEvent {
            is_cc,
            number,
            value,
        });
        self.learn_armed.store(false, Ordering::Release);
        true
    }

    fn match_binding(b: MidiBinding, is_cc: bool, number: u8, value: u8) -> bool {
        match b {
            MidiBinding::None => false,
            // Any non-zero CC value counts as a press (some controllers send
            // low values; release is usually 0 and must not re-trigger).
            MidiBinding::Cc(cc) => is_cc && number == cc && value > 0,
            MidiBinding::Note(n) => !is_cc && number == n && value > 0,
        }
    }

    fn dispatch_action_bindings(&self, is_cc: bool, number: u8, value: u8) {
        // While Learn is armed, never fire app actions (would steal the press).
        if self.learn_armed.load(Ordering::Acquire) {
            return;
        }
        let b = self.action_bindings.lock().clone();
        let pairs = [
            (b.start, MidiAppAction::Start),
            (b.stop, MidiAppAction::Stop),
            (b.rest, MidiAppAction::Rest),
            (b.preset_prev, MidiAppAction::PresetPrev),
            (b.preset_next, MidiAppAction::PresetNext),
            (b.preset_save, MidiAppAction::PresetSave),
            (b.panic, MidiAppAction::Panic),
        ];
        for (binding, action) in pairs {
            if Self::match_binding(binding, is_cc, number, value) {
                if action == MidiAppAction::Panic {
                    self.all_notes_off(None);
                }
                self.push_action(action);
            }
        }
    }

    fn apply_param_learns(&self, cc: u8, val: u8) {
        // Called from drain_midi (audio/UI), never the CoreMIDI callback — safe
        // to take the lock. try_lock was dropping CCs while the UI rewrote maps.
        let learns = self.param_learns.lock();
        let norm = val as f32 / 127.0;
        let mut pending = Vec::new();
        for learn in learns.iter() {
            if learn.cc == cc {
                pending.push(MidiParamSet {
                    module_id: learn.module_id,
                    param: learn.param.clone(),
                    value: norm,
                });
            }
        }
        drop(learns);
        if pending.is_empty() {
            return;
        }
        // Publish for UI immediately (0…1). Faceplate knobs must not wait on
        // the audio graph lock — that was freezing them whenever Start ran.
        self.echo_ui_params(&pending);
        let mut q = self.param_sets.lock();
        q.extend(pending);
        if q.len() > 64 {
            let drain = q.len() - 64;
            q.drain(0..drain);
        }
    }

    pub fn handle_message(&self, message: &[u8]) {
        if message.is_empty() {
            return;
        }
        self.activity.store(48_000 / 8, Ordering::Relaxed); // ~125 ms @ 48 kHz

        let status = message[0];
        // Realtime clock — ignore; Start/Stop enqueue app actions.
        if status == 0xf8 {
            return;
        }
        if status == 0xfa {
            // Show in the UI monitor (kind 7) so Play isn't a mystery when it
            // isn't a CC — many controllers send FA/FC, not CC 115/116.
            self.note_last_midi(7, 0, 127);
            self.push_action(MidiAppAction::Start);
            return;
        }
        if status == 0xfb {
            return;
        }
        if status == 0xfc {
            self.note_last_midi(8, 0, 127);
            self.push_action(MidiAppAction::Stop);
            return;
        }

        let hi = status & 0xf0;
        let ch = (status & 0x0f) as usize;

        match hi {
            0x90 => {
                if message.len() < 3 {
                    return;
                }
                let note = message[1] & 0x7f;
                let vel = message[2] & 0x7f;
                if vel == 0 {
                    self.note_off(ch, note);
                } else {
                    self.note_last_midi(2, note, vel);
                    let learned = self.maybe_capture_learn(false, note, vel);
                    if !learned {
                        self.dispatch_action_bindings(false, note, vel);
                    }
                    self.note_on(ch, note, vel);
                }
            }
            0x80 => {
                if message.len() < 3 {
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
                self.note_last_midi(1, cc, val);
                self.ccs[cc as usize].store(val, Ordering::Release);
                let learned = self.maybe_capture_learn(true, cc, val);
                if cc == 1 {
                    self.mod_wheel.store(val, Ordering::Release);
                }
                if cc == 64 {
                    self.set_sustain(val >= 64);
                }
                if !learned && (cc == 120 || cc == 123 || (cc == 121 && val == 0)) {
                    self.all_notes_off(Some(ch));
                    self.push_action(MidiAppAction::Panic);
                }
                if !learned {
                    self.dispatch_action_bindings(true, cc, val);
                    self.apply_param_learns(cc, val);
                }
            }
            0xc0 => {
                // Program change — Bank / preset buttons often send this.
                if message.len() < 2 {
                    return;
                }
                let prog = message[1] & 0x7f;
                self.note_last_midi(6, prog, 127);
            }
            0xd0 => {
                // Channel aftertouch
                if message.len() < 2 {
                    return;
                }
                let val = message[1] & 0x7f;
                self.aftertouch.store(val, Ordering::Release);
                self.note_last_midi(4, val, val);
            }
            0xe0 => {
                if message.len() < 3 {
                    return;
                }
                let lsb = (message[1] & 0x7f) as u16;
                let msb = (message[2] & 0x7f) as u16;
                self.pitch_bend
                    .store(lsb | (msb << 7), Ordering::Release);
                self.note_last_midi(3, msb as u8, ((lsb | (msb << 7)) / 128) as u8);
            }
            0xff => {
                self.all_notes_off(None);
                self.push_action(MidiAppAction::Panic);
            }
            _ => {}
        }
    }

    fn set_sustain(&self, down: bool) {
        let was = self.sustain.swap(down, Ordering::SeqCst);
        if was && !down {
            // Pedal up — release deferred notes.
            let pending_ch: Vec<_> = self.sustain_ch.lock().drain().collect();
            let pending_poly: Vec<_> = self.sustain_poly.lock().drain().collect();
            for (ch, note) in pending_ch {
                self.notes_held[(note & 0x7f) as usize].store(false, Ordering::Release);
                self.note_off_now(ch, note);
            }
            for note in pending_poly {
                self.notes_held[(note & 0x7f) as usize].store(false, Ordering::Release);
                self.poly_note_off_now(note);
            }
        }
    }

    fn note_on(&self, ch: usize, note: u8, vel: u8) {
        if ch >= CHANNELS {
            return;
        }
        // Re-press cancels a deferred sustain release.
        self.sustain_ch.lock().remove(&(ch, note));
        self.sustain_poly.lock().remove(&note);
        self.notes_held[(note & 0x7f) as usize].store(true, Ordering::Release);
        {
            let mut stacks = self.stacks.lock();
            stacks[ch].push(note);
            self.channels[ch].store(note, vel, true);
        }
        let mut omni = self.omni_stack.lock();
        omni.push(note);
        self.omni.store(note, vel, true);
        self.poly_note_on(note, vel);
    }

    fn note_off(&self, ch: usize, note: u8) {
        if ch >= CHANNELS {
            return;
        }
        if self.sustain.load(Ordering::Acquire) {
            self.sustain_ch.lock().insert((ch, note));
            self.sustain_poly.lock().insert(note);
            return; // keep notes_held — pedal still sounding
        }
        self.notes_held[(note & 0x7f) as usize].store(false, Ordering::Release);
        self.note_off_now(ch, note);
        self.poly_note_off_now(note);
    }

    fn note_off_now(&self, ch: usize, note: u8) {
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

    fn poly_note_on(&self, note: u8, vel: u8) {
        let n = self.poly_count.load(Ordering::Acquire) as usize;
        let n = n.clamp(1, POLY_VOICES);
        let mut alloc = self.poly_alloc.lock();
        // Retrigger same note on its existing voice.
        if let Some(i) = alloc.notes[..n].iter().position(|x| *x == Some(note)) {
            alloc.age[i] = alloc.clock;
            alloc.clock = alloc.clock.wrapping_add(1);
            self.poly[i].store(note, vel, true);
            return;
        }
        // Free slot.
        if let Some(i) = alloc.notes[..n].iter().position(|x| x.is_none()) {
            alloc.notes[i] = Some(note);
            alloc.age[i] = alloc.clock;
            alloc.clock = alloc.clock.wrapping_add(1);
            self.poly[i].store(note, vel, true);
            return;
        }
        // Steal oldest occupied voice.
        let i = alloc.age[..n]
            .iter()
            .enumerate()
            .min_by_key(|(_, a)| *a)
            .map(|(i, _)| i)
            .unwrap_or(0);
        alloc.notes[i] = Some(note);
        alloc.age[i] = alloc.clock;
        alloc.clock = alloc.clock.wrapping_add(1);
        self.poly[i].store(note, vel, true);
    }

    fn poly_note_off_now(&self, note: u8) {
        let n = self.poly_count.load(Ordering::Acquire) as usize;
        let n = n.clamp(1, POLY_VOICES);
        let mut alloc = self.poly_alloc.lock();
        if let Some(i) = alloc.notes[..n].iter().position(|x| *x == Some(note)) {
            alloc.notes[i] = None;
            self.poly[i].clear_gate();
        }
    }

    fn poly_all_off(&self) {
        let mut alloc = self.poly_alloc.lock();
        *alloc = PolyAlloc::default();
        for v in &self.poly {
            v.clear_gate();
        }
    }

    pub fn all_notes_off(&self, only_ch: Option<usize>) {
        // Panic / ANO clears sustain deferrals immediately.
        self.sustain.store(false, Ordering::Release);
        self.sustain_ch.lock().clear();
        self.sustain_poly.lock().clear();
        for h in &self.notes_held {
            h.store(false, Ordering::Release);
        }

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
        self.poly_all_off();
        self.pitch_bend.store(BEND_CENTER, Ordering::Release);
        // Leave mod wheel / CC table as-is (expression often stays).
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

    /// Channel aftertouch as 0…5 V.
    pub fn aftertouch_volts(&self) -> f32 {
        self.aftertouch.load(Ordering::Acquire) as f32 / 127.0 * 5.0
    }

    /// Sustain pedal (CC64) as gate-style 0 / 5 V.
    pub fn sustain_volts(&self) -> f32 {
        if self.sustain.load(Ordering::Acquire) {
            5.0
        } else {
            0.0
        }
    }

    pub fn sustain_down(&self) -> bool {
        self.sustain.load(Ordering::Acquire)
    }

    /// Continuous controller `cc` (0…127) as 0…5 V.
    pub fn cc_volts(&self, cc: u8) -> f32 {
        let i = (cc & 0x7f) as usize;
        self.ccs[i].load(Ordering::Acquire) as f32 / 127.0 * 5.0
    }

    pub fn cc_value(&self, cc: u8) -> u8 {
        self.ccs[(cc & 0x7f) as usize].load(Ordering::Acquire)
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

    /// Polyphonic voice `i` (0-based) — chords on a single MIDI channel.
    pub fn poly_voice(&self, i: usize) -> (f32, f32, f32) {
        if i >= POLY_VOICES {
            return (0.0, 0.0, 0.0);
        }
        Self::voice_from(&self.poly[i])
    }

    pub fn poly_gate_led(&self, i: usize) -> f32 {
        if i >= POLY_VOICES {
            return 0.0;
        }
        let (_, _, gate) = self.poly[i].load();
        if gate {
            1.0
        } else {
            0.05
        }
    }

    /// Gate-style 0/5 V if MIDI note `note` is currently held (any channel / poly).
    /// Lock-free — safe to call from the audio callback every sample.
    pub fn note_gate_volts(&self, note: u8) -> f32 {
        if self.notes_held[(note & 0x7f) as usize].load(Ordering::Acquire) {
            5.0
        } else {
            0.0
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

/// Byte-stream MIDI decoder: running status + reassembly of short messages.
///
/// Many USB / Bluetooth keyboards omit the status byte on subsequent notes
/// (MIDI running status). Without this, note-ons/offs are intermittently dropped
/// and MIDI feels flaky.
#[derive(Default)]
struct MidiDecoder {
    /// Last channel voice status (0x8n–0xEn). Cleared by system common / SysEx.
    running: u8,
    /// Bytes of the message currently being assembled (includes status).
    partial: Vec<u8>,
    /// Data bytes still needed for `partial` (usize::MAX = skipping SysEx).
    need: usize,
}

impl MidiDecoder {
    fn push(&mut self, bytes: &[u8], bus: &MidiBus) {
        for &b in bytes {
            self.push_byte(b, bus);
        }
    }

    fn emit(&mut self, bus: &MidiBus) {
        if !self.partial.is_empty() {
            bus.handle_message(&self.partial);
        }
        self.partial.clear();
        self.need = 0;
    }

    fn begin_status(&mut self, status: u8, bus: &MidiBus) {
        self.partial.clear();
        self.partial.push(status);
        self.need = Self::data_bytes(status);
        if self.need == 0 {
            self.emit(bus);
        }
    }

    fn push_byte(&mut self, b: u8, bus: &MidiBus) {
        // Real-time may interleave anywhere; don't disturb running status / partial.
        // Skip clock (F8) entirely — Oxygen floods it and it steals CPU from CC
        // while the audio callback is running.
        if b == 0xf8 {
            return;
        }
        if (0xf9..=0xff).contains(&b) {
            bus.handle_message(&[b]);
            return;
        }

        if b >= 0x80 {
            if b == 0xf7 {
                // End of SysEx (or stray EOX).
                self.partial.clear();
                self.need = 0;
                self.running = 0;
                return;
            }
            if (0xf0..=0xf6).contains(&b) {
                self.running = 0;
                self.partial.clear();
                if b == 0xf0 {
                    self.need = usize::MAX; // skip until EOX
                } else {
                    self.begin_status(b, bus);
                }
                return;
            }
            // Channel voice / channel mode status.
            self.running = b;
            self.begin_status(b, bus);
            return;
        }

        // Data byte
        if self.need == usize::MAX {
            return; // SysEx body
        }

        if self.partial.is_empty() {
            if self.running == 0 || self.running >= 0xf0 {
                return; // orphan data
            }
            self.partial.push(self.running);
            self.need = Self::data_bytes(self.running);
        }

        self.partial.push(b);
        if self.need > 0 {
            self.need -= 1;
        }
        if self.need == 0 {
            self.emit(bus);
        }
    }

    fn data_bytes(status: u8) -> usize {
        match status & 0xf0 {
            0x80 | 0x90 | 0xa0 | 0xb0 | 0xe0 => 2,
            0xc0 | 0xd0 => 1,
            0xf0 => match status {
                0xf1 | 0xf3 => 1,
                0xf2 => 2,
                _ => 0,
            },
            _ => 0,
        }
    }
}

/// MIDI input host (USB class-compliant devices + interfaces via OS MIDI).
///
/// Opens **all** non–DAW-surface ports so knobs/keys aren't missed when a
/// device exposes several endpoints (e.g. USB MIDI + DIN).
pub struct MidiHost {
    _connections: Vec<midir::MidiInputConnection<()>>,
    pub info: MidiDeviceInfo,
    /// Every port currently feeding the bus.
    pub open_ports: Vec<String>,
}

/// Score a MIDI port name for list ordering / primary label.
pub fn midi_port_score(name: &str) -> i32 {
    let lower = name.to_ascii_lowercase();
    let mut score = 0i32;
    if lower.contains("mackie") || lower.contains("hui") || lower.contains("control surface") {
        score -= 100;
    }
    if lower.contains("editor") {
        score -= 80;
    }
    if lower.contains("midi din") || lower.contains("din midi") {
        score -= 40;
    }
    if lower.contains("usb midi") || lower.contains("usb") {
        score += 50;
    }
    if lower.contains("oxygen") || lower.contains("keyboard") || lower.contains("keys") {
        score += 30;
    }
    if lower.contains("midi") {
        score += 10;
    }
    score
}

pub fn is_daw_surface_port(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("mackie") || lower.contains("hui") || lower.contains("control surface")
}

/// Ports we never open (surfaces + preset-editor endpoints).
pub fn is_ignored_midi_port(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    is_daw_surface_port(name) || lower.contains("editor")
}

impl MidiHost {
    pub fn list_devices() -> Result<Vec<MidiDeviceInfo>, MidiError> {
        let midi_in =
            midir::MidiInput::new("emenay midi scan").map_err(|e| MidiError::Init(e.to_string()))?;
        let mut devices: Vec<MidiDeviceInfo> = midi_in
            .ports()
            .iter()
            .filter_map(|p| {
                midi_in.port_name(p).ok().and_then(|name| {
                    if is_ignored_midi_port(&name) {
                        None
                    } else {
                        Some(MidiDeviceInfo { name })
                    }
                })
            })
            .collect();
        devices.sort_by(|a, b| {
            midi_port_score(&b.name)
                .cmp(&midi_port_score(&a.name))
                .then_with(|| a.name.cmp(&b.name))
        });
        Ok(devices)
    }

    fn connect_named(
        port_name: &str,
        bus: Arc<MidiBus>,
        label: &str,
    ) -> Result<(midir::MidiInputConnection<()>, String), MidiError> {
        let midi_in = midir::MidiInput::new(label).map_err(|e| MidiError::Init(e.to_string()))?;
        let ports = midi_in.ports();
        let port = ports
            .iter()
            .find(|p| midi_in.port_name(p).ok().as_ref() == Some(&port_name.to_string()))
            .ok_or_else(|| MidiError::DeviceNotFound(port_name.to_string()))?;
        let name = midi_in
            .port_name(port)
            .unwrap_or_else(|_| port_name.to_string());
        let bus2 = Arc::clone(&bus);
        let connection = midi_in
            .connect(
                port,
                "emenay-in",
                move |_stamp, message, _| {
                    // Keep this callback tiny: CoreMIDI + a live CoreAudio
                    // stream will stall or drop events if we take voice locks
                    // or allocate here. Decode happens on drain_midi().
                    bus2.push_raw_midi(message);
                },
                (),
            )
            .map_err(|e| MidiError::Connect(e.to_string()))?;
        Ok((connection, name))
    }

    pub fn start(device_name: Option<String>, bus: Arc<MidiBus>) -> Result<Self, MidiError> {
        let listed = Self::list_devices()?;
        if listed.is_empty() {
            let scan = midir::MidiInput::new("emenay midi scan")
                .map_err(|e| MidiError::Init(e.to_string()))?;
            if scan.ports().is_empty() {
                return Err(MidiError::NoDevice);
            }
            // Only ignored (Mackie/Editor) ports remain — nothing useful to open.
            return Err(MidiError::NoDevice);
        }

        // Primary = explicit pick, else highest-scoring notes port (USB > DIN).
        let primary = if let Some(want) = device_name.as_ref() {
            // Prefer exact match; fall back to prefix so stale UI names still work.
            if listed.iter().any(|d| d.name == *want) {
                want.clone()
            } else if let Some(d) = listed.iter().find(|d| d.name.starts_with(want.as_str())) {
                d.name.clone()
            } else {
                listed
                    .iter()
                    .max_by_key(|d| midi_port_score(&d.name))
                    .map(|d| d.name.clone())
                    .ok_or(MidiError::NoDevice)?
            }
        } else {
            listed
                .iter()
                .max_by_key(|d| midi_port_score(&d.name))
                .map(|d| d.name.clone())
                .ok_or(MidiError::NoDevice)?
        };

        // Open every non–DAW-surface port. Controllers often split keys/CCs
        // across endpoints; opening only "siblings" was a common miss.
        let mut names: Vec<String> = Vec::with_capacity(listed.len());
        names.push(primary.clone());
        for d in &listed {
            if d.name != primary {
                names.push(d.name.clone());
            }
        }

        let mut connections = Vec::new();
        let mut open_ports = Vec::new();
        for (i, name) in names.iter().enumerate() {
            let label = format!("emenay midi {i}");
            match Self::connect_named(name, Arc::clone(&bus), &label) {
                Ok((conn, opened)) => {
                    open_ports.push(opened);
                    connections.push(conn);
                }
                Err(e) => {
                    eprintln!("emenay: MIDI open `{name}` failed: {e}");
                }
            }
        }

        if connections.is_empty() {
            return Err(MidiError::NoDevice);
        }

        Ok(Self {
            _connections: connections,
            // Keep a real port name (not a summary) so the UI select can match.
            info: MidiDeviceInfo {
                name: open_ports
                    .iter()
                    .find(|n| *n == &primary)
                    .cloned()
                    .unwrap_or_else(|| open_ports[0].clone()),
            },
            open_ports,
        })
    }

    /// True when open connections are dead or missing — not when some listed
    /// ports simply failed to open (that used to reconnect forever and kill Learn/CC).
    pub fn needs_reconnect(&self) -> bool {
        let Ok(listed) = Self::list_devices() else {
            return false;
        };
        if listed.is_empty() {
            // Device vanished — drop dead host so we can reopen on return.
            return !self.open_ports.is_empty();
        }
        if self.open_ports.is_empty() {
            return true;
        }
        let listed_names: std::collections::HashSet<&str> =
            listed.iter().map(|d| d.name.as_str()).collect();
        // Only reopen when an *already open* port disappeared from the OS list
        // (sleep / unplug). Missing listed ports that never opened are ignored —
        // use force reconnect / Reconnect for hotplug of extra endpoints.
        self.open_ports
            .iter()
            .any(|n| !listed_names.contains(n.as_str()))
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

    #[test]
    fn running_status_note_stream() {
        let bus = MidiBus::new();
        let mut dec = MidiDecoder::default();
        // Full note-on, then running-status note-on (no status byte), then note-off.
        dec.push(&[0x90, 60, 100, 72, 80], &bus);
        let (cv, gate, _) = bus.omni_voice();
        assert!((cv - 1.0).abs() < 1e-5, "cv={cv}");
        assert!(gate > 0.0);

        dec.push(&[72, 0], &bus); // running-status note-on vel0 = note-off for C5
        let (cv, gate, _) = bus.omni_voice();
        assert!((cv - 0.0).abs() < 1e-5, "cv={cv}");
        assert!(gate > 0.0);

        dec.push(&[0x80, 60, 0], &bus);
        let (_, gate, _) = bus.omni_voice();
        assert_eq!(gate, 0.0);
    }

    #[test]
    fn running_status_split_packets() {
        let bus = MidiBus::new();
        let mut dec = MidiDecoder::default();
        dec.push(&[0x90, 60], &bus); // incomplete
        let (_, gate, _) = bus.omni_voice();
        assert_eq!(gate, 0.0);
        dec.push(&[100], &bus); // complete note-on
        let (_, gate, _) = bus.omni_voice();
        assert!(gate > 0.0);
        // Next packet is running-status only
        dec.push(&[64, 90], &bus);
        let (cv, gate, _) = bus.omni_voice();
        assert!((cv - (64i32 - 60) as f32 / 12.0).abs() < 1e-5);
        assert!(gate > 0.0);
    }

    #[test]
    fn ingress_queue_drain_applies_notes() {
        let bus = MidiBus::new();
        bus.push_raw_midi(&[0x90, 60, 100]);
        bus.push_raw_midi(&[72, 80]); // running status across packets
        let (_, gate, _) = bus.omni_voice();
        assert_eq!(gate, 0.0, "must not apply before drain");
        bus.drain_midi();
        let (cv, gate, _) = bus.omni_voice();
        assert!((cv - 1.0).abs() < 1e-5);
        assert!(gate > 0.0);
        assert!(bus.last_midi_message().is_some());
    }

    #[test]
    fn ingress_strips_clock_keeps_cc_and_transport() {
        let bus = MidiBus::new();
        bus.set_param_learns(vec![MidiParamLearn {
            cc: 16,
            module_id: 1,
            param: "cutoff".into(),
        }]);
        // Clock interleaved with CC — must not starve / corrupt the CC.
        bus.push_raw_midi(&[0xf8, 0xb0, 16, 0xf8, 90, 0xf8]);
        bus.push_raw_midi(&[0xfa]); // RT Start kept
        bus.drain_midi();
        assert_eq!(bus.cc_value(16), 90);
        let sets = bus.poll_param_sets();
        assert_eq!(sets.len(), 1);
        assert!((sets[0].value - 90.0 / 127.0).abs() < 1e-5);
        assert!(bus.poll_actions().contains(&MidiAppAction::Start));
    }

    #[test]
    fn poly_allocator_holds_chord() {
        let bus = MidiBus::new();
        bus.set_poly_voices(4);
        bus.handle_message(&[0x90, 60, 100]);
        bus.handle_message(&[0x90, 64, 100]);
        bus.handle_message(&[0x90, 67, 100]);
        let mut gates = 0;
        for i in 0..4 {
            let (_, g, _) = bus.poly_voice(i);
            if g > 0.0 {
                gates += 1;
            }
        }
        assert_eq!(gates, 3, "three notes should occupy three poly voices");
        // Omni stays last-note (mono).
        let (cv, gate, _) = bus.omni_voice();
        assert!(gate > 0.0);
        assert!((cv - (67i32 - 60) as f32 / 12.0).abs() < 1e-5);

        bus.handle_message(&[0x80, 64, 0]);
        let held: Vec<_> = (0..4)
            .filter_map(|i| {
                let (cv, g, _) = bus.poly_voice(i);
                if g > 0.0 {
                    Some((cv * 12.0).round() as i32 + 60)
                } else {
                    None
                }
            })
            .collect();
        assert_eq!(held.len(), 2);
        assert!(held.contains(&60) && held.contains(&67));
    }

    #[test]
    fn poly_steals_oldest_when_full() {
        let bus = MidiBus::new();
        bus.set_poly_voices(2);
        bus.handle_message(&[0x90, 60, 100]);
        bus.handle_message(&[0x90, 62, 100]);
        bus.handle_message(&[0x90, 64, 100]); // steals voice holding 60
        let notes: Vec<_> = (0..2)
            .filter_map(|i| {
                let (cv, g, _) = bus.poly_voice(i);
                if g > 0.0 {
                    Some((cv * 12.0).round() as i32 + 60)
                } else {
                    None
                }
            })
            .collect();
        assert_eq!(notes.len(), 2);
        assert!(notes.contains(&62) && notes.contains(&64));
        assert!(!notes.contains(&60));
    }

    #[test]
    fn sustain_holds_gate_across_note_off() {
        let bus = MidiBus::new();
        bus.handle_message(&[0x90, 60, 100]);
        bus.handle_message(&[0xb0, 64, 127]); // sustain down
        bus.handle_message(&[0x80, 60, 0]);
        let (_, gate, _) = bus.omni_voice();
        assert!(gate > 0.0, "gate should hold under sustain");
        let (_, pg, _) = bus.poly_voice(0);
        assert!(pg > 0.0, "poly gate should hold under sustain");
        bus.handle_message(&[0xb0, 64, 0]); // sustain up
        let (_, gate, _) = bus.omni_voice();
        assert_eq!(gate, 0.0);
        let (_, pg, _) = bus.poly_voice(0);
        assert_eq!(pg, 0.0);
    }

    #[test]
    fn aftertouch_and_cc_table() {
        let bus = MidiBus::new();
        bus.handle_message(&[0xd0, 0x7f]);
        assert!((bus.aftertouch_volts() - 5.0).abs() < 0.05);
        bus.handle_message(&[0xb0, 74, 64]);
        assert!((bus.cc_volts(74) - 2.5).abs() < 0.1);
        assert_eq!(bus.cc_value(74), 64);
        assert!((bus.sustain_volts() - 0.0).abs() < 1e-5);
        bus.handle_message(&[0xb0, 64, 100]);
        assert!((bus.sustain_volts() - 5.0).abs() < 1e-5);
    }

    #[test]
    fn action_queue_defaults_and_realtime() {
        let bus = MidiBus::new();
        bus.handle_message(&[0xb0, 115, 127]); // Start
        bus.handle_message(&[0xb0, 116, 127]); // Stop
        bus.handle_message(&[0xfa]); // realtime Start
        bus.handle_message(&[0xfc]); // realtime Stop
        let actions = bus.poll_actions();
        assert!(actions.contains(&MidiAppAction::Start));
        assert!(actions.contains(&MidiAppAction::Stop));
        bus.handle_message(&[0xb0, 110, 127]);
        bus.handle_message(&[0xb0, 111, 127]);
        bus.handle_message(&[0xb0, 112, 127]);
        let actions = bus.poll_actions();
        assert_eq!(
            actions,
            vec![
                MidiAppAction::PresetPrev,
                MidiAppAction::PresetNext,
                MidiAppAction::PresetSave
            ]
        );
    }

    #[test]
    fn panic_clears_sustain() {
        let bus = MidiBus::new();
        bus.handle_message(&[0x90, 60, 100]);
        bus.handle_message(&[0xb0, 64, 127]);
        bus.handle_message(&[0x80, 60, 0]);
        bus.handle_message(&[0xb0, 123, 0]); // ANO
        let (_, gate, _) = bus.omni_voice();
        assert_eq!(gate, 0.0);
        assert!(!bus.sustain_down());
    }

    #[test]
    fn midi_port_score_and_daw_surface_filter() {
        assert!(
            midi_port_score("Oxygen Pro 25 USB MIDI")
                > midi_port_score("Oxygen Pro 25 MIDI DIN")
        );
        assert!(is_daw_surface_port("Oxygen Mackie Control"));
        assert!(is_daw_surface_port("Oxygen Pro 25 Mackie/HUI"));
        assert!(!is_daw_surface_port("Oxygen Pro 25"));
        assert!(!is_daw_surface_port("Oxygen Pro 25 USB MIDI"));
    }

    #[test]
    fn learn_capture_and_param_sets() {
        let bus = MidiBus::new();
        bus.arm_learn(true);
        bus.handle_message(&[0xb0, 20, 90]);
        let ev = bus.take_learn_event().expect("learn event");
        assert!(ev.is_cc && ev.number == 20);
        bus.set_param_learns(vec![MidiParamLearn {
            cc: 20,
            module_id: 1,
            param: "cutoff".into(),
        }]);
        bus.handle_message(&[0xb0, 20, 64]);
        let sets = bus.poll_param_sets();
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0].module_id, 1);
        assert!((sets[0].value - 64.0 / 127.0).abs() < 1e-5);
    }
}
