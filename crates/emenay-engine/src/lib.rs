//! Real-time patch graph and audio device host for emenay.

mod audio;
mod graph;
pub mod midi;
pub mod module;
mod types;

pub use audio::{AudioHost, DeviceInfo, HostError};
pub use graph::{Cable, GraphError, GraphSnapshot, ModuleInstance, PatchGraph};
pub use midi::{
    global_midi_bus, is_daw_surface_port, is_ignored_midi_port, midi_port_score, MidiActionBindings,
    MidiAppAction, MidiBinding, MidiBus, MidiDeviceInfo, MidiError, MidiHost, MidiLearnEvent,
    MidiParamLearn, MidiParamSet,
};
pub use module::{
    Module, ModuleFactory, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
pub use types::{ModuleId, PortRef, Voltage};

use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};

/// Panel lights published at the end of each audio buffer so the UI can poll
/// without contending for the graph mutex (which the audio thread holds for
/// the whole `process_block`).
fn lights_slot() -> &'static Mutex<Vec<(ModuleId, module::ModuleLights)>> {
    static LIGHTS: OnceLock<Mutex<Vec<(ModuleId, module::ModuleLights)>>> = OnceLock::new();
    LIGHTS.get_or_init(|| Mutex::new(Vec::new()))
}

fn publish_lights(graph: &PatchGraph) {
    *lights_slot().lock() = graph.poll_lights();
}

/// Shared engine handle used by the UI / Tauri commands.
#[derive(Clone)]
pub struct Engine {
    graph: Arc<Mutex<PatchGraph>>,
    host: Arc<Mutex<Option<AudioHost>>>,
    midi_host: Arc<Mutex<Option<MidiHost>>>,
    sample_rate: Arc<Mutex<f32>>,
    channels: Arc<Mutex<usize>>,
    running: Arc<AtomicBool>,
    live: Arc<AtomicBool>,
}

impl Engine {
    pub fn new() -> Self {
        Self::with_graph(PatchGraph::new())
    }

