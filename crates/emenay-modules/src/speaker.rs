use emenay_engine::module::{Module, ModuleInfo, ParamDesc, PortDesc, PortId, SignalKind};
use emenay_engine::Voltage;

/// Permanent device I/O sink. Input jacks map 1:1 to hardware channels.
pub struct Speaker {
    info: ModuleInfo,
    channels: usize,
}

impl Speaker {
    pub fn new(channels: usize) -> Self {
        let channels = channels.clamp(1, 16);
        Self {
            info: make_info(channels),
            channels,
        }
    }

    fn rebuild_info(&mut self) {
        self.info = make_info(self.channels);
    }
}

fn make_info(channels: usize) -> ModuleInfo {
    let inputs: Vec<PortDesc> = (0..channels)
        .map(|i| PortDesc {
            name: format!("ch{}", i + 1),
            kind: PortId::Input,
            signal: SignalKind::Audio,
        })
        .collect();
    ModuleInfo {
        type_id: "speaker".into(),
        name: "Speaker".into(),
        hp: 8,
        inputs,
        outputs: vec![],
        params: vec![ParamDesc {
            name: "channels".into(),
            min: 1.0,
            max: 16.0,
            default: channels as f32,
            unit: "".into(),
        }],
    }
}

impl Module for Speaker {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn set_param(&mut self, name: &str, value: f32) {
        if name == "channels" {
            let ch = (value.round() as usize).clamp(1, 16);
            if ch != self.channels {
                self.channels = ch;
                self.rebuild_info();
            }
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        if name == "channels" {
            Some(self.channels as f32)
        } else {
            None
        }
    }

    fn process(&mut self, _inputs: &[Voltage], _outputs: &mut [Voltage]) {
        // Graph copies inputs into the device buffer.
    }
}
