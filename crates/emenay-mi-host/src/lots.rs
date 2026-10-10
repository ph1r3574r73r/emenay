use std::ptr;

use crate::expect_non_null;
use crate::ffi::EmenayLots;

pub struct LotsHost {
    inner: *mut EmenayLots,
    connected: Vec<i32>,
}

impl LotsHost {
    pub fn new() -> Self {
        let inner = expect_non_null(unsafe { crate::ffi::emenay_lots_new() }, "Lots");
        Self {
            inner,
            connected: vec![0; 8],
        }
    }

    pub fn reset(&mut self) {
        unsafe { crate::ffi::emenay_lots_reset(self.inner) };
    }

    #[allow(clippy::too_many_arguments)]
    pub fn process_sample(
        &mut self,
        inputs: &[f32],
        connected: &[bool],
        outputs: &mut [f32],
        rate: f32,
        bias: f32,
        jitter: f32,
        spread: f32,
        x_bias: f32,
        steps: f32,
        deja_vu: f32,
        deja_vu_length: f32,
        t_mode: i32,
        x_mode: i32,
        lights_t: &mut [f32; 3],
    ) {
        for (i, &c) in connected.iter().enumerate().take(8) {
            self.connected[i] = i32::from(c);
        }
        unsafe {
            crate::ffi::emenay_lots_process(
                self.inner,
                inputs.as_ptr(),
                self.connected.as_ptr(),
                outputs.as_mut_ptr(),
                rate,
                bias,
                jitter,
                spread,
                x_bias,
                steps,
                deja_vu,
                deja_vu_length,
                t_mode,
                x_mode,
                lights_t.as_mut_ptr(),
            );
        }
    }
}

impl Drop for LotsHost {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            unsafe { crate::ffi::emenay_lots_delete(self.inner) };
            self.inner = ptr::null_mut();
        }
    }
}

unsafe impl Send for LotsHost {}
