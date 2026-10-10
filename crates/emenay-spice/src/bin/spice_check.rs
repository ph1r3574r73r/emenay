use anyhow::Result;
use emenay_spice::{compare_mixer_dc_gain, compare_rc_lpf};

fn main() -> Result<()> {
    let rc = compare_rc_lpf(10_000.0, 10.0e-9, 0.08)?;
    let mix = compare_mixer_dc_gain();
    println!("{}", serde_json::to_string_pretty(&rc)?);
    println!("{}", serde_json::to_string_pretty(&mix)?);
    if !rc.passed || !mix.passed {
        std::process::exit(1);
    }
    Ok(())
}
