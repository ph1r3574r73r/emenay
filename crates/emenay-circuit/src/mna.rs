use thiserror::Error;

#[derive(Debug, Error)]
pub enum SolveError {
    #[error("singular or ill-conditioned MNA matrix")]
    Singular,
    #[error("dimension mismatch")]
    DimMismatch,
}

/// Dense MNA system: G * x = b
#[derive(Clone, Debug)]
pub struct MnaSolver {
    n: usize,
    g: Vec<f64>,
    b: Vec<f64>,
    x: Vec<f64>,
    scratch: Vec<f64>,
}

impl MnaSolver {
    pub fn new(n: usize) -> Self {
        Self {
            n,
            g: vec![0.0; n * n],
            b: vec![0.0; n],
            x: vec![0.0; n],
            scratch: vec![0.0; n * (n + 1)],
        }
    }

    pub fn size(&self) -> usize {
        self.n
    }

    pub fn clear(&mut self) {
        self.g.fill(0.0);
        self.b.fill(0.0);
    }

    #[inline]
    pub fn stamp_g(&mut self, row: usize, col: usize, value: f64) {
        debug_assert!(row < self.n && col < self.n);
        self.g[row * self.n + col] += value;
    }

    #[inline]
    pub fn stamp_b(&mut self, row: usize, value: f64) {
        debug_assert!(row < self.n);
        self.b[row] += value;
    }

    /// Stamp conductance between two nodes (0 = ground, nodes are 1-indexed in stamps via Option).
    pub fn stamp_resistor(&mut self, n1: Option<usize>, n2: Option<usize>, r: f64) {
        let g = 1.0 / r;
        if let (Some(a), Some(b)) = (n1, n2) {
            self.stamp_g(a, a, g);
            self.stamp_g(b, b, g);
            self.stamp_g(a, b, -g);
            self.stamp_g(b, a, -g);
        } else if let Some(a) = n1 {
            self.stamp_g(a, a, g);
        } else if let Some(b) = n2 {
            self.stamp_g(b, b, g);
        }
    }

    /// Independent voltage source from ground to node, with current unknown at `i_idx`.
    pub fn stamp_voltage_source_to_gnd(&mut self, node: usize, i_idx: usize, volts: f64) {
        self.stamp_g(node, i_idx, 1.0);
        self.stamp_g(i_idx, node, 1.0);
        self.stamp_b(i_idx, volts);
    }

    /// Ideal VCVS / finite-gain op-amp: Vout = A * (Vp - Vm). Extra unknown at `i_idx` is output current.
    pub fn stamp_opamp_finite_gain(
        &mut self,
        vp: Option<usize>,
        vm: Option<usize>,
        vout: usize,
        i_idx: usize,
        gain: f64,
    ) {
        // Equations:
        // KCL at vout: +i_out
        // Branch: vout - A*(vp-vm) = 0  =>  -A*vp + A*vm + vout = 0
        self.stamp_g(vout, i_idx, 1.0);
        self.stamp_g(i_idx, vout, 1.0);
        if let Some(p) = vp {
            self.stamp_g(i_idx, p, -gain);
        }
        if let Some(m) = vm {
            self.stamp_g(i_idx, m, gain);
        }
    }

    /// Backward-Euler capacitor companion: G = C/dt, Ieq = G * Vprev between n1-n2.
    pub fn stamp_capacitor_be(
        &mut self,
        n1: Option<usize>,
        n2: Option<usize>,
        c: f64,
        dt: f64,
        v_prev: f64,
    ) {
        let g = c / dt;
        let ieq = g * v_prev;
        self.stamp_resistor(n1, n2, 1.0 / g);
        // Current source from n2 -> n1 equal to ieq (companion model)
        if let Some(a) = n1 {
            self.stamp_b(a, ieq);
        }
        if let Some(b) = n2 {
            self.stamp_b(b, -ieq);
        }
    }

    pub fn voltage(&self, idx: usize) -> f64 {
        self.x[idx]
    }

    pub fn solve(&mut self) -> Result<(), SolveError> {
        let n = self.n;
        if self.g.len() != n * n || self.b.len() != n {
            return Err(SolveError::DimMismatch);
        }

        // Augmented matrix [G | b]
        let aug = &mut self.scratch;
        for r in 0..n {
            for c in 0..n {
                aug[r * (n + 1) + c] = self.g[r * n + c];
            }
            aug[r * (n + 1) + n] = self.b[r];
        }

        // Gaussian elimination with partial pivoting
        for col in 0..n {
            let mut pivot_row = col;
            let mut pivot_abs = aug[col * (n + 1) + col].abs();
            for r in (col + 1)..n {
                let v = aug[r * (n + 1) + col].abs();
                if v > pivot_abs {
                    pivot_abs = v;
                    pivot_row = r;
                }
            }
            if pivot_abs < 1e-18 {
                return Err(SolveError::Singular);
            }
            if pivot_row != col {
                for c in 0..=n {
                    aug.swap(col * (n + 1) + c, pivot_row * (n + 1) + c);
                }
            }
            let piv = aug[col * (n + 1) + col];
            for r in (col + 1)..n {
                let factor = aug[r * (n + 1) + col] / piv;
                if factor == 0.0 {
                    continue;
                }
                for c in col..=n {
                    aug[r * (n + 1) + c] -= factor * aug[col * (n + 1) + c];
                }
            }
        }

        // Back substitution
        for r in (0..n).rev() {
            let mut sum = aug[r * (n + 1) + n];
            for c in (r + 1)..n {
                sum -= aug[r * (n + 1) + c] * self.x[c];
            }
            let piv = aug[r * (n + 1) + r];
            if piv.abs() < 1e-18 {
                return Err(SolveError::Singular);
            }
            self.x[r] = sum / piv;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn voltage_divider() {
        // 10V -- R1=1k -- mid -- R2=1k -- gnd  => mid = 5V
        // unknowns: v_mid (0), i_src (1)
        let mut s = MnaSolver::new(2);
        s.clear();
        s.stamp_voltage_source_to_gnd(0, 1, 10.0);
        // Wait - voltage source stamps node 0 to ground with 10V, but then R1 from node0 to mid?
        // Better topology: Vin at node 0, mid at node 1, i_src at 2
        let mut s = MnaSolver::new(3);
        s.clear();
        // Vin at node 0
        s.stamp_voltage_source_to_gnd(0, 2, 10.0);
        // R1 1k between 0 and 1
        s.stamp_resistor(Some(0), Some(1), 1000.0);
        // R2 1k between 1 and gnd
        s.stamp_resistor(Some(1), None, 1000.0);
        s.solve().unwrap();
        assert!((s.voltage(1) - 5.0).abs() < 1e-6, "got {}", s.voltage(1));
    }
}
