use crate::module::{Module, ModuleInfo, ModuleLights};
use crate::types::{ModuleId, PortRef, Voltage};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GraphError {
    #[error("unknown module type: {0}")]
    UnknownType(String),
    #[error("unknown module id")]
    UnknownModule,
    #[error("unknown port: {0}")]
    UnknownPort(String),
    #[error("invalid cable")]
    InvalidCable,
    #[error("unknown cable id")]
    UnknownCable,
    #[error("cycle in patch graph")]
    Cycle,
    #[error("cannot remove speaker")]
    ProtectedModule,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Cable {
    pub id: u64,
    pub from: PortRef,
    pub to: PortRef,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModuleInstance {
    pub id: ModuleId,
    pub type_id: String,
    pub x: f32,
    pub y: f32,
    pub params: HashMap<String, f32>,
    #[serde(default)]
    pub info: Option<ModuleInfo>,
    /// Live panel indicators (LEDs / digits). Not restored on apply.
    #[serde(default)]
    pub lights: ModuleLights,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct GraphSnapshot {
    pub modules: Vec<ModuleInstance>,
    pub cables: Vec<Cable>,
    pub next_module_id: u64,
    pub next_cable_id: u64,
}

struct LiveModule {
    id: ModuleId,
    type_id: String,
    x: f32,
    y: f32,
    module: Box<dyn Module>,
    input_buf: Vec<Voltage>,
    output_buf: Vec<Voltage>,
    delayed_out: Vec<Voltage>,
    /// Persistent scratch for `process_connected` (no per-sample alloc).
    connected: Vec<bool>,
}

fn new_live(
    id: ModuleId,
    type_id: String,
    x: f32,
    y: f32,
    module: Box<dyn Module>,
) -> LiveModule {
    let n_in = module.info().inputs.len();
    let n_out = module.info().outputs.len();
    LiveModule {
        id,
        type_id,
        x,
        y,
        module,
        input_buf: vec![0.0; n_in],
        output_buf: vec![0.0; n_out],
        delayed_out: vec![0.0; n_out],
        connected: vec![false; n_in],
    }
}

pub struct PatchGraph {
    modules: HashMap<ModuleId, LiveModule>,
    cables: Vec<Cable>,
    order: Vec<ModuleId>,
    /// Parallel to `order`: incoming cables as (src_order_idx, out_idx, in_idx).
    incoming_by_order: Vec<Vec<(usize, usize, usize)>>,
    /// ModuleId → index in `order` (for feedback / delay-1 detection).
    order_index: HashMap<ModuleId, usize>,
    /// `*mut LiveModule` as usize, parallel to `order`. Rebuilt with routes.
    /// Stored as usize so PatchGraph stays `Send` (audio callback requirement).
    process_ptrs: Vec<usize>,
    spk_order: Option<usize>,
    spk_ch1: usize,
    spk_ch2: Option<usize>,
    spk_ch2_patched: bool,
    next_module_id: u64,
    next_cable_id: u64,
    sample_rate: f32,
    speaker_id: Option<ModuleId>,
    factories: HashMap<String, crate::module::ModuleFactory>,
}

impl PatchGraph {
    pub fn new() -> Self {
        Self {
            modules: HashMap::new(),
            cables: Vec::new(),
            order: Vec::new(),
            incoming_by_order: Vec::new(),
            order_index: HashMap::new(),
            process_ptrs: Vec::new(),
            spk_order: None,
            spk_ch1: 0,
            spk_ch2: None,
            spk_ch2_patched: false,
            next_module_id: 1,
            next_cable_id: 1,
            sample_rate: 48_000.0,
            speaker_id: None,
            factories: HashMap::new(),
        }
    }

    pub fn register_factory(
        &mut self,
        type_id: impl Into<String>,
        factory: crate::module::ModuleFactory,
    ) {
        self.factories.insert(type_id.into(), factory);
    }

    pub fn register_factories(
        &mut self,
        factories: impl IntoIterator<Item = (String, crate::module::ModuleFactory)>,
    ) {
        for (id, f) in factories {
            self.factories.insert(id, f);
        }
    }

    pub fn set_sample_rate(&mut self, sr: f32) {
        self.sample_rate = sr;
        for m in self.modules.values_mut() {
            m.module.set_sample_rate(sr);
        }
    }

    pub fn ensure_speaker(&mut self, channels: usize) {
        if let Some(id) = self.speaker_id {
            if let Some(m) = self.modules.get_mut(&id) {
                m.module.set_param("channels", channels as f32);
                let n_in = m.module.info().inputs.len();
                m.input_buf.resize(n_in, 0.0);
                m.connected.resize(n_in, false);
            }
            self.rebuild_routes();
            return;
        }
        let Some(factory) = self.factories.get("speaker").copied() else {
            return;
        };
        let id = ModuleId(self.next_module_id);
        self.next_module_id += 1;
        let mut module = factory();
        module.set_param("channels", channels as f32);
        module.set_sample_rate(self.sample_rate);
        self.modules.insert(
            id,
            new_live(id, "speaker".into(), 720.0, 56.0, module),
        );
        self.speaker_id = Some(id);
        let _ = self.recompute_order();
    }

    pub fn add_module(&mut self, type_id: &str, x: f32, y: f32) -> Result<ModuleId, GraphError> {
        let factory = self
            .factories
            .get(type_id)
            .copied()
            .ok_or_else(|| GraphError::UnknownType(type_id.into()))?;
        let id = ModuleId(self.next_module_id);
        self.next_module_id += 1;
        let mut module = factory();
        module.set_sample_rate(self.sample_rate);
        self.modules
            .insert(id, new_live(id, type_id.into(), x, y, module));
        self.recompute_order()?;
        Ok(id)
    }

    pub fn set_param(&mut self, id: ModuleId, name: &str, value: f32) -> Result<(), GraphError> {
        {
            let m = self.modules.get_mut(&id).ok_or(GraphError::UnknownModule)?;
            m.module.set_param(name, value);
            if name != "channels" {
                return Ok(());
            }
            let n_in = m.module.info().inputs.len();
            m.input_buf.resize(n_in, 0.0);
            m.connected.resize(n_in, false);
        }
        self.rebuild_routes();
        Ok(())
    }

    pub fn connect(&mut self, from: PortRef, to: PortRef) -> Result<u64, GraphError> {
        self.validate_port(&from, true)?;
        self.validate_port(&to, false)?;
        // One cable per input jack (clicking again replaces / re-patches).
        self.cables.retain(|c| c.to != to);
        let id = self.next_cable_id;
        self.next_cable_id += 1;
        self.cables.push(Cable {
            id,
            from,
            to,
        });
        self.recompute_order()?;
        Ok(id)
    }

    pub fn disconnect(&mut self, cable_id: u64) -> Result<(), GraphError> {
        let before = self.cables.len();
        self.cables.retain(|c| c.id != cable_id);
        if self.cables.len() == before {
            return Err(GraphError::UnknownCable);
        }
        self.recompute_order()?;
        Ok(())
    }

    /// Remove the cable plugged into an input (or leaving an output).
    pub fn disconnect_port(&mut self, port: &PortRef, as_output: bool) -> Result<usize, GraphError> {
        let before = self.cables.len();
        if as_output {
            self.cables.retain(|c| c.from != *port);
        } else {
            self.cables.retain(|c| c.to != *port);
        }
        let removed = before - self.cables.len();
        if removed > 0 {
            self.recompute_order()?;
        }
        Ok(removed)
    }

    fn validate_port(&self, port: &PortRef, as_output: bool) -> Result<(), GraphError> {
        let m = self
            .modules
            .get(&port.module)
            .ok_or(GraphError::UnknownModule)?;
        let list = if as_output {
            &m.module.info().outputs
        } else {
            &m.module.info().inputs
        };
        if list.iter().any(|p| p.name == port.port) {
            Ok(())
        } else {
            Err(GraphError::UnknownPort(port.port.clone()))
        }
    }

    fn recompute_order(&mut self) -> Result<(), GraphError> {
        let mut indeg: HashMap<ModuleId, usize> = HashMap::new();
        let mut adj: HashMap<ModuleId, Vec<ModuleId>> = HashMap::new();
        for id in self.modules.keys() {
            indeg.insert(*id, 0);
            adj.insert(*id, Vec::new());
        }
        for c in &self.cables {
            adj.entry(c.from.module).or_default().push(c.to.module);
            *indeg.entry(c.to.module).or_default() += 1;
        }
        let mut q: VecDeque<ModuleId> = indeg
            .iter()
            .filter(|(_, d)| **d == 0)
            .map(|(id, _)| *id)
            .collect();
        let mut order = Vec::new();
        while let Some(n) = q.pop_front() {
            order.push(n);
            if let Some(targets) = adj.get(&n) {
                for t in targets {
                    let d = indeg.get_mut(t).unwrap();
                    *d -= 1;
                    if *d == 0 {
                        q.push_back(*t);
                    }
                }
            }
        }
        if order.len() != self.modules.len() {
            order = self.modules.keys().copied().collect();
            order.sort_by_key(|id| id.0);
        }
        self.order = order;
        self.rebuild_routes();
        Ok(())
    }

    /// Resolve cable port names → buffer indices. Call whenever topology or
    /// speaker channel layout changes (not on the audio hot path).
    fn rebuild_routes(&mut self) {
        let order_len = self.order.len();
        self.order_index.clear();
        self.order_index.reserve(order_len);
        for (i, id) in self.order.iter().enumerate() {
            self.order_index.insert(*id, i);
        }

        self.incoming_by_order.clear();
        self.incoming_by_order.resize_with(order_len, Vec::new);
        for c in &self.cables {
            let Some(src) = self.modules.get(&c.from.module) else {
                continue;
            };
            let Some(dst) = self.modules.get(&c.to.module) else {
                continue;
            };
            let Some(out_idx) = src
                .module
                .info()
                .outputs
                .iter()
                .position(|p| p.name == c.from.port)
            else {
                continue;
            };
            let Some(in_idx) = dst
                .module
                .info()
                .inputs
                .iter()
                .position(|p| p.name == c.to.port)
            else {
                continue;
            };
            let Some(&dst_i) = self.order_index.get(&c.to.module) else {
                continue;
            };
            let Some(&src_i) = self.order_index.get(&c.from.module) else {
                continue;
            };
            self.incoming_by_order[dst_i].push((src_i, out_idx, in_idx));
        }

        self.spk_ch1 = 0;
        self.spk_ch2 = None;
        self.spk_ch2_patched = false;
        self.spk_order = self.speaker_id.and_then(|sid| self.order_index.get(&sid).copied());
        if let Some(sid) = self.speaker_id {
            if let Some(m) = self.modules.get(&sid) {
                self.spk_ch1 = m
                    .module
                    .info()
                    .inputs
                    .iter()
                    .position(|p| p.name == "ch1")
                    .unwrap_or(0);
                self.spk_ch2 = m
                    .module
                    .info()
                    .inputs
                    .iter()
                    .position(|p| p.name == "ch2");
                if let (Some(idx), Some(spk_i)) = (self.spk_ch2, self.spk_order) {
                    self.spk_ch2_patched = self.incoming_by_order[spk_i]
                        .iter()
                        .any(|(_, _, i)| *i == idx);
                }
            }
        }

        // Cache mut pointers for the sample loop (no HashMap on the hot path).
        self.process_ptrs.clear();
        self.process_ptrs.reserve(order_len);
        for &id in &self.order {
            let m = self.modules.get_mut(&id).expect("order id missing");
            self.process_ptrs.push(m as *mut LiveModule as usize);
        }
    }

    pub fn process_block(&mut self, interleaved: &mut [f32], channels: usize) {
        let frames = if channels == 0 {
            0
        } else {
            interleaved.len() / channels
        };
        if frames == 0 {
            return;
        }

        let order_len = self.process_ptrs.len();
        if order_len == 0 {
            return;
        }
        let spk_order = self.spk_order;
        let spk_ch1 = self.spk_ch1;
        let spk_ch2 = self.spk_ch2;
        let spk_ch2_patched = self.spk_ch2_patched;

        for frame in 0..frames {
            for i in 0..order_len {
                // SAFETY: process_ptrs are unique entries into `modules`, rebuilt
                // whenever the map changes. src_i != i for normal cables; feedback
                // reads delayed_out which is not written this iteration.
                let dst = unsafe { &mut *(self.process_ptrs[i] as *mut LiveModule) };
                dst.input_buf.fill(0.0);
                dst.connected.fill(false);

                let routes = &self.incoming_by_order[i];
                for &(src_i, out_idx, in_idx) in routes {
                    let src = unsafe { &*(self.process_ptrs[src_i] as *const LiveModule) };
                    let v = if src_i < i {
                        src.output_buf.get(out_idx).copied().unwrap_or(0.0)
                    } else {
                        src.delayed_out.get(out_idx).copied().unwrap_or(0.0)
                    };
                    if let Some(slot) = dst.input_buf.get_mut(in_idx) {
                        *slot += v;
                    }
                    if let Some(flag) = dst.connected.get_mut(in_idx) {
                        *flag = true;
                    }
                }

                let LiveModule {
                    module,
                    input_buf,
                    output_buf,
                    delayed_out,
                    connected,
                    ..
                } = dst;
                let n_out = output_buf.len();
                module.process_connected(input_buf, connected, output_buf);
                if output_buf.len() != n_out {
                    output_buf.resize(n_out, 0.0);
                }
                if delayed_out.len() != n_out {
                    delayed_out.resize(n_out, 0.0);
                }
                delayed_out.copy_from_slice(output_buf);
            }

            if let Some(spk_i) = spk_order {
                let m = unsafe { &*(self.process_ptrs[spk_i] as *const LiveModule) };
                let ch1 = m.input_buf.get(spk_ch1).copied().unwrap_or(0.0);
                let ch2 = if spk_ch2_patched {
                    spk_ch2
                        .and_then(|i| m.input_buf.get(i).copied())
                        .unwrap_or(0.0)
                } else {
                    ch1
                };
                for ch in 0..channels {
                    let v = match ch {
                        0 => ch1,
                        1 => ch2,
                        _ => 0.0,
                    };
                    // Fast soft clip (~±5V → ±1). Avoid tanh on the hot path.
                    let x = v * 0.2;
                    interleaved[frame * channels + ch] = x / (1.0 + x.abs());
                }
            }
        }
    }

    pub fn snapshot(&self) -> GraphSnapshot {
        let modules = self
            .modules
            .values()
            .map(|m| {
                let params: HashMap<String, f32> = m
                    .module
                    .info()
                    .params
                    .iter()
                    .filter_map(|p| m.module.get_param(&p.name).map(|v| (p.name.clone(), v)))
                    .collect();
                ModuleInstance {
                    id: m.id,
                    type_id: m.type_id.clone(),
                    x: m.x,
                    y: m.y,
                    params,
                    // UI resolves ports from the catalog — avoid cloning ModuleInfo
                    // on every snapshot (was starving the audio callback).
                    info: None,
                    lights: m.module.lights(),
                }
            })
            .collect();
        GraphSnapshot {
            modules,
            cables: self.cables.clone(),
            next_module_id: self.next_module_id,
            next_cable_id: self.next_cable_id,
        }
    }

    /// Cheap poll for panel LEDs/digits — holds the graph lock briefly.
    pub fn poll_lights(&self) -> Vec<(ModuleId, ModuleLights)> {
        self.modules
            .values()
            .map(|m| (m.id, m.module.lights()))
            .collect()
    }

    pub fn apply_snapshot(&mut self, snap: GraphSnapshot) -> Result<(), GraphError> {
        let speaker_channels = self
            .speaker_id
            .and_then(|id| self.modules.get(&id))
            .and_then(|m| m.module.get_param("channels"))
            .unwrap_or(2.0) as usize;

        self.modules.clear();
        self.cables.clear();
        self.speaker_id = None;
        self.next_module_id = snap.next_module_id.max(1);
        self.next_cable_id = snap.next_cable_id.max(1);

        for inst in snap.modules {
            let factory = self
                .factories
                .get(&inst.type_id)
                .copied()
                .ok_or_else(|| GraphError::UnknownType(inst.type_id.clone()))?;
            let mut module = factory();
            module.set_sample_rate(self.sample_rate);
            for (k, v) in &inst.params {
                module.set_param(k, *v);
            }
            if inst.type_id == "speaker" {
                module.set_param("channels", speaker_channels as f32);
                self.speaker_id = Some(inst.id);
            }
            self.modules.insert(
                inst.id,
                new_live(inst.id, inst.type_id, inst.x, inst.y, module),
            );
            if inst.id.0 >= self.next_module_id {
                self.next_module_id = inst.id.0 + 1;
            }
        }
        if self.speaker_id.is_none() {
            self.ensure_speaker(speaker_channels);
        }
        // Drop cables that point at missing modules/ports (stale presets).
        self.cables = snap
            .cables
            .into_iter()
            .filter(|c| self.cable_endpoints_ok(c))
            .collect();
        self.recompute_order()?;
        Ok(())
    }

    fn cable_endpoints_ok(&self, c: &Cable) -> bool {
        let Some(src) = self.modules.get(&c.from.module) else {
            return false;
        };
        let Some(dst) = self.modules.get(&c.to.module) else {
            return false;
        };
        src.module
            .info()
            .outputs
            .iter()
            .any(|p| p.name == c.from.port)
            && dst
                .module
                .info()
                .inputs
                .iter()
                .any(|p| p.name == c.to.port)
    }

    /// Clear per-module DSP state after a patch load or master rest.
    pub fn reset_modules(&mut self) {
        for m in self.modules.values_mut() {
            m.module.reset();
            m.input_buf.fill(0.0);
            m.output_buf.fill(0.0);
            m.delayed_out.fill(0.0);
        }
    }

    pub fn catalog(&self) -> Vec<ModuleInfo> {
        let mut infos = Vec::new();
        for factory in self.factories.values() {
            let m = factory();
            infos.push(m.info().clone());
        }
        infos.sort_by(|a, b| a.type_id.cmp(&b.type_id));
        infos
    }

    pub fn update_module_position(&mut self, id: ModuleId, x: f32, y: f32) -> Result<(), GraphError> {
        let m = self.modules.get_mut(&id).ok_or(GraphError::UnknownModule)?;
        m.x = x;
        m.y = y;
        Ok(())
    }

    /// Remove a module and any cables attached to it. The speaker cannot be removed.
    pub fn remove_module(&mut self, id: ModuleId) -> Result<(), GraphError> {
        if self.speaker_id == Some(id) {
            return Err(GraphError::ProtectedModule);
        }
        let m = self.modules.get(&id).ok_or(GraphError::UnknownModule)?;
        if m.type_id == "speaker" {
            return Err(GraphError::ProtectedModule);
        }
        self.cables
            .retain(|c| c.from.module != id && c.to.module != id);
        self.modules.remove(&id).ok_or(GraphError::UnknownModule)?;
        self.recompute_order()?;
        Ok(())
    }
}

impl Default for PatchGraph {
    fn default() -> Self {
        Self::new()
    }
}
