#![cfg(feature = "mi-firmware")]

use emenay_engine::module::Module;
use emenay_modules::{Lots, Facets, Chimes, Swell, Twist};

#[test]
fn facets_models_0_and_15_render() {
    let mut p = Facets::new();
    p.set_sample_rate(48_000.0);
    for model in [0.0, 8.0, 15.0] {
        p.set_param("model", model);
        p.set_param("level", 0.9);
        let mut e = 0.0_f32;
        let inputs = [0.0_f32; 8];
        let connected = [false, true, false, false, false, false, false, false];
        let mut outs = [0.0_f32; 2];
        for _ in 0..24_000 {
            p.process_connected(&inputs, &connected, &mut outs);
            e += outs[0].abs();
        }
        assert!(e > 1.0, "model {model} silent (energy {e})");
    }
}

#[test]
fn chimes_trig_resonance() {
    let mut r = Chimes::new();
    r.set_sample_rate(48_000.0);
    let mut outs = [0.0_f32; 2];
    let mut peak = 0.0_f32;
    for i in 0..24_000 {
        let trig = if i == 100 { 5.0 } else { 0.0 };
        let inputs = [0.0, trig, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        r.process_connected(&inputs, &[false; 8], &mut outs);
        peak = peak.max(outs[0].abs());
    }
    assert!(peak > 0.01, "expected resonator response, peak {peak}");
}

#[test]
fn twist_processes_stereo_pair() {
    let mut w = Twist::new();
    let inputs = [0.5_f32, 0.25, 0.0, 0.0, 0.0, 0.0];
    let mut outs = [0.0_f32; 2];
    let mut e = 0.0;
    for _ in 0..5000 {
        w.process_connected(&inputs, &[true, true, false, false, false, false], &mut outs);
        e += outs[0].abs() + outs[1].abs();
    }
    assert!(e.is_finite() && e > 0.0);
}

#[test]
fn swell_outputs_finite() {
    let mut t = Swell::new();
    let inputs = [0.0_f32; 8];
    let mut outs = [0.0_f32; 4];
    for _ in 0..5000 {
        t.process_connected(&inputs, &[false; 8], &mut outs);
    }
    assert!(outs.iter().all(|v| v.is_finite()));
}

#[test]
fn lots_dual_clock_and_y() {
    let mut m = Lots::new();
    assert_eq!(m.info().hp, 18);
    assert_eq!(m.info().inputs.len(), 8);
    assert_eq!(m.info().outputs.len(), 7);
    m.set_param("rate", 0.6);
    m.set_param("spread", 0.8);
    m.set_param("steps", 0.2);
    let mut outs = [0.0_f32; 7];
    let mut peak = 0.0_f32;
    // Internal clock (unpatched) + occasional external edges.
    for i in 0..96_000 {
        let clk = if i % 1200 < 40 { 5.0 } else { 0.0 };
        let inputs = [clk, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        let connected = [i > 48_000, false, false, false, false, false, false, false];
        m.process_connected(&inputs, &connected, &mut outs);
        for v in outs {
            peak = peak.max(v.abs());
        }
    }
    assert!(peak > 0.01, "expected lots activity, peak {peak}");
}

#[test]
fn mi_module_info_matches_panel_ports() {
    let chimes = Chimes::new();
    assert!(chimes.info().inputs.iter().any(|p| p.name == "position_cv"));
    assert!(chimes.info().outputs.iter().any(|p| p.name == "aux"));

    let swell = Swell::new();
    assert!(swell.info().inputs.iter().any(|p| p.name == "freeze"));
    assert!(swell.info().outputs.iter().any(|p| p.name == "eoa"));

    let twist = Twist::new();
    assert!(twist.info().inputs.iter().any(|p| p.name == "level2_cv"));
    assert!(twist.info().params.iter().any(|p| p.name == "carrier_shape"));

    let lots = Lots::new();
    assert!(lots.info().inputs.iter().any(|p| p.name == "x_clock"));
    assert!(lots.info().outputs.iter().any(|p| p.name == "y"));
    assert!(lots.info().params.iter().any(|p| p.name == "deja_vu"));
}
