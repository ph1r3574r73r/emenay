use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;
use std::f32::consts::TAU;

pub struct TestTone {
    info: ModuleInfo,
    phase: f32,
    freq: f32,
    amp: f32,
    sample_rate: f32,
}

impl TestTone {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "test_tone".into(),
                name: "Test Tone".into(),
                hp: 6,
                inputs: vec![],
                outputs: vec![PortDesc {
                    name: "out".into(),
                    kind: PortId::Output,
                    signal: SignalKind::Audio,
                }],
                params: vec![
                    ParamDesc {
                        name: "freq".into(),
                        min: 20.0,
                        max: 2000.0,
                        default: 440.0,
                        unit: "Hz".into(),
                    },
                    ParamDesc {
                        name: "amp".into(),
                        min: 0.0,
                        max: 5.0,
                        default: 1.0,
                        unit: "V".into(),
                    },
                ],
            },
            phase: 0.0,
            freq: 440.0,
            amp: 1.0,
            sample_rate: 48_000.0,
        }
    }
}

impl Default for TestTone {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for TestTone {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "freq" => self.freq = value.clamp(20.0, 2000.0),
            "amp" => self.amp = value.clamp(0.0, 5.0),
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "freq" => Some(self.freq),
            "amp" => Some(self.amp),
            _ => None,
        }
    }

    fn process(&mut self, _inputs: &[Voltage], outputs: &mut [Voltage]) {
        let s = (self.phase * TAU).sin() * self.amp;
        if let Some(o) = outputs.get_mut(0) {
            *o = s;
        }
        self.phase = (self.phase + self.freq / self.sample_rate).fract();
    }

    fn reset(&mut self) {
        self.phase = 0.0;
    }
}
