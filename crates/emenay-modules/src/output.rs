//! Erica Synths DIY Output — buffered line / headphone stage (simplified).
//!
//! Attribution: https://github.com/erica-synths/diy-eurorack (CC-BY-SA-3.0)
//!
//! Faceplate: stereo dB meters (+6 / +3 / 0 / −9 / −18) beside the line/phones jacks.

use emenay_circuit::{BufferedOutput, CircuitModel};
use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

/// 0 dB reference = 5 V peak (typical Eurorack line).
const REF_V: f32 = 5.0;
/// Meter segment thresholds in dB relative to REF_V (top → bottom on the plate).
const METER_DB: [f32; 5] = [6.0, 3.0, 0.0, -9.0, -18.0];
const METER_IDS_L: [&str; 5] = [
    "meter_l_p6",
    "meter_l_p3",
    "meter_l_0",
    "meter_l_m9",
    "meter_l_m18",
];
const METER_IDS_R: [&str; 5] = [
    "meter_r_p6",
    "meter_r_p3",
    "meter_r_0",
    "meter_r_m9",
    "meter_r_m18",
];

pub struct EricaOutput {
    info: ModuleInfo,
    circuit: BufferedOutput,
    /// Peak trackers with slow decay (absolute volts).
    peak_l: f32,
    peak_r: f32,
}

impl EricaOutput {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "erica_output".into(),
                name: "Output".into(),
                hp: 8,
                inputs: vec![
                    PortDesc {
                        name: "in_l".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "in_r".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Audio,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "line_l".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "line_r".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![ParamDesc {
                    name: "level".into(),
                    min: 0.0,
                    max: 1.0,
                    default: 0.6,
                    unit: "".into(),
                }],
            },
            circuit: BufferedOutput::default(),
            peak_l: 0.0,
            peak_r: 0.0,
        }
    }

    fn track_peak(peak: &mut f32, sample: f32) {
        let a = sample.abs();
        if a > *peak {
            *peak = a;
        } else {
            // ~300 ms decay @ 48 kHz.
            *peak *= 0.99985;
        }
    }

    fn segment_on(peak_v: f32, thresh_db: f32) -> f32 {
        let thresh_v = REF_V * 10f32.powf(thresh_db / 20.0);
        if peak_v >= thresh_v {
            1.0
        } else if peak_v >= thresh_v * 0.85 {
            // Soft knee so the segment glows as it approaches.
            ((peak_v / thresh_v) - 0.85) / 0.15
        } else {
            0.06
        }
    }
}

impl Default for EricaOutput {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for EricaOutput {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.circuit.set_sample_rate(sample_rate);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        if name == "level" {
            self.circuit.level = value.clamp(0.0, 1.0) as f64;
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        if name == "level" {
            Some(self.circuit.level as f32)
        } else {
            None
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let l = inputs.first().copied().unwrap_or(0.0);
        let r = inputs.get(1).copied().unwrap_or(l);
        let mut left = [0.0f32; 2];
        let mut right = [0.0f32; 2];
        self.circuit.process(&[l], &mut left);
        self.circuit.process(&[r], &mut right);
        let out_l = left[0];
        let out_r = right[0];
        Self::track_peak(&mut self.peak_l, out_l);
        Self::track_peak(&mut self.peak_r, out_r);
        if let Some(o) = outputs.get_mut(0) {
            *o = out_l;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = out_r;
        }
    }

    fn reset(&mut self) {
        self.circuit.reset();
        self.peak_l = 0.0;
        self.peak_r = 0.0;
    }

    fn lights(&self) -> ModuleLights {
        let mut lights = ModuleLights::new();
        for (i, &db) in METER_DB.iter().enumerate() {
            lights.set(METER_IDS_L[i], Self::segment_on(self.peak_l, db));
            lights.set(METER_IDS_R[i], Self::segment_on(self.peak_r, db));
        }
        lights
    }
}
