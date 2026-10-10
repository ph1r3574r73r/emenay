use std::ptr;

use crate::expect_non_null;
use crate::ffi::EmenaySwell;

pub struct SwellHost {
    inner: *mut EmenaySwell,
    connected: Vec<i32>,
}

impl SwellHost {
    pub fn new() -> Self {
        let inner = expect_non_null(unsafe { crate::ffi::emenay_swell_new() }, "Swell");
        Self {
            inner,
            connected: vec![0; 8],
        }
    }

    pub fn reset(&mut self) {
        unsafe { crate::ffi::emenay_swell_reset(self.inner) };
    }

    #[allow(clippy::too_many_arguments)]
    pub fn process_sample(
        &mut self,
        inputs: &[f32],
        connected: &[bool],
        outputs: &mut [f32],
        freq_hz: f32,
        shape: f32,
        slope: f32,
        smoothness: f32,
        mode: i32,
        range: i32,
    ) {
        for (i, &c) in connected.iter().enumerate().take(8) {
            self.connected[i] = i32::from(c);
        }
        unsafe {
            crate::ffi::emenay_swell_process(
                self.inner,
                inputs.as_ptr(),
                self.connected.as_ptr(),
                outputs.as_mut_ptr(),
                freq_hz,
                shape,
                slope,
                smoothness,
                mode,
                range,
            );
        }
    }
}

impl Drop for SwellHost {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            unsafe { crate::ffi::emenay_swell_delete(self.inner) };
            self.inner = ptr::null_mut();
        }
    }
}

unsafe impl Send for SwellHost {}
