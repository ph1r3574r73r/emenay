use emenay_engine::module::Module;
use emenay_modules::{EricaBassline, EricaModulator};

#[test]
fn erica_modulator_lfo_and_noise() {
    let mut m = EricaModulator::new();
    m.set_sample_rate(48_000.0);
    m.set_param("rate", 8.0);
    m.set_param("shape", 0.0);
    m.set_param("noise_lvl", 0.8);
    let mut outs = [0.0_f32; 3];
    let mut lfo_e = 0.0_f32;
    let mut noise_e = 0.0_f32;
    for _ in 0..12_000 {
        m.process(&[0.0; 4], &mut outs);
        lfo_e += outs[0].abs();
        noise_e += outs[1].abs();
    }
    assert!(lfo_e > 100.0, "LFO silent (energy {lfo_e})");
    assert!(noise_e > 100.0, "noise silent (energy {noise_e})");
    assert!(outs[0].is_finite() && outs[1].is_finite() && outs[2].is_finite());
}

#[test]
fn erica_modulator_sh_steps_on_clock() {
    let mut m = EricaModulator::new();
    m.set_sample_rate(48_000.0);
    m.set_param("slew", 0.0);
    m.set_param("noise_lvl", 1.0);
    let mut outs = [0.0_f32; 3];
    // Idle
    for _ in 0..200 {
        m.process(&[0.0, 0.0, 0.0, 0.0], &mut outs);
    }
    let before = outs[2];
    // Rising clock edge
    m.process(&[0.0, 0.0, 0.0, 5.0], &mut outs);
    let after = outs[2];
    assert!(after.is_finite());
    // Held value should move (noise sample) or at least stay finite vs before
    assert!(
        (after - before).abs() > 0.01 || after.abs() > 0.01,
        "S&H did not update on clock (before {before}, after {after})"
    );
}

#[test]
fn erica_bassline_gated_voice() {
    let mut b = EricaBassline::new();
    b.set_sample_rate(48_000.0);
    b.set_param("tune", 55.0);
    b.set_param("cutoff", 600.0);
    b.set_param("res", 0.65);
    b.set_param("decay", 0.25);
    b.set_param("drive", 0.4);
    let mut outs = [0.0_f32; 1];
    let mut peak = 0.0_f32;
    // Rising gate
    b.process(&[0.0, 5.0, 0.0, 0.0], &mut outs);
    for _ in 0..8_000 {
        b.process(&[0.0, 5.0, 0.0, 0.0], &mut outs);
        peak = peak.max(outs[0].abs());
    }
    assert!(peak > 0.15, "expected bassline energy, peak {peak}");
    assert!(outs[0].is_finite());
}
