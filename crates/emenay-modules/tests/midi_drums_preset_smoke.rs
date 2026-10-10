use emenay_engine::Engine;
use emenay_modules::default_graph;

#[test]
fn midi_facets_drums_clock_makes_audio() {
    let engine = Engine::with_graph(default_graph());
    // Mirror builtin-midi-facets-drums topology (ids match preset packing: speaker=1).
    let midi = engine.add_module("midi_cv", 0.0, 0.0).unwrap();
    let facets = engine.add_module("facets", 0.0, 0.0).unwrap();
    let env = engine.add_module("envelope", 0.0, 0.0).unwrap();
    let vca = engine.add_module("dual_vca", 0.0, 0.0).unwrap();
    let mixer = engine.add_module("erica_mixer", 0.0, 0.0).unwrap();
    let clock = engine.add_module("fm_clock", 0.0, 0.0).unwrap();
    let mult = engine.add_module("clk_mult", 0.0, 0.0).unwrap();
    let div = engine.add_module("divider", 0.0, 0.0).unwrap();
    let drums = engine.add_module("drums", 0.0, 0.0).unwrap();

    engine.set_param(midi, "omni", 1.0).unwrap();
    engine.set_param(facets, "level", 0.95).unwrap();
    engine.set_param(clock, "bpm", 120.0).unwrap();
    engine.set_param(clock, "pw", 0.12).unwrap();
    engine.set_param(mult, "pw", 0.18).unwrap();
    engine.set_param(div, "pw", 0.35).unwrap();
    engine.set_param(drums, "level", 0.95).unwrap();
    engine.set_param(mixer, "ch1", 0.85).unwrap();
    engine.set_param(mixer, "ch2", 0.8).unwrap();
    engine.set_param(mixer, "mute1", 0.0).unwrap();
    engine.set_param(mixer, "mute2", 0.0).unwrap();
    engine.set_param(mixer, "mute_mix", 0.0).unwrap();

    engine.connect(midi, "cv1".into(), facets, "v_oct".into()).unwrap();
    engine.connect(midi, "gate1".into(), env, "gate".into()).unwrap();
    engine.connect(facets, "out".into(), vca, "in_a".into()).unwrap();
    engine.connect(env, "env".into(), vca, "cv_a".into()).unwrap();
    engine.connect(clock, "clk1".into(), mult, "clock".into()).unwrap();
    engine.connect(clock, "clk2".into(), div, "clock".into()).unwrap();
    engine.connect(mult, "x1".into(), drums, "bd".into()).unwrap();
    engine.connect(div, "d2".into(), drums, "sd".into()).unwrap();
    engine.connect(mult, "x4".into(), drums, "ch".into()).unwrap();
    engine.connect(mult, "x2".into(), drums, "oh".into()).unwrap();
    engine.connect(vca, "out_a".into(), mixer, "in1".into()).unwrap();
    engine.connect(drums, "mix".into(), mixer, "in2".into()).unwrap();

    // Find speaker and patch mixer into it.
    let snap = engine.snapshot();
    let spk = snap
        .graph
        .modules
        .iter()
        .find(|m| m.type_id == "speaker")
        .map(|m| m.id)
        .expect("speaker");
    engine
        .connect(mixer, "out".into(), spk, "ch1".into())
        .unwrap();
    engine
        .connect(mixer, "out2".into(), spk, "ch2".into())
        .unwrap();

    // ~1 second @ 48k — drums alone must produce energy without MIDI.
    let out = engine.process_block(48_000, 2);
    let energy: f32 = out.iter().map(|s| s * s).sum::<f32>() / out.len() as f32;
    assert!(
        energy > 1e-6,
        "expected drum energy without MIDI, got {energy}"
    );
}