    pub fn with_graph(graph: PatchGraph) -> Self {
        Self {
            graph: Arc::new(Mutex::new(graph)),
            host: Arc::new(Mutex::new(None)),
            midi_host: Arc::new(Mutex::new(None)),
            sample_rate: Arc::new(Mutex::new(48_000.0)),
            channels: Arc::new(Mutex::new(2)),
            running: Arc::new(AtomicBool::new(false)),
            live: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn register_factory(&self, type_id: impl Into<String>, factory: module::ModuleFactory) {
        self.graph.lock().register_factory(type_id, factory);
    }

    pub fn catalog(&self) -> Vec<ModuleInfo> {
        self.graph.lock().catalog()
    }

    pub fn list_devices() -> Result<Vec<DeviceInfo>, HostError> {
        AudioHost::list_devices()
    }

    pub fn list_midi_devices() -> Result<Vec<MidiDeviceInfo>, MidiError> {
        MidiHost::list_devices()
    }

    /// Open USB / interface MIDI inputs and feed the global MidiCv bus.
    ///
    /// Soft open (`force = false`): keep any healthy host that still has live
    /// ports. Preferred `device_name` only matters on a fresh open or `force`.
    /// (Requiring the preferred name to already be in `open_ports` caused
    /// reconnect storms when that port failed to open but siblings worked.)
    pub fn start_midi(&self, device_name: Option<String>) -> Result<MidiDeviceInfo, MidiError> {
        self.start_midi_with(device_name, false)
    }

    pub fn start_midi_with(
        &self,
        device_name: Option<String>,
        force: bool,
    ) -> Result<MidiDeviceInfo, MidiError> {
        let bus = global_midi_bus();
        {
            let guard = self.midi_host.lock();
            if let Some(host) = guard.as_ref() {
                let healthy = !host.open_ports.is_empty() && !host.needs_reconnect();
                // Never tear down mid-Learn unless the UI forced a reconnect.
                if bus.learn_armed() && !force {
                    return Ok(host.info.clone());
                }
                if healthy && !force {
                    return Ok(host.info.clone());
                }
            }
        }
        self.stop_midi();
        let host = MidiHost::start(device_name, bus)?;
        let info = host.info.clone();
        *self.midi_host.lock() = Some(host);
        Ok(info)
    }

    /// Reopen MIDI if ports went stale or none are open. No-op when healthy.
    pub fn ensure_midi(&self, device_name: Option<String>) -> Result<MidiDeviceInfo, MidiError> {
        self.start_midi_with(device_name, false)
    }

    pub fn stop_midi(&self) {
        let _ = self.midi_host.lock().take();
        let bus = global_midi_bus();
        bus.clear_ingress();
        bus.all_notes_off(None);
    }

    pub fn midi_device(&self) -> Option<MidiDeviceInfo> {
        self.midi_host.lock().as_ref().map(|h| h.info.clone())
    }

    pub fn midi_device_ports(&self) -> Option<Vec<String>> {
        self.midi_host
            .lock()
            .as_ref()
            .map(|h| h.open_ports.clone())
    }

    pub fn poll_midi_actions(&self) -> Vec<MidiAppAction> {
        global_midi_bus().poll_actions()
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Drain learned CC→param writes and apply them to the graph.
    ///
    /// Uses try_lock so this never stalls behind the audio callback. While
    /// running, the audio callback also applies any leftovers each buffer.
    pub fn apply_midi_param_sets(&self) -> usize {
        let sets = global_midi_bus().poll_param_sets();
        if sets.is_empty() {
            return 0;
        }
        let Some(mut g) = self.graph.try_lock() else {
            global_midi_bus().requeue_param_sets(sets);
            return 0;
        };
        apply_mapped_midi_params(&mut g, sets)
    }

    /// Recent MIDI→param writes for UI knob sync (normalized 0…1).
    pub fn poll_midi_ui_params(&self) -> Vec<MidiParamSet> {
        global_midi_bus().poll_ui_params()
    }

    pub fn set_midi_action_bindings(&self, bindings: MidiActionBindings) {
        global_midi_bus().set_action_bindings(bindings);
    }

    pub fn midi_action_bindings(&self) -> MidiActionBindings {
        global_midi_bus().action_bindings()
    }

    pub fn set_midi_param_learns(&self, learns: Vec<MidiParamLearn>) {
        global_midi_bus().set_param_learns(learns);
    }

    pub fn arm_midi_learn(&self, armed: bool) {
        global_midi_bus().arm_learn(armed);
    }

    pub fn arm_midi_learn_filtered(&self, armed: bool, cc_only: bool) {
        global_midi_bus().arm_learn_filtered(armed, cc_only);
    }

    pub fn take_midi_learn_event(&self) -> Option<MidiLearnEvent> {
        global_midi_bus().take_learn_event()
    }

    pub fn midi_learn_armed(&self) -> bool {
        global_midi_bus().learn_armed()
    }

    pub fn last_midi_message(&self) -> Option<String> {
        global_midi_bus().last_midi_message()
    }

    pub fn snapshot(&self) -> EngineSnapshot {
        EngineSnapshot {
            sample_rate: *self.sample_rate.lock(),
            channels: *self.channels.lock(),
            running: self.running.load(Ordering::SeqCst),
            graph: self.graph.lock().snapshot(),
        }
    }

    /// Last lights snapshot published by the audio callback (no engine lock).
    pub fn published_lights() -> Vec<(ModuleId, module::ModuleLights)> {
        lights_slot().lock().clone()
    }

    /// Lightweight LED/digit poll for the UI.
    ///
    /// While running, reads the snapshot published by the audio callback
    /// (no graph lock). When stopped, samples the graph directly.
    pub fn poll_lights(&self) -> Vec<(ModuleId, module::ModuleLights)> {
        if self.running.load(Ordering::SeqCst) {
            return Self::published_lights();
        }
        match self.graph.try_lock() {
            Some(g) => {
                let lights = g.poll_lights();
                *lights_slot().lock() = lights.clone();
                lights
            }
            None => Self::published_lights(),
        }
    }

    /// Replace the patch. Mutes the audio callback first so modules (incl. MI
    /// firmware hosts) are never dropped/created under a live render.
    pub fn apply_graph(&self, snapshot: graph::GraphSnapshot) -> Result<(), GraphError> {
        let was_live = self.live.swap(false, Ordering::SeqCst);
        let result = (|| {
            let mut g = self.graph.lock();
            g.apply_snapshot(snapshot)?;
            let sr = *self.sample_rate.lock();
            g.set_sample_rate(sr);
            g.reset_modules();
            Ok(())
        })();
        if was_live {
            self.live.store(true, Ordering::SeqCst);
        }
        result
    }

    /// Silence output and reset every module's DSP state (sequencers, delays, …)
    /// without changing the patch. Safe to call while the stream is open.
    pub fn master_rest(&self) {
        let was_live = self.live.swap(false, Ordering::SeqCst);
        global_midi_bus().all_notes_off(None);
        {
            let mut g = self.graph.lock();
            g.reset_modules();
        }
        if was_live {
            self.live.store(true, Ordering::SeqCst);
        }
    }

    pub fn set_param(&self, module_id: ModuleId, name: &str, value: f32) -> Result<(), GraphError> {
        self.graph.lock().set_param(module_id, name, value)
    }

    pub fn add_module(&self, type_id: &str, x: f32, y: f32) -> Result<ModuleId, GraphError> {
        // Mute briefly so MI firmware hosts are never constructed under a live render.
        let was_live = self.live.swap(false, Ordering::SeqCst);
        let result = self.graph.lock().add_module(type_id, x, y);
        if was_live {
            self.live.store(true, Ordering::SeqCst);
        }
        result
    }

    pub fn connect(
        &self,
        from_module: ModuleId,
        from_port: String,
        to_module: ModuleId,
        to_port: String,
    ) -> Result<u64, GraphError> {
        self.graph.lock().connect(
            PortRef {
                module: from_module,
                port: from_port,
            },
            PortRef {
                module: to_module,
                port: to_port,
            },
        )
    }

    pub fn disconnect(&self, cable_id: u64) -> Result<(), GraphError> {
        self.graph.lock().disconnect(cable_id)
    }

    pub fn disconnect_port(
        &self,
        module: ModuleId,
        port: String,
        as_output: bool,
    ) -> Result<usize, GraphError> {
        self.graph.lock().disconnect_port(
            &PortRef {
                module,
                port,
            },
            as_output,
        )
    }

    pub fn move_module(&self, module_id: ModuleId, x: f32, y: f32) -> Result<(), GraphError> {
        self.graph.lock().update_module_position(module_id, x, y)
    }

    pub fn remove_module(&self, module_id: ModuleId) -> Result<(), GraphError> {
        let was_live = self.live.swap(false, Ordering::SeqCst);
        let result = self.graph.lock().remove_module(module_id);
        if was_live {
            self.live.store(true, Ordering::SeqCst);
        }
        result
    }

    pub fn start(&self, device_name: Option<String>) -> Result<DeviceInfo, HostError> {
        if self.running.load(Ordering::SeqCst) {
            if let Some(host) = self.host.lock().as_ref() {
                self.live.store(true, Ordering::SeqCst);
                return Ok(host.info.clone());
            }
        }
        // Tear down any lingering host before opening a new stream.
        self.stop();

        let host = AudioHost::start(
            device_name,
            Arc::clone(&self.graph),
            Arc::clone(&self.live),
        )?;
        let info = host.info.clone();
        *self.sample_rate.lock() = info.sample_rate;
        *self.channels.lock() = info.channels;
        {
            let mut g = self.graph.lock();
            g.ensure_speaker(info.channels);
            g.set_sample_rate(info.sample_rate);
        }
        *self.host.lock() = Some(host);
        self.running.store(true, Ordering::SeqCst);
        self.live.store(true, Ordering::SeqCst);
        Ok(info)
    }

    pub fn stop(&self) {
        // Silence immediately — even if stream drop is delayed.
        self.live.store(false, Ordering::SeqCst);
        self.running.store(false, Ordering::SeqCst);
        if let Some(host) = self.host.lock().take() {
            host.stop();
        }
        // Leave MIDI open across audio stop so notes can still update the bus;
        // callers that want a full teardown should also call `stop_midi`.
    }

    /// Process a block offline (tests / spice comparison helpers).
    pub fn process_block(&self, frames: usize, channels: usize) -> Vec<f32> {
        let mut out = vec![0.0f32; frames * channels];
        render_graph(&self.graph, &mut out, channels);
        out
    }
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct EngineSnapshot {
    pub sample_rate: f32,
    pub channels: usize,
    pub running: bool,
    pub graph: graph::GraphSnapshot,
}

/// Apply MIDI CC norms (0…1) as real param values. UI knob echo is published
/// earlier in `MidiBus::apply_param_learns` so it never waits on this lock.
fn apply_mapped_midi_params(g: &mut PatchGraph, sets: Vec<MidiParamSet>) -> usize {
    let mut n = 0;
    for s in sets {
        let Some(value) = g.map_midi_norm_param(ModuleId(s.module_id), &s.param, s.value) else {
            continue;
        };
        if g.set_param(ModuleId(s.module_id), &s.param, value).is_ok() {
            n += 1;
        }
    }
    n
}

pub(crate) fn render_graph(graph: &Mutex<PatchGraph>, buffer: &mut [f32], channels: usize) {
    // Drain MIDI *before* taking the graph lock so the CoreMIDI callback's
    // ingress queue never backs up behind a long process_block.
    let bus = global_midi_bus();
    bus.drain_midi();

    // Always take the lock — skipping buffers (try_lock miss) sounded like
    // choppy static on dense songs. UI polls read the lights snapshot instead.
    let mut g = graph.lock();

    // Apply CC→param learns here: the UI used try_lock and starved while the
    // audio thread held this mutex every buffer (knobs only worked when Stop).
    apply_mapped_midi_params(&mut g, bus.poll_param_sets());

    g.process_block(buffer, channels);
    publish_lights(&g);
}
