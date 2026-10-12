use emenay_engine::{
    global_midi_bus, Engine, EngineSnapshot, MidiActionBindings, MidiAppAction, MidiBinding,
    MidiLearnEvent, MidiParamLearn, ModuleId, ModuleLights,
};
use emenay_modules::default_graph;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

struct AppState {
    engine: Engine,
}

#[derive(Serialize)]
struct DeviceDto {
    name: String,
    sample_rate: f32,
    channels: usize,
}

#[derive(Serialize)]
struct MidiDeviceDto {
    name: String,
    #[serde(default)]
    open_ports: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct MidiBindingDto {
    kind: String,
    n: u8,
}

#[derive(Serialize, Deserialize, Clone)]
struct MidiActionBindingsDto {
    start: MidiBindingDto,
    stop: MidiBindingDto,
    rest: MidiBindingDto,
    preset_prev: MidiBindingDto,
    preset_next: MidiBindingDto,
    preset_save: MidiBindingDto,
    panic: MidiBindingDto,
}

#[derive(Serialize, Deserialize, Clone)]
struct MidiParamLearnDto {
    cc: u8,
    module_id: u64,
    param: String,
}

#[derive(Serialize)]
struct MidiLearnEventDto {
    is_cc: bool,
    number: u8,
    value: u8,
}

#[derive(Serialize)]
struct MidiParamSetDto {
    module_id: u64,
    param: String,
    value: f32,
}

#[derive(Serialize)]
struct MidiLearnStatusDto {
    armed: bool,
    last_midi: Option<String>,
    /// Last CC/note seen (for “Use last” even when Learn wasn’t armed).
    last_event: Option<MidiLearnEventDto>,
    event: Option<MidiLearnEventDto>,
    /// Mapped param writes from hardware knobs — drive faceplate UI knobs.
    params: Vec<MidiParamSetDto>,
}

fn binding_to_dto(b: MidiBinding) -> MidiBindingDto {
    match b {
        MidiBinding::None => MidiBindingDto {
            kind: "none".into(),
            n: 0,
        },
        MidiBinding::Cc(n) => MidiBindingDto {
            kind: "cc".into(),
            n,
        },
        MidiBinding::Note(n) => MidiBindingDto {
            kind: "note".into(),
            n,
        },
    }
}

fn dto_to_binding(b: &MidiBindingDto) -> MidiBinding {
    match b.kind.as_str() {
        "none" | "off" | "unbound" => MidiBinding::None,
        "note" => MidiBinding::Note(b.n.min(127)),
        _ => MidiBinding::Cc(b.n.min(127)),
    }
}

fn bindings_to_dto(b: MidiActionBindings) -> MidiActionBindingsDto {
    MidiActionBindingsDto {
        start: binding_to_dto(b.start),
        stop: binding_to_dto(b.stop),
        rest: binding_to_dto(b.rest),
        preset_prev: binding_to_dto(b.preset_prev),
        preset_next: binding_to_dto(b.preset_next),
        preset_save: binding_to_dto(b.preset_save),
        panic: binding_to_dto(b.panic),
    }
}

fn dto_to_bindings(b: MidiActionBindingsDto) -> MidiActionBindings {
    MidiActionBindings {
        start: dto_to_binding(&b.start),
        stop: dto_to_binding(&b.stop),
        rest: dto_to_binding(&b.rest),
        preset_prev: dto_to_binding(&b.preset_prev),
        preset_next: dto_to_binding(&b.preset_next),
        preset_save: dto_to_binding(&b.preset_save),
        panic: dto_to_binding(&b.panic),
    }
}

fn action_name(a: MidiAppAction) -> &'static str {
    match a {
        MidiAppAction::Start => "Start",
        MidiAppAction::Stop => "Stop",
        MidiAppAction::Rest => "Rest",
        MidiAppAction::PresetPrev => "PresetPrev",
        MidiAppAction::PresetNext => "PresetNext",
        MidiAppAction::PresetSave => "PresetSave",
        MidiAppAction::Panic => "Panic",
    }
}

fn learn_to_dto(e: MidiLearnEvent) -> MidiLearnEventDto {
    MidiLearnEventDto {
        is_cc: e.is_cc,
        number: e.number,
        value: e.value,
    }
}

