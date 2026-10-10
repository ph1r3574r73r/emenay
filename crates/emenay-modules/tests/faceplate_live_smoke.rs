//! Live-pass smoke: faceplate-related params + lights for Mixer / Output / Clock / RNG.

use emenay_engine::module::Module;
use emenay_modules::{Clock, EricaMixer, EricaOutput, Rng};

fn light(m: &impl Module, id: &str) -> f32 {
    m.lights().values.get(id).copied().unwrap_or(-1.0)
}

#[test]
fn mixer_mutes_and_mix_mute() {
    let mut m = EricaMixer::new();
    let mut outs = [0.0f32; 2];
    m.process(&[1.0, 1.0, 1.0, 1.0], &mut outs);
    assert!(outs[0].abs() > 0.1, "open mix should pass signal");

    m.set_param("mute1", 1.0);
    m.set_param("mute2", 1.0);
    m.set_param("mute3", 1.0);
    m.set_param("mute4", 1.0);
    m.process(&[1.0, 1.0, 1.0, 1.0], &mut outs);
    assert!(outs[0].abs() < 1e-4, "all channel mutes silence mix");
    assert!(light(&m, "mute1") > 0.5);

    m.set_param("mute1", 0.0);
    m.set_param("mute2", 0.0);
    m.set_param("mute3", 0.0);
    m.set_param("mute4", 0.0);
    m.set_param("mute_mix", 1.0);
    m.process(&[1.0, 1.0, 1.0, 1.0], &mut outs);
    assert!(outs[0].abs() < 1e-4 && outs[1].abs() < 1e-4, "mute_mix silences both outs");
    assert!(light(&m, "mute_mix") > 0.5);
    assert!(light(&m, "level") >= 0.0);
}

#[test]
fn output_stereo_db_meter_segments() {
    let mut m = EricaOutput::new();
    m.set_param("level", 1.0);
    let mut outs = [0.0f32; 2];
    // Hot signal → upper segments should light after a few samples of peak track.
    for _ in 0..2000 {
        m.process(&[8.0, 8.0], &mut outs);
    }
    // Line stage typically tops out near the 0 dB = 5 V reference.
    assert!(light(&m, "meter_l_m18") > 0.5);
    assert!(light(&m, "meter_l_m9") > 0.5);
    assert!(light(&m, "meter_l_0") > 0.5);
    assert!(light(&m, "meter_r_m18") > 0.5);
    assert!(light(&m, "meter_r_0") > 0.5);
    // +3/+6 are clip LEDs — may stay dark if the buffer soft-limits near 5 V.
    assert!(light(&m, "meter_l_p6") >= 0.0);

    // Quiet → clip segments stay off.
    m.reset();
    for _ in 0..500 {
        m.process(&[0.05, 0.05], &mut outs);
    }
    assert!(light(&m, "meter_l_p6") < 0.2, "quiet should not light +6");
    assert!(light(&m, "meter_l_0") < 0.2, "quiet should not light 0 dB");
}

#[test]
fn clock_bpm_digit_and_pw() {
    let mut m = Clock::new();
    m.set_sample_rate(48_000.0);
    m.set_param("bpm", 128.4); // int snap in engine
    let bpm = m.get_param("bpm").unwrap();
    assert_eq!(bpm, 128.0);

    m.set_param("pw", 0.35);
    let mut outs = [0.0f32; 8];
    let mut saw_high = false;
    let mut saw_low = false;
    for _ in 0..48_000 {
        m.process(&[], &mut outs);
        if outs[0] > 1.0 {
            saw_high = true;
        }
        if outs[0] < 1.0 {
            saw_low = true;
        }
        if saw_high && saw_low {
            break;
        }
    }
    assert!(saw_high && saw_low, "clock should toggle");
    assert!((light(&m, "bpm") - bpm).abs() < 0.01, "lights.bpm drives LCD");
    assert!(light(&m, "clk1") >= 0.0);
}

#[test]
fn rng_bit_bar_and_hold() {
    let mut m = Rng::new();
    m.set_param("steps", 8.0);
    m.set_param("hold", 0.0);
    let mut outs = [0.0f32; 3];
    // Rising edges to scramble bits.
    for i in 0..40 {
        let clk = if i % 2 == 0 { 0.0 } else { 5.0 };
        m.process(&[clk, 0.0, 0.0], &mut outs);
    }
    let before: Vec<f32> = (0..7).map(|i| light(&m, &format!("bit{i}"))).collect();
    assert!(before.iter().any(|&v| v > 0.5), "some bits should be lit");

    m.set_param("hold", 1.0);
    let held: Vec<f32> = (0..7).map(|i| light(&m, &format!("bit{i}"))).collect();
    for i in 0..20 {
        let clk = if i % 2 == 0 { 0.0 } else { 5.0 };
        m.process(&[clk, 0.0, 0.0], &mut outs);
    }
    let after: Vec<f32> = (0..7).map(|i| light(&m, &format!("bit{i}"))).collect();
    assert_eq!(held, after, "hold should freeze the bit pattern");
    assert!(light(&m, "hold") > 0.5);
    assert!(light(&m, "gate") >= 0.0);
}
