//! CV-addressable switch (Doepfer A-150 / A-152 style).
//!
//! Knob + CV select which of 4 paths is active.
//! Bidirectional: COM → O1…O4, and I1…I4 → COM OUT.

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

pub struct CvSwitch {
    info: ModuleInfo,
    select: f32,
    steps: u32,
    active: u32,
}

impl CvSwitch {
    pub fn new() -> Self {
        Self {
            info: ModuleInfo {
                type_id: "cv_switch".into(),
                name: "CV Switch".into(),
                hp: 6,
                inputs: vec![
                    PortDesc {
                        name: "cv".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "com".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "i1".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "i2".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "i3".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "i4".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Cv,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "o1".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "o2".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "o3".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "o4".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "com_out".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                ],
                params: vec![
                    ParamDesc {
                        name: "select".into(),
                        min: 0.0,
                        max: 3.0,
                        default: 0.0,
                        unit: "int".into(),
                    },
                    ParamDesc {
                        name: "steps".into(),
                        min: 2.0,
                        max: 4.0,
                        default: 4.0,
                        unit: "int".into(),
                    },
                ],
            },
            select: 0.0,
            steps: 4,
            active: 0,
        }
    }

    fn n(&self) -> u32 {
        self.steps.clamp(2, 4)
    }
}

impl Default for CvSwitch {
    fn default() -> Self {
        Self::new()
    }
}

impl Module for CvSwitch {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "select" => self.select = value.clamp(0.0, 3.0),
            "steps" => self.steps = value.clamp(2.0, 4.0).round() as u32,
            _ => {}
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "select" => Some(self.select),
            "steps" => Some(self.steps as f32),
            _ => None,
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let cv = inputs.first().copied().unwrap_or(0.0);
        let com = inputs.get(1).copied().unwrap_or(0.0);
        let ins = [
            inputs.get(2).copied().unwrap_or(0.0),
            inputs.get(3).copied().unwrap_or(0.0),
            inputs.get(4).copied().unwrap_or(0.0),
            inputs.get(5).copied().unwrap_or(0.0),
        ];

        let n = self.n();
        // 0–5V CV spans the step range (plus knob offset).
        let pos = (self.select + (cv / 5.0) * n as f32).clamp(0.0, (n - 1) as f32);
        self.active = pos.round().clamp(0.0, (n - 1) as f32) as u32;

        for i in 0..4 {
            if let Some(o) = outputs.get_mut(i) {
                *o = if i as u32 == self.active { com } else { 0.0 };
            }
        }
        if let Some(o) = outputs.get_mut(4) {
            *o = ins[self.active as usize];
        }
    }

    fn reset(&mut self) {
        self.active = 0;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        for i in 0..4 {
            l.set(
                format!("led{}", i + 1),
                if i as u32 == self.active { 1.0 } else { 0.08 },
            );
        }
        l.set("step", self.active as f32 + 1.0);
        l
    }
}
