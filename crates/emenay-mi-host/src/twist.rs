use std::ptr;

use crate::expect_non_null;
use crate::ffi::EmenayTwist;

pub struct TwistHost {
    inner: *mut EmenayTwist,
    connected: Vec<i32>,
}

impl TwistHost {
    pub fn new() -> Self {
        let inner = expect_non_null(unsafe { crate::ffi::emenay_twist_new() }, "Twist");
        Self {
            inner,
            connected: vec![0; 6],
        }
    }

    pub fn reset(&mut self) {
        unsafe { crate::ffi::emenay_twist_reset(self.inner) };
    }

    #[allow(clippy::too_many_arguments)]
    pub fn process_sample(
        &mut self,
        inputs: &[f32],
        connected: &[bool],
        outputs: &mut [f32],
        algorithm: f32,
        timbre: f32,
        level1: f32,
        level2: f32,
        internal_freq_hz: f32,
        carrier_shape: i32,
    ) {
        for (i, &c) in connected.iter().enumerate().take(6) {
            self.connected[i] = i32::from(c);
        }
        unsafe {
            crate::ffi::emenay_twist_process(
                self.inner,
                inputs.as_ptr(),
                self.connected.as_ptr(),
                outputs.as_mut_ptr(),
                algorithm,
                timbre,
                level1,
                level2,
                internal_freq_hz,
                carrier_shape,
            );
        }
    }
}

impl Drop for TwistHost {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            unsafe { crate::ffi::emenay_twist_delete(self.inner) };
            self.inner = ptr::null_mut();
        }
    }
}

unsafe impl Send for TwistHost {}
