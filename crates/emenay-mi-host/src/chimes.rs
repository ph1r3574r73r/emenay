use std::ptr;

use crate::expect_non_null;
use crate::ffi::EmenayChimes;

pub struct ChimesHost {
    inner: *mut EmenayChimes,
    connected: Vec<i32>,
}

impl ChimesHost {
    pub fn new() -> Self {
        let inner = expect_non_null(unsafe { crate::ffi::emenay_chimes_new() }, "Chimes");
        Self {
            inner,
            connected: vec![0; 8],
        }
    }

    pub fn reset(&mut self) {
        unsafe { crate::ffi::emenay_chimes_reset(self.inner) };
    }

    #[allow(clippy::too_many_arguments)]
    pub fn process_sample(
        &mut self,
        inputs: &[f32],
        connected: &[bool],
        outputs: &mut [f32],
        freq_hz: f32,
        structure: f32,
        brightness: f32,
        damping: f32,
        position: f32,
        model: f32,
        polyphony: f32,
    ) {
        for (i, &c) in connected.iter().enumerate().take(8) {
            self.connected[i] = i32::from(c);
        }
        unsafe {
            crate::ffi::emenay_chimes_process(
                self.inner,
                inputs.as_ptr(),
                self.connected.as_ptr(),
                outputs.as_mut_ptr(),
                freq_hz,
                structure,
                brightness,
                damping,
                position,
                model,
                polyphony,
            );
        }
    }
}

impl Drop for ChimesHost {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            unsafe { crate::ffi::emenay_chimes_delete(self.inner) };
            self.inner = ptr::null_mut();
        }
    }
}

unsafe impl Send for ChimesHost {}
