use emenay_engine::{Engine, EngineSnapshot, ModuleId, ModuleLights};
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
                .map(|x| MidiDeviceDto { name: x.name })
                .collect()
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn start_midi(
    state: State<'_, Mutex<AppState>>,
    device: Option<String>,
) -> Result<MidiDeviceDto, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine
        .start_midi(device)
        .map(|i| MidiDeviceDto { name: i.name })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_midi(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.engine.stop_midi();
    Ok(())
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
    let s = state.lock().map_err(|e| e.to_string())?;
    Ok(s.engine
        .poll_lights()
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
            stop_midi,
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
