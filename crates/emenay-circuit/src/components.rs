use crate::mna::MnaSolver;
use crate::netlist::{NetElement, Netlist};
use crate::CircuitModel;

/// Generic stamped component (documentation / future expansion).
#[derive(Clone, Debug)]
pub enum Component {
    Resistor { n1: Option<usize>, n2: Option<usize>, ohms: f64 },
    Capacitor { n1: Option<usize>, n2: Option<usize>, farads: f64 },
}

/// First-order passive RC low-pass: Vin - R - Vout - C - gnd
///
/// Unknowns: [vout, i_vin]
#[derive(Clone, Debug)]
pub struct PassiveRcLowpass {
    pub r: f64,
    pub c: f64,
    sample_rate: f32,
    v_c: f64,
    solver: MnaSolver,
}

impl PassiveRcLowpass {
    pub fn new(r: f64, c: f64) -> Self {
        Self {
            r,
            c,
            sample_rate: 48_000.0,
            v_c: 0.0,
            solver: MnaSolver::new(2),
        }
    }

    pub fn cutoff_hz(&self) -> f64 {
        1.0 / (2.0 * std::f64::consts::PI * self.r * self.c)
    }

    pub fn netlist(&self) -> Netlist {
        let mut n = Netlist::new(format!(
            "emenay RC LPF R={} C={} fc={:.2}Hz",
            self.r,
            self.c,
            self.cutoff_hz()
        ));
        n.elements.push(NetElement::Comment(
            "Vin at node 1, Vout at node 2".into(),
        ));
        n.elements.push(NetElement::VoltageSource {
            name: "Vin".into(),
            n_pos: 1,
            n_neg: 0,
            volts: 1.0,
        });
        n.elements.push(NetElement::Resistor {
            name: "R1".into(),
            n1: 1,
            n2: 2,
            ohms: self.r,
        });
        n.elements.push(NetElement::Capacitor {
            name: "C1".into(),
            n1: 2,
            n2: 0,
            farads: self.c,
        });
        n
    }

    /// Magnitude response |H(jw)| for validation against SPICE AC analysis.
    pub fn analytic_magnitude(&self, freq_hz: f64) -> f64 {
        let w = 2.0 * std::f64::consts::PI * freq_hz;
        let rc = self.r * self.c;
        1.0 / (1.0 + (w * rc).powi(2)).sqrt()
    }
}

impl CircuitModel for PassiveRcLowpass {
    fn reset(&mut self) {
        self.v_c = 0.0;
    }

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn num_inputs(&self) -> usize {
        1
    }

    fn num_outputs(&self) -> usize {
        1
    }

    fn process(&mut self, inputs: &[f32], outputs: &mut [f32]) {
        let vin = inputs.first().copied().unwrap_or(0.0) as f64;
        let dt = 1.0 / self.sample_rate as f64;
        self.solver.clear();
        // node 0 = vout, unknown 1 = i_vin
        // Vin is a voltage source into the left of R; we stamp Vin as forcing
        // Equivalent: R from virtual vin node... use Thevenin:
        // Stamp voltage source at auxiliary: actually stamp R from vin (fixed) via
        // current into node 0: (vin - v0)/R  => G=1/R on (0,0), b += vin/R
        let g = 1.0 / self.r;
        self.solver.stamp_g(0, 0, g);
        self.solver.stamp_b(0, vin * g);
        self.solver
            .stamp_capacitor_be(Some(0), None, self.c, dt, self.v_c);
        // unused current unknown kept for matrix size consistency — tie it weakly
        self.solver.stamp_g(1, 1, 1.0);
        let _ = self.solver.solve();
        self.v_c = self.solver.voltage(0);
        if let Some(o) = outputs.get_mut(0) {
            *o = self.v_c as f32;
        }
    }
}

/// Ideal finite-gain op-amp helper used by mixer stages.
#[derive(Clone, Debug)]
pub struct OpAmpIdeal {
    pub open_loop_gain: f64,
}

impl Default for OpAmpIdeal {
    fn default() -> Self {
        Self {
            open_loop_gain: 1e5,
        }
    }
}

/// Inverting summer inspired by Erica Synths DIY Mixer topology:
/// three inputs through Rin, feedback Rf, virtual ground op-amp.
///
/// Simplified single-ended model (not full dual-supply PCB), enough to
/// validate DC gains and mix behaviour against SPICE.
#[derive(Clone, Debug)]
pub struct InvertingMixer3 {
    pub rin: [f64; 3],
    pub rf: f64,
    pub gains: [f64; 3], // pot attenuation 0..1 in series with each Rin
    opamp: OpAmpIdeal,
    solver: MnaSolver,
    sample_rate: f32,
}

impl InvertingMixer3 {
    pub fn new(rin: f64, rf: f64) -> Self {
        Self {
            rin: [rin; 3],
            rf,
            gains: [1.0; 3],
            opamp: OpAmpIdeal::default(),
            // unknowns: v_sum (0), v_out (1), i_op (2)
            solver: MnaSolver::new(3),
            sample_rate: 48_000.0,
        }
    }

