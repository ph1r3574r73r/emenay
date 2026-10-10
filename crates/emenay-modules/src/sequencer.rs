//! N-step CV + gate sequencer (pots for pitch, pushbuttons for step on/off).
//!
//! Clock advances through every step in `length`. Off steps are rests (gate
//! stays low; CV holds the last enabled pitch).

use emenay_engine::module::{
    Module, ModuleInfo, ModuleLights, ParamDesc, PortDesc, PortId, SignalKind,
};
use emenay_engine::Voltage;

/// 8-step sequencer (12HP).
pub type Sequencer = StepSequencer<8>;
/// 16-step sequencer (16HP).
pub type Sequencer16 = StepSequencer<16>;
/// 32-step sequencer (26HP).
pub type Sequencer32 = StepSequencer<32>;
/// 64-step sequencer (32HP).
pub type Sequencer64 = StepSequencer<64>;

pub struct StepSequencer<const N: usize> {
    info: ModuleInfo,
    steps: [f32; N],
    gates: [bool; N],
    length: u32,
    glide: f32,
    clock_prev: bool,
    reset_prev: bool,
    step: u32,
    cv: f32,
    sample_rate: f32,
    gate_lit: bool,
}

impl<const N: usize> StepSequencer<N> {
    fn with_meta(type_id: &str, name: &str, hp: u32) -> Self {
        assert!(N >= 1);
        let mut steps = [0.0; N];
        for (i, s) in steps.iter_mut().enumerate() {
            *s = (i as f32 % 5.0) * 0.1;
        }
        let gates = [true; N];
        let n_max = N as f32;

        let mut params = vec![
            ParamDesc {
                name: "length".into(),
                min: 1.0,
                max: n_max,
                default: n_max,
                unit: "int".into(),
            },
            ParamDesc {
                name: "glide".into(),
                min: 0.0,
                max: 1.0,
                default: 0.0,
                unit: "".into(),
            },
        ];
        for i in 0..N {
            params.push(ParamDesc {
                name: format!("s{}", i + 1),
                min: -1.0,
                max: 2.0,
                default: steps[i],
                unit: "V".into(),
            });
        }
        for i in 0..N {
            params.push(ParamDesc {
                name: format!("g{}", i + 1),
                min: 0.0,
                max: 1.0,
                default: 1.0,
                unit: "bool".into(),
            });
        }

        Self {
            info: ModuleInfo {
                type_id: type_id.into(),
                name: name.into(),
                hp,
                inputs: vec![
                    PortDesc {
                        name: "clock".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "reset".into(),
                        kind: PortId::Input,
                        signal: SignalKind::Gate,
                    },
                ],
                outputs: vec![
                    PortDesc {
                        name: "cv".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Cv,
                    },
                    PortDesc {
                        name: "gate".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                    PortDesc {
                        name: "eoc".into(),
                        kind: PortId::Output,
                        signal: SignalKind::Gate,
                    },
                ],
                params,
            },
            steps,
            gates,
            length: N as u32,
            glide: 0.0,
            clock_prev: false,
            reset_prev: false,
            // Start just before step 0 so the first rising clock lands on step 1.
            step: (N as u32).saturating_sub(1),
            cv: 0.0,
            sample_rate: 48_000.0,
            gate_lit: false,
        }
    }

    fn len(&self) -> u32 {
        self.length.clamp(1, N as u32)
    }
}

impl Sequencer {
    pub fn new() -> Self {
        StepSequencer::<8>::with_meta("sequencer", "Sequencer", 12)
    }
}

impl Default for Sequencer {
    fn default() -> Self {
        Self::new()
    }
}

impl Sequencer16 {
    pub fn new() -> Self {
        StepSequencer::<16>::with_meta("sequencer16", "Seq 16", 16)
    }
}

impl Default for Sequencer16 {
    fn default() -> Self {
        Self::new()
    }
}

impl Sequencer32 {
    pub fn new() -> Self {
        StepSequencer::<32>::with_meta("sequencer32", "Seq 32", 26)
    }
}

impl Default for Sequencer32 {
    fn default() -> Self {
        Self::new()
    }
}

impl Sequencer64 {
    pub fn new() -> Self {
        StepSequencer::<64>::with_meta("sequencer64", "Seq 64", 32)
    }
}

impl Default for Sequencer64 {
    fn default() -> Self {
        Self::new()
    }
}

impl<const N: usize> Module for StepSequencer<N> {
    fn info(&self) -> &ModuleInfo {
        &self.info
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn set_param(&mut self, name: &str, value: f32) {
        match name {
            "length" => {
                self.length = value.clamp(1.0, N as f32).round() as u32;
                if self.step >= self.len() {
                    self.step = self.len().saturating_sub(1);
                }
            }
            "glide" => self.glide = value.clamp(0.0, 1.0),
            _ => {
                // Match sN / gN with explicit prefix so "s10" ≠ "s1".
                if let Some(rest) = name.strip_prefix('s') {
                    if rest.chars().all(|c| c.is_ascii_digit()) {
                        if let Ok(i) = rest.parse::<usize>() {
                            if (1..=N).contains(&i) {
                                let v = value.clamp(-1.0, 2.0);
                                // Snap to semitone so UI note labels match CV.
                                self.steps[i - 1] = (v * 12.0).round() / 12.0;
                            }
                        }
                    }
                } else if let Some(rest) = name.strip_prefix('g') {
                    if rest.chars().all(|c| c.is_ascii_digit()) {
                        if let Ok(i) = rest.parse::<usize>() {
                            if (1..=N).contains(&i) {
                                self.gates[i - 1] = value >= 0.5;
                            }
                        }
                    }
                }
            }
        }
    }

    fn get_param(&self, name: &str) -> Option<f32> {
        match name {
            "length" => Some(self.length as f32),
            "glide" => Some(self.glide),
            _ => {
                if let Some(rest) = name.strip_prefix('s') {
                    if rest.chars().all(|c| c.is_ascii_digit()) {
                        if let Ok(i) = rest.parse::<usize>() {
                            if (1..=N).contains(&i) {
                                return Some(self.steps[i - 1]);
                            }
                        }
                    }
                } else if let Some(rest) = name.strip_prefix('g') {
                    if rest.chars().all(|c| c.is_ascii_digit()) {
                        if let Ok(i) = rest.parse::<usize>() {
                            if (1..=N).contains(&i) {
                                return Some(if self.gates[i - 1] { 1.0 } else { 0.0 });
                            }
                        }
                    }
                }
                None
            }
        }
    }

    fn process(&mut self, inputs: &[Voltage], outputs: &mut [Voltage]) {
        let clock = inputs.first().copied().unwrap_or(0.0) > 1.0;
        let reset = inputs.get(1).copied().unwrap_or(0.0) > 1.0;
        let len = self.len();

        if reset && !self.reset_prev {
            // Park just before step 0 so the next clock starts the pattern.
            self.step = len.saturating_sub(1);
        }
        self.reset_prev = reset;

        if clock && !self.clock_prev {
            self.step = (self.step + 1) % len;
        }
        self.clock_prev = clock;

        let idx = (self.step as usize) % N;
        let gate_on = self.gates[idx];
        let target = self.steps[idx];

        // Quantize to semitones (1V/oct) so panel note labels match CV out.
        let target_q = (target * 12.0).round() / 12.0;

        // Only update CV when this step is enabled (rests hold last pitch).
        if gate_on {
            if self.glide < 0.001 {
                self.cv = target_q;
            } else {
                let hz = 0.5 + (1.0 - self.glide).powi(2) * 80.0;
                let a = 1.0 - (-2.0 * std::f32::consts::PI * hz / self.sample_rate).exp();
                self.cv += (target_q - self.cv) * a;
            }
        }

        let gate_out = if clock && gate_on { 5.0 } else { 0.0 };
        let eoc = if self.step == 0 && clock { 5.0 } else { 0.0 };
        self.gate_lit = gate_out > 0.0;

        if let Some(o) = outputs.get_mut(0) {
            *o = self.cv;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = gate_out;
        }
        if let Some(o) = outputs.get_mut(2) {
            *o = eoc;
        }
    }

    fn reset(&mut self) {
        self.step = self.len().saturating_sub(1);
        self.clock_prev = false;
        self.reset_prev = false;
        self.cv = self.steps[0];
        self.gate_lit = false;
    }

    fn lights(&self) -> ModuleLights {
        let mut l = ModuleLights::new();
        let len = self.len() as usize;
        for i in 0..N {
            let enabled = self.gates[i];
            let in_range = i < len;
            let active = i == self.step as usize && in_range;
            let brightness = if !in_range {
                0.0
            } else if active && enabled {
                if self.gate_lit {
                    1.0
                } else {
                    0.55
                }
            } else if active {
                // Playhead on a muted rest — dim so timing is still visible.
                0.28
            } else if enabled {
                0.08
            } else {
                0.0
            };
            l.set(format!("led{}", i + 1), brightness);
        }
        l.set("gate", if self.gate_lit { 1.0 } else { 0.0 });
        l.set("step", self.step as f32 + 1.0);
        l
    }
}
