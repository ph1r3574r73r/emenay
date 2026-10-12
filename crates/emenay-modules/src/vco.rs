//! Simple phase-accumulator VCO (generic). For Erica DIY VCO3 see `erica_vco3`.

use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::{PI, TAU};

pub struct SimpleVco {
    info: ModuleInfo,
    phase: f32,
    base_hz: f32,
    fm_amt: f32,
    pwm: f32,
    sample_rate: f32,
    sync_prev: bool,
}

impl SimpleVco {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "vco".into(),
                name: "VCO".into(),
                hp: 12,
                inputs: vec![
                    PortDesc {
                        name: "v_oct".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "fm".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "pwm".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "sync".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "saw".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "sq".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                    PortDesc {
                        name: "tri".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Audio,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "freq".into(),
                        min: 20.0,
                        max: 2000.0,
                        default: 110.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "fm_amt".into(),
                        min: 0.0,
                        max: 1.0,
                        default: 0.35,
                        unit: "".into(),
                    },
                    ParamDesc {
                        name: "pwm_amt".into(),
                        min: 0.05,
                        max: 0.95,
                        default: 0.5,
                        unit: "".into(),
                    },
                ],
            },
            phase: 0.0,
            base_hz: 110.0,
            fm_amt: 0.35,
            pwm: 0.5,
            sample_rate: 48_000.0,
            sync_prev: false,
        }
    }
}

impl Default for SimpleVco {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for SimpleVco {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "freq" => self.base_hz = value.clamp(20.0, 2000.0),
            "fm_amt" => self.fm_amt = value.clamp(0.0, 1.0),
            "pwm_amt" => self.pwm = value.clamp(0.05, 0.95),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "freq" => Some(self.base_hz),
            "fm_amt" => Some(self.fm_amt),
            "pwm_amt" => Some(self.pwm),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let v_oct = inputs.first().copied().unwrap_or(0.0);
        let fm = inputs.get(1).copied().unwrap_or(0.0);
        let pwm_cv = inputs.get(2).copied().unwrap_or(0.0);
        let sync = inputs.get(3).copied().unwrap_or(0.0) > 1.0;
        if sync && !self.sync_prev {
            self.phase = 0.0;
        }
        self.sync_prev = sync;

        let hz = (self.base_hz * 2f32.powf(v_oct + fm * self.fm_amt * 0.5))
            .clamp(0.1, self.sample_rate * 0.45);
        self.phase = (self.phase + hz / self.sample_rate).fract();

        let width = (self.pwm + pwm_cv * 0.1).clamp(0.05, 0.95);
        let saw = (2.0 * self.phase - 1.0) * 5.0;
        let sq = if self.phase < width { 5.0 } else { -5.0 };
        let tri = (2.0 / PI) * (TAU * self.phase).sin().asin() * 5.0;

        if let Some(o) = outputs.get_mut(0) {
            *o = saw;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = sq;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = tri;
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.sync_prev = false;
    }
}
