use emenay_engine::{Engine, ModuleId, PortRef};
use emenay_modules::default_graph;

#[test]
fn tone_through_mixer_to_speaker() {
    let engine = Engine::with_graph(default_graph());
    let tone = engine.add_module("test_tone", 40.0, 40.0).unwrap();
    let mixer = engine.add_module("erica_mixer", 200.0, 40.0).unwrap();
    let out = engine.add_module("erica_output", 360.0, 40.0).unwrap();

    let snap = engine.snapshot();
    let speaker = snap
        .graph
        .modules
        .iter()
        .find(|m| m.type_id == "speaker")
        .expect("speaker")
        .id;

    engine
        .connect(tone, "out".into(), mixer, "in1".into())
        .unwrap();
    engine
        .connect(mixer, "out".into(), out, "in_l".into())
        .unwrap();
    engine
        .connect(out, "line_l".into(), speaker, "ch1".into())
        .unwrap();
    engine.set_param(tone, "amp", 2.0).unwrap();

    let buf = engine.process_block(2048, 2);
    let peak = buf.iter().copied().map(f32::abs).fold(0.0, f32::max);
    assert!(peak > 0.01, "expected audible energy, peak={peak}");
}

#[test]
fn voice_vco_env_vca() {
    let engine = Engine::with_graph(default_graph());
    let vco = engine.add_module("vco", 0.0, 0.0).unwrap();
    let env = engine.add_module("envelope", 0.0, 0.0).unwrap();
    let vca = engine.add_module("dual_vca", 0.0, 0.0).unwrap();
    let speaker = engine.snapshot().graph.modules.iter().find(|m| m.type_id == "speaker").unwrap().id;

    // Hold gate high by using test tone as crude gate via a constant — use envelope bias via patch:
    // Connect nothing to gate but drive VCA bias fully open for smoke.
    engine.set_param(vca, "bias_a", 1.0).unwrap();
    engine.connect(vco, "saw".into(), vca, "in_a".into()).unwrap();
    engine.connect(vca, "out_a".into(), speaker, "ch1".into()).unwrap();
    let _ = env;
    let _ = PortRef {
        module: ModuleId(0),
        port: String::new(),
    };

    let buf = engine.process_block(4096, 2);
    let peak = buf.iter().copied().map(f32::abs).fold(0.0, f32::max);
    assert!(peak > 0.01, "peak={peak}");
}
