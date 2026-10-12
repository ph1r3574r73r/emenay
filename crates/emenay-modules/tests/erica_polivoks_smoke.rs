use emenay_engine::module::Module;
use emenay_modules::{EricaPolivoksVcf, EricaVco3};

#[test]
fn erica_vco3_waveforms_nonzero() {
    let mut v = EricaVco3::new();
    v.set_sample_rate(48_000.0);
    v.set_param("freq", 220.0);
    let inputs = [0.0_f32; 4];
    let mut outs = [0.0_f32; 4];
    let mut energy = [0.0_f32; 4];
    for _ in 0..8_000 {
        v.process(&inputs, &mut outs);
        for i in 0..4 {
            energy[i] += outs[i].abs();
        }
    }
    for (i, e) in energy.iter().enumerate() {
        assert!(*e > 10.0, "output {i} silent (energy {e})");
        assert!(outs[i].is_finite());
    }
}

#[test]
fn erica_vco3_hard_sync_resets_phase() {
    let mut v = EricaVco3::new();
    v.set_sample_rate(48_000.0);
    v.set_param("freq", 80.0);
    let mut outs = [0.0_f32; 4];
    for _ in 0..600 {
        v.process(&[0.0, 0.0, 0.0, 0.0], &mut outs);
    }
    // Rising sync → phase 0 → saw ≈ -5 V
    v.process(&[0.0, 0.0, 0.0, 5.0], &mut outs);
    assert!(
        outs[0] < -4.0,
        "expected saw near -5 after sync, got {}",
        outs[0]
    );
}

#[test]
fn polivoks_vcf_passes_and_resonates() {
    let mut osc = EricaVco3::new();
    let mut vcf = EricaPolivoksVcf::new();
    osc.set_sample_rate(48_000.0);
    vcf.set_sample_rate(48_000.0);
    vcf.set_param("cutoff", 400.0);
    vcf.set_param("res", 0.7);
    vcf.set_param("drive", 0.5);

    let mut o_outs = [0.0_f32; 4];
    let mut f_outs = [0.0_f32; 2];
    let mut peak = 0.0_f32;
    for _ in 0..24_000 {
        osc.process(&[0.0; 4], &mut o_outs);
        vcf.process(&[o_outs[0], 0.0, 0.0], &mut f_outs);
        peak = peak.max(f_outs[0].abs());
    }
    assert!(peak > 0.2, "expected Polivoks VCF output, peak {peak}");
    assert!(f_outs[0].is_finite() && f_outs[1].is_finite());
}