#[tauri::command]
fn list_devices() -> Result<Vec<DeviceDto>, String> {
    Engine::list_devices()
        .map(|d| {
            d.into_iter()
                .map(|x| DeviceDto {
                    name: x.name,
                    sample_rate: x.sample_rate,
                    channels: x.channels,
                })
                .collect()
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_midi_devices() -> Result<Vec<MidiDeviceDto>, String> {
    Engine::list_midi_devices()
        .map(|d| {
            d.into_iter()
                .map(|x| MidiDeviceDto {
                    name: x.name,
                    open_ports: vec![],
                })
                .collect()
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
fn start_midi(
    state: State<'_, Mutex<AppState>>,
    device: Option<String>,
    force: Option<bool>,
) -> Result<MidiDeviceDto, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let force = force.unwrap_or(false);
    let info = s
        .engine
        .start_midi_with(device, force)
        .map_err(|e| e.to_string())?;
    let open_ports = s.engine.midi_device_ports().unwrap_or_default();
    Ok(MidiDeviceDto {
        name: info.name,
        open_ports,
    })
}

/// Soft reconnect: reopen only if ports went stale / missing.
#[tauri::command]
fn ensure_midi(
    state: State<'_, Mutex<AppState>>,
    device: Option<String>,
) -> Result<MidiDeviceDto, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let info = s.engine.ensure_midi(device).map_err(|e| e.to_string())?;
    let open_ports = s.engine.midi_device_ports().unwrap_or_default();
    Ok(MidiDeviceDto {
        name: info.name,
        open_ports,
    })
}

#[tauri::command]
fn midi_connection_info(
    state: State<'_, Mutex<AppState>>,
) -> Result<MidiDeviceDto, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let name = s
        .engine
        .midi_device()
        .map(|d| d.name)
        .unwrap_or_default();
    let open_ports = s.engine.midi_device_ports().unwrap_or_default();
    let last = s.engine.last_midi_message();
    Ok(MidiDeviceDto {
        name: if name.is_empty() {
            last.unwrap_or_else(|| "(not connected)".into())
        } else {
            name
        },
        open_ports,
    })
}

#[tauri::command]
fn stop_midi(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine.stop_midi();
    Ok(())
}

#[tauri::command]
fn poll_midi_actions(state: State<'_, Mutex<AppState>>) -> Result<Vec<String>, String> {
    // Always drain on the UI poll. The audio callback also drains; whichever
    // side wins `mem::take`s the ingress bytes. Skipping drain while LIVE was
    // dropping transport buttons and faceplate knob echoes.
    let bus = global_midi_bus();
    bus.drain_midi();
    if let Ok(s) = state.try_lock() {
        let _ = s.engine.apply_midi_param_sets();
    }
    let actions = bus
        .poll_actions()
        .into_iter()
        .map(|a| action_name(a).to_string())
        .collect();
    Ok(actions)
}

#[tauri::command]
fn set_midi_action_bindings(
    state: State<'_, Mutex<AppState>>,
    bindings: MidiActionBindingsDto,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine
        .set_midi_action_bindings(dto_to_bindings(bindings));
    Ok(())
}

#[tauri::command]
fn get_midi_action_bindings(
    state: State<'_, Mutex<AppState>>,
) -> Result<MidiActionBindingsDto, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(bindings_to_dto(s.engine.midi_action_bindings()))
}

#[tauri::command]
fn set_midi_param_learns(
    state: State<'_, Mutex<AppState>>,
    learns: Vec<MidiParamLearnDto>,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine.set_midi_param_learns(
        learns
            .into_iter()
            .map(|l| MidiParamLearn {
                cc: l.cc,
                module_id: l.module_id,
                param: l.param,
            })
            .collect(),
    );
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
fn arm_midi_learn(
    state: State<'_, Mutex<AppState>>,
    armed: bool,
    cc_only: Option<bool>,
    ccOnly: Option<bool>,
) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let only = ccOnly.or(cc_only).unwrap_or(false);
    s.engine.arm_midi_learn_filtered(armed, only);
    Ok(())
}

#[tauri::command]
fn take_midi_learn_event(
    state: State<'_, Mutex<AppState>>,
) -> Result<Option<MidiLearnEventDto>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(s.engine.take_midi_learn_event().map(learn_to_dto))
}

#[tauri::command]
fn poll_midi_learn_status(
    state: State<'_, Mutex<AppState>>,
) -> Result<MidiLearnStatusDto, String> {
    let bus = global_midi_bus();
    bus.drain_midi();
    if let Ok(s) = state.try_lock() {
        let _ = s.engine.apply_midi_param_sets();
    }
    let params = bus
        .poll_ui_params()
        .into_iter()
        .map(|p| MidiParamSetDto {
            module_id: p.module_id,
            param: p.param,
            value: p.value,
        })
        .collect();
    Ok(MidiLearnStatusDto {
        armed: bus.learn_armed(),
        last_midi: bus.last_midi_message(),
        last_event: bus.last_learnable_event().map(learn_to_dto),
        event: bus.take_learn_event().map(learn_to_dto),
        params,
    })
}

#[tauri::command]
fn catalog(state: State<'_, Mutex<AppState>>) -> Result<serde_json::Value, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    serde_json::to_value(s.engine.catalog()).map_err(|e| e.to_string())
}

#[tauri::command]
fn snapshot(state: State<'_, Mutex<AppState>>) -> Result<EngineSnapshot, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(s.engine.snapshot())
}

#[derive(Serialize)]
struct LightsDto {
    id: u64,
    lights: ModuleLights,
}

/// Fast path for LED animation — does not clone the full patch graph.
#[tauri::command]
fn poll_lights(state: State<'_, Mutex<AppState>>) -> Result<Vec<LightsDto>, String> {
    // Prefer try_lock: while Start holds AppState during device open, still
    // serve the last published lights snapshot via a direct engine path.
    let lights = if let Ok(s) = state.try_lock() {
        s.engine.poll_lights()
    } else {
        // AppState busy — published snapshot is still valid while running.
        emenay_engine::Engine::published_lights()
    };
    Ok(lights
        .into_iter()
        .map(|(id, lights)| LightsDto { id: id.0, lights })
        .collect())
}

#[tauri::command]
fn start_audio(state: State<'_, Mutex<AppState>>, device: Option<String>) -> Result<DeviceDto, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine
        .start(device)
        .map(|i| DeviceDto {
            name: i.name,
            sample_rate: i.sample_rate,
            channels: i.channels,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_audio(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine.stop();
    Ok(())
}

/// Mute briefly and reset all module DSP (safe between preset loads / stuck notes).
#[tauri::command]
fn master_rest(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine.master_rest();
    Ok(())
}

#[derive(Deserialize)]
struct AddModuleArgs {
    type_id: String,
    x: f32,
    y: f32,
}

#[tauri::command]
fn add_module(state: State<'_, Mutex<AppState>>, args: AddModuleArgs) -> Result<u64, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine
        .add_module(&args.type_id, args.x, args.y)
        .map(|id| id.0)
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct ConnectArgs {
    from_module: u64,
    from_port: String,
    to_module: u64,
    to_port: String,
}

#[tauri::command]
fn connect(state: State<'_, Mutex<AppState>>, args: ConnectArgs) -> Result<u64, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine
        .connect(
            ModuleId(args.from_module),
            args.from_port,
            ModuleId(args.to_module),
            args.to_port,
        )
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct DisconnectArgs {
    cable_id: u64,
}

#[tauri::command]
fn disconnect(state: State<'_, Mutex<AppState>>, args: DisconnectArgs) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine.disconnect(args.cable_id).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct ParamArgs {
    module_id: u64,
    name: String,
    value: f32,
}

#[tauri::command]
fn set_param(state: State<'_, Mutex<AppState>>, args: ParamArgs) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine
        .set_param(ModuleId(args.module_id), &args.name, args.value)
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct MoveArgs {
    module_id: u64,
    x: f32,
    y: f32,
}

#[tauri::command]
fn move_module(state: State<'_, Mutex<AppState>>, args: MoveArgs) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine
        .move_module(ModuleId(args.module_id), args.x, args.y)
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct RemoveModuleArgs {
    module_id: u64,
}

#[tauri::command]
fn remove_module(state: State<'_, Mutex<AppState>>, args: RemoveModuleArgs) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine
        .remove_module(ModuleId(args.module_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn apply_graph(state: State<'_, Mutex<AppState>>, snap: EngineSnapshot) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine.apply_graph(snap.graph).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine = Engine::with_graph(default_graph());
    tauri::Builder::default()
        .manage(Mutex::new(AppState { engine }))
        .invoke_handler(tauri::generate_handler![
            list_devices,
            list_midi_devices,
            start_midi,
            ensure_midi,
            stop_midi,
            midi_connection_info,
            poll_midi_actions,
            set_midi_action_bindings,
            get_midi_action_bindings,
            set_midi_param_learns,
            arm_midi_learn,
            take_midi_learn_event,
            poll_midi_learn_status,
            catalog,
            snapshot,
            poll_lights,
            start_audio,
            stop_audio,
            master_rest,
            add_module,
            connect,
            disconnect,
            set_param,
            move_module,
            remove_module,
            apply_graph,
        ])
        .run(tauri::generate_context!())
        .expect("error while running emenay");
}
