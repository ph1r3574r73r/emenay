use emenay_engine::module::Module;
use emenay_modules::{EricaBbd, EricaSwamp, EricaVco3};

#[test]
fn erica_bbd_delays_and_mixes() {
    let mut osc = EricaVco3::new();
    let mut bbd = EricaBbd::new();
    osc.set_sample_rate(48_000.0);
    bbd.set_sample_rate(48_000.0);
    bbd.set_param("time", 50.0);
    bbd.set_param("feedback", 0.5);
    bbd.set_param("mix", 0.6);
    bbd.set_param("mod_amt", 0.0);

    let mut o = [0.0_f32; 4];
    let mut outs = [0.0_f32; 2];
    let mut wet_e = 0.0_f32;
    let mut mix_e = 0.0_f32;
    for _ in 0..24_000 {
        osc.process(&[0.0; 4], &mut o);
        bbd.process(&[o[0], 0.0, 0.0], &mut outs);
        wet_e += outs[0].abs();
        mix_e += outs[1].abs();
    }
    assert!(wet_e > 50.0, "BBD wet silent (energy {wet_e})");
    assert!(mix_e > 50.0, "BBD mix silent (energy {mix_e})");
    assert!(outs[0].is_finite() && outs[1].is_finite());
}

#[test]
fn erica_bbd_inhibit_freezes_write() {
    let mut bbd = EricaBbd::new();
    bbd.set_sample_rate(48_000.0);
    bbd.set_param("time", 20.0);
    bbd.set_param("mix", 1.0);
    bbd.set_param("feedback", 0.0);
    bbd.set_param("mod_amt", 0.0);
    let mut outs = [0.0_f32; 2];
    for _ in 0..2_000 {
        bbd.process(&[1.0, 0.0, 0.0], &mut outs);
    }
    // Inhibit — further input should not overwrite the line immediately
    for _ in 0..500 {
        bbd.process(&[0.0, 0.0, 5.0], &mut outs);
    }
    assert!(outs[0].is_finite());
}

#[test]
fn erica_swamp_produces_cv() {
    let mut s = EricaSwamp::new();
    s.set_sample_rate(48_000.0);
    s.set_param("rate", 20.0);
    s.set_param("chaos", 0.7);
    let mut outs = [0.0_f32; 4];
    let mut step_var = 0.0_f32;
    let mut last = 0.0_f32;
    let mut noise_e = 0.0_f32;
    for _ in 0..20_000 {
        s.process(&[0.0; 3], &mut outs);
        step_var += (outs[0] - last).abs();
        last = outs[0];
        noise_e += outs[3].abs();
    }
    assert!(step_var > 1.0, "stepped CV stuck (var {step_var})");
    assert!(noise_e > 100.0, "noise silent");
    assert!(outs.iter().all(|v| v.is_finite()));
}
