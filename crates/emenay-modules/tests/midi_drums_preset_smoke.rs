use emenay_engine::Engine;
use emenay_modules::default_graph;

#[test]
fn midi_poly_twin_clock_makes_audio() {
    let engine = Engine::with_graph(default_graph());
    // Mirror builtin-midi-poly-twin topology (speaker=1).
    let poly = engine.add_module("polysynth", 0.0, 0.0).unwrap();
    let mixer = engine.add_module("erica_mixer", 0.0, 0.0).unwrap();
    let reverb = engine.add_module("reverb", 0.0, 0.0).unwrap();
    let out = engine.add_module("erica_output", 0.0, 0.0).unwrap();
    let clock = engine.add_module("fm_clock", 0.0, 0.0).unwrap();
    let mult = engine.add_module("clk_mult", 0.0, 0.0).unwrap();
    let div = engine.add_module("divider", 0.0, 0.0).unwrap();
    let twin_kit = engine.add_module("twin", 0.0, 0.0).unwrap();
    let twin_hh = engine.add_module("twin", 0.0, 0.0).unwrap();

    engine.set_param(poly, "level", 0.78).unwrap();
    engine.set_param(clock, "bpm", 118.0).unwrap();
    engine.set_param(clock, "pw", 0.12).unwrap();
    engine.set_param(mult, "pw", 0.18).unwrap();
    engine.set_param(div, "pw", 0.35).unwrap();
    engine.set_param(twin_kit, "mode_a", 3.0).unwrap();
    engine.set_param(twin_kit, "mode_b", 4.0).unwrap();
    engine.set_param(twin_kit, "split", 1.0).unwrap();
    engine.set_param(twin_kit, "level", 0.95).unwrap();
    engine.set_param(twin_hh, "mode_a", 5.0).unwrap();
    engine.set_param(twin_hh, "mode_b", 6.0).unwrap();
    engine.set_param(twin_hh, "split", 1.0).unwrap();
    engine.set_param(twin_hh, "level", 0.7).unwrap();
    engine.set_param(mixer, "ch1", 0.82).unwrap();
    engine.set_param(mixer, "ch2", 0.72).unwrap();
    engine.set_param(mixer, "ch3", 0.55).unwrap();
    engine.set_param(mixer, "mute1", 0.0).unwrap();
    engine.set_param(mixer, "mute2", 0.0).unwrap();
    engine.set_param(mixer, "mute3", 0.0).unwrap();
    engine.set_param(mixer, "mute_mix", 0.0).unwrap();

    engine.connect(poly, "out".into(), mixer, "in1".into()).unwrap();
    engine.connect(clock, "clk1".into(), mult, "clock".into()).unwrap();
    engine.connect(clock, "clk2".into(), div, "clock".into()).unwrap();
    engine
        .connect(mult, "x1".into(), twin_kit, "trig_a".into())
        .unwrap();
    engine
        .connect(div, "d2".into(), twin_kit, "trig_b".into())
        .unwrap();
    engine
        .connect(mult, "x4".into(), twin_hh, "trig_a".into())
        .unwrap();
    engine
        .connect(mult, "x2".into(), twin_hh, "trig_b".into())
        .unwrap();
    engine
        .connect(twin_kit, "mix".into(), mixer, "in2".into())
        .unwrap();
    engine
        .connect(twin_hh, "mix".into(), mixer, "in3".into())
        .unwrap();
    engine.connect(mixer, "out".into(), reverb, "in_l".into()).unwrap();
    engine
        .connect(mixer, "out2".into(), reverb, "in_r".into())
        .unwrap();
    engine
        .connect(reverb, "out_l".into(), out, "in_l".into())
        .unwrap();
    engine
        .connect(reverb, "out_r".into(), out, "in_r".into())
        .unwrap();

    let snap = engine.snapshot();
    let spk = snap
        .graph
        .modules
        .iter()
        .find(|m| m.type_id == "speaker")
        .map(|m| m.id)
        .expect("speaker");
    engine
        .connect(out, "line_l".into(), spk, "ch1".into())
        .unwrap();
    engine
        .connect(out, "line_r".into(), spk, "ch2".into())
        .unwrap();

    // ~1 second @ 48k — Twin drums alone must produce energy without MIDI.
    let audio = engine.process_block(48_000, 2);
    let energy: f32 = audio.iter().map(|s| s * s).sum::<f32>() / audio.len() as f32;
    assert!(
        energy > 1e-6,
        "expected Twin drum energy without MIDI, got {energy}"
    );
}
