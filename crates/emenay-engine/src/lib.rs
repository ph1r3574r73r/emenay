//! Real-time patch graph and audio device host for emenay.

mod audio;
mod graph;
pub mod midi;
pub mod module;
mod types;

pub use audio::{AudioHost, DeviceInfo, HostError};
pub use graph::{Cable, GraphError, GraphSnapshot, ModuleInstance, PatchGraph};
pub use midi::{global_midi_bus, MidiBus, MidiDeviceInfo, MidiError, MidiHost};
pub use module::{
    Module, ModuleFactory, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
pub use types::{ModuleId, PortRef, Voltage};

use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

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

    /// Open a USB / interface MIDI input and feed the global MidiCv bus.
    pub fn start_midi(&self, device_name: Option<String>) -> Result<MidiDeviceInfo, MidiError> {
        self.stop_midi();
        let bus = global_midi_bus();
        let host = MidiHost::start(device_name, bus)?;
        let info = host.info.clone();
        *self.midi_host.lock() = Some(host);
        Ok(info)
    }

    pub fn stop_midi(&self) {
        let _ = self.midi_host.lock().take();
        global_midi_bus().all_notes_off(None);
    }

    pub fn midi_device(&self) -> Option<MidiDeviceInfo> {
        self.midi_host.lock().as_ref().map(|h| h.info.clone())
    }

    pub fn snapshot(&self) -> EngineSnapshot {
        EngineSnapshot {
            sample_rate: *self.sample_rate.lock(),
            channels: *self.channels.lock(),
            running: self.running.load(Ordering::SeqCst),
            graph: self.graph.lock().snapshot(),
        }
    }

    /// Lightweight LED/digit poll for the UI. Uses try_lock so the UI never
    /// stalls the audio callback (skipped frames just keep the last lights).
    pub fn poll_lights(&self) -> Vec<(ModuleId, module::ModuleLights)> {
        match self.graph.try_lock() {
            Some(g) => g.poll_lights(),
            None => Vec::new(),
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
        self.graph.lock().process_block(&mut out, channels);
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

pub(crate) fn render_graph(graph: &Mutex<PatchGraph>, buffer: &mut [f32], channels: usize) {
    // Always take the lock — skipping buffers (try_lock miss) sounded like
    // choppy static on dense songs. UI polls use try_lock instead.
    graph.lock().process_block(buffer, channels);
}