    pub fn set_channel_gain(&mut self, ch: usize, gain: f64) {
        if let Some(g) = self.gains.get_mut(ch) {
            *g = gain.clamp(0.0, 1.0);
        }
    }

    pub fn netlist(&self) -> Netlist {
        let mut n = Netlist::new("emenay inverting 3-ch mixer (Erica DIY inspired)");
        n.elements.push(NetElement::Comment(
            "Derived from Erica Synths DIY Mixer (CC-BY-SA-3.0). Simplified ideal op-amp.".into(),
        ));
        for i in 0..3 {
            let r = self.rin[i] / self.gains[i].max(1e-6);
            n.elements.push(NetElement::Resistor {
                name: format!("Rin{i}"),
                n1: 10 + i as i32,
                n2: 1,
                ohms: r,
            });
            n.elements.push(NetElement::VoltageSource {
                name: format!("Vin{i}"),
                n_pos: 10 + i as i32,
                n_neg: 0,
                volts: 0.0,
            });
        }
        n.elements.push(NetElement::Resistor {
            name: "Rf".into(),
            n1: 1,
            n2: 2,
            ohms: self.rf,
        });
        n.elements.push(NetElement::Comment(
            "E1 2 0 OPAMP 1 0  — use XSPICE or controlled source in full SPICE".into(),
        ));
        n
    }

    /// Ideal inverting mix DC gain for channel i: - (Rf / (Rin/gain))
    pub fn analytic_gain(&self, ch: usize) -> f64 {
        let g = self.gains[ch].max(1e-9);
        let r_eff = self.rin[ch] / g;
        -(self.rf / r_eff)
    }
}

impl CircuitModel for InvertingMixer3 {
    fn reset(&mut self) {}

    fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn num_inputs(&self) -> usize {
        3
    }

    fn num_outputs(&self) -> usize {
        1
    }

    fn process(&mut self, inputs: &[f32], outputs: &mut [f32]) {
        let a = self.opamp.open_loop_gain;
        self.solver.clear();
        // node0 = summing junction, node1 = out, unk2 = i_op
        for i in 0..3 {
            let vin = inputs.get(i).copied().unwrap_or(0.0) as f64;
            let g_pot = self.gains[i].max(1e-9);
            let r = self.rin[i] / g_pot;
            let g = 1.0 / r;
            // current into sum from vin: (vin - vsum)/R
            self.solver.stamp_g(0, 0, g);
            self.solver.stamp_b(0, vin * g);
        }
        // feedback Rf between sum (0) and out (1)
        self.solver.stamp_resistor(Some(0), Some(1), self.rf);
        // op-amp: non-inv grounded, inv = sum, out = node1
        self.solver
            .stamp_opamp_finite_gain(None, Some(0), 1, 2, a);
        let _ = self.solver.solve();
        let vout = self.solver.voltage(1);
        if let Some(o) = outputs.get_mut(0) {
            *o = vout.clamp(-12.0, 12.0) as f32;
        }
    }
}

/// Simple buffered attenuator / line output stage (Erica Output inspired).
#[derive(Clone, Debug)]
pub struct BufferedOutput {
    pub level: f64,
    pub headphone_gain: f64,
}

impl Default for BufferedOutput {
    fn default() -> Self {
        Self {
            level: 0.5,
            headphone_gain: 1.0,
        }
    }
}

impl CircuitModel for BufferedOutput {
    fn reset(&mut self) {}

    fn set_sample_rate(&mut self, _sample_rate: f32) {}

    fn num_inputs(&self) -> usize {
        1
    }

    fn num_outputs(&self) -> usize {
        2 // line + headphone
    }

    fn process(&mut self, inputs: &[f32], outputs: &mut [f32]) {
        let x = inputs.first().copied().unwrap_or(0.0) as f64;
        // Soft clip rails approximating op-amp saturation near ±12V then scale to line
        let driven = (x * self.level).tanh() * 10.0 / 10.0f64.tanh();
        let line = driven * 0.5; // line pad
        let phones = driven * self.headphone_gain * 0.25;
        if let Some(o) = outputs.get_mut(0) {
            *o = line as f32;
        }
        if let Some(o) = outputs.get_mut(1) {
            *o = phones as f32;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rc_settles_toward_dc() {
        let mut rc = PassiveRcLowpass::new(10_000.0, 10.0e-9);
        rc.set_sample_rate(48_000.0);
        let mut out = [0.0f32];
        for _ in 0..20_000 {
            rc.process(&[1.0], &mut out);
        }
        assert!((out[0] - 1.0).abs() < 0.02, "got {}", out[0]);
    }

    #[test]
    fn mixer_inverts_and_sums() {
        let mut m = InvertingMixer3::new(10_000.0, 10_000.0);
        m.set_channel_gain(0, 1.0);
        m.set_channel_gain(1, 1.0);
        m.set_channel_gain(2, 0.0);
        let mut out = [0.0f32];
        m.process(&[1.0, 1.0, 0.0], &mut out);
        // two unity inverting channels => ~-2V
        assert!((out[0] + 2.0).abs() < 0.05, "got {}", out[0]);
    }
}
