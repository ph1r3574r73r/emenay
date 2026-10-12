use emenay_engine::Engine;
use emenay_modules::default_graph;

#[test]
fn beat_box_clock_makes_audio() {
    let engine = Engine::with_graph(default_graph());
    let clock = engine.add_module("fm_clock", 0.0, 0.0).unwrap();
    let mult = engine.add_module("clk_mult", 0.0, 0.0).unwrap();
    let beat = engine.add_module("beat", 0.0, 0.0).unwrap();

    engine.set_param(clock, "bpm", 122.0).unwrap();
    engine.set_param(clock, "pw", 0.12).unwrap();
    engine.set_param(mult, "pw", 0.2).unwrap();
    engine.set_param(beat, "pattern", 0.0).unwrap();
    engine.set_param(beat, "level", 1.0).unwrap();
    engine.set_param(beat, "bd_on", 1.0).unwrap();
    engine.set_param(beat, "sd_on", 1.0).unwrap();

    engine.connect(clock, "clk1".into(), mult, "clock".into()).unwrap();
    engine.connect(mult, "x4".into(), beat, "clock".into()).unwrap();

    let snap = engine.snapshot();
    let spk = snap
        .graph
        .modules
        .iter()
        .find(|m| m.type_id == "speaker")
        .map(|m| m.id)
        .expect("speaker");
    engine
        .connect(beat, "out_l".into(), spk, "ch1".into())
        .unwrap();
    engine
        .connect(beat, "out_r".into(), spk, "ch2".into())
        .unwrap();

    let out = engine.process_block(48_000, 2);
    let energy: f32 = out.iter().map(|s| s * s).sum::<f32>() / out.len() as f32;
    assert!(
        energy > 1e-5,
        "expected Beat audio from clock, got {energy}"
    );
}
