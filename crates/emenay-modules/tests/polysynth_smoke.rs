//! PolySynth + MIDI bus chord smoke.

use emenay_engine::midi::global_midi_bus;
use emenay_engine::module::Module;
use emenay_modules::PolySynth;

#[test]
fn chord_opens_multiple_voices() {
    let bus = global_midi_bus();
    bus.all_notes_off(None);
    bus.set_poly_voices(4);

    bus.handle_message(&[0x90, 60, 100]);
    bus.handle_message(&[0x90, 64, 110]);
    bus.handle_message(&[0x90, 67, 90]);

    let mut synth = PolySynth::new();
    synth.set_sample_rate(48_000.0);
    synth.set_param("level", 1.0);
    synth.set_param("attack", 0.001);
    synth.set_param("release", 0.2);

    let mut peak = 0.0_f32;
    for _ in 0..2048 {
        let mut o = [0.0, 0.0];
        synth.process(&[0.0, 0.0], &mut o);
        peak = peak.max(o[0].abs()).max(o[1].abs());
    }
    assert!(peak > 0.2, "chord should produce audible output, peak={peak}");

    let lights = synth.lights();
    let mut lit = 0;
    for i in 1..=4 {
        if lights.values.get(&format!("v{i}")).copied().unwrap_or(0.0) > 0.5 {
            lit += 1;
        }
    }
    assert_eq!(lit, 3, "three keys → three voice LEDs");

    bus.handle_message(&[0x80, 60, 0]);
    bus.handle_message(&[0x80, 64, 0]);
    bus.handle_message(&[0x80, 67, 0]);
    // Drain release
    for _ in 0..48_000 {
        let mut o = [0.0, 0.0];
        synth.process(&[0.0, 0.0], &mut o);
    }
    let lights = synth.lights();
    for i in 1..=4 {
        let v = lights.values.get(&format!("v{i}")).copied().unwrap_or(0.0);
        assert!(v < 0.2, "voice {i} should be dark after release, got {v}");
    }
}
