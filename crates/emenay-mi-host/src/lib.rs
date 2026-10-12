//! FFI to official Mutable Instruments firmware DSP (MIT), hosted for desktop @ 48 kHz.

#![allow(unsafe_code)]

mod ffi {
    include!(concat!(env!("OUT_DIR"), "/bindings.rs"));
}

#[cfg(feature = "mi-facets")]
pub mod facets;
#[cfg(feature = "mi-chimes")]
pub mod chimes;
#[cfg(feature = "mi-twist")]
pub mod twist;
#[cfg(feature = "mi-swell")]
pub mod swell;
#[cfg(feature = "mi-lots")]
pub mod lots;
#[cfg(feature = "mi-twin")]
pub mod twin;

pub const MI_SAMPLE_RATE: f32 = 48_000.0;

/// Map emenay 0–5 V CV to 0–1 for panel targets.
#[inline]
pub fn cv_to_01(v: f32) -> f32 {
    (v / 5.0).clamp(0.0, 1.0)
}

/// Map emenay gate voltage to bool.
#[inline]
pub fn gate_from_v(v: f32) -> bool {
    v > 1.0
}

/// Build `connected` flags from optional slice (defaults false).
pub fn connected_flags(inputs_len: usize, connected: &[bool]) -> Vec<i32> {
    (0..inputs_len)
        .map(|i| if connected.get(i).copied().unwrap_or(false) { 1 } else { 0 })
        .collect()
}

/// Safe wrapper helper when C++ allocation fails.
pub fn expect_non_null<T>(ptr: *mut T, name: &str) -> *mut T {
    if ptr.is_null() {
        panic!("emenay-mi-host: failed to allocate {name}");
    }
    ptr
}

#[cfg(test)]
mod tests {
    #[cfg(feature = "mi-facets")]
    #[test]
    fn facets_produces_audio() {
        use crate::facets::FacetsHost;
        let mut host = FacetsHost::new();
        let inputs = [0.0_f32; 8];
        let connected = [false; 8];
        let mut outs = [0.0_f32; 2];
        let mut energy = 0.0_f32;
        for _ in 0..48_000 {
            host.process_sample(
                &inputs,
                &connected,
                &mut outs,
                0.0,
                110.0,
                0.5,
                0.5,
                0.5,
                0.8,
            );
            energy += outs[0].abs() + outs[1].abs();
        }
        assert!(energy > 100.0, "expected audible Facets output, got {energy}");
    }

    #[cfg(feature = "mi-facets")]
    #[test]
    fn facets_model_change_ok() {
        use crate::facets::FacetsHost;
        let mut host = FacetsHost::new();
        let inputs = [0.0_f32; 8];
        let connected = [false, true, false, false, false, false, false, false];
        let mut outs = [0.0_f32; 2];
        for model in [0.0, 8.0, 15.0] {
            for _ in 0..1000 {
                host.process_sample(
                    &inputs,
                    &connected,
                    &mut outs,
                    model,
                    220.0,
                    0.3,
                    0.7,
                    0.4,
                    0.9,
                );
            }
        }
    }

    #[cfg(feature = "mi-twin")]
    #[test]
    fn twin_bass_drum_produces_audio() {
        use crate::twin::TwinHost;
        let mut host = TwinHost::new();
        let mut outs = [0.0_f32; 3];
        let mut energy = 0.0_f32;
        for i in 0..24_000 {
            let trig = if i % 12_000 < 200 { 5.0 } else { 0.0 };
            let inputs = [trig, 0.0];
            let connected = [true, false];
            host.process_sample(
                &inputs,
                &connected,
                &mut outs,
                3, // BD
                4, // SD
                0.4,
                0.6,
                0.5,
                0.5,
                1, // split
                1.0,
            );
            energy += outs[0].abs() + outs[2].abs();
        }
        assert!(energy > 50.0, "expected Twin BD energy, got {energy}");
    }
}
