use std::ptr;

use crate::expect_non_null;
use crate::ffi::EmenayTwin;

pub struct TwinHost {
    inner: *mut EmenayTwin,
    connected: Vec<i32>,
}

impl TwinHost {
    pub fn new() -> Self {
        let inner = expect_non_null(unsafe { crate::ffi::emenay_twin_new() }, "Twin");
        Self {
            inner,
            connected: vec![0; 2],
        }
    }

    pub fn reset(&mut self) {
        unsafe { crate::ffi::emenay_twin_reset(self.inner) };
    }

    #[allow(clippy::too_many_arguments)]
    pub fn process_sample(
        &mut self,
        inputs: &[f32],
        connected: &[bool],
        outputs: &mut [f32],
        mode_a: i32,
        mode_b: i32,
        p1: f32,
        p2: f32,
        p3: f32,
        p4: f32,
        split: i32,
        level: f32,
    ) {
        for (i, &c) in connected.iter().enumerate().take(2) {
            self.connected[i] = i32::from(c);
        }
        unsafe {
            crate::ffi::emenay_twin_process(
                self.inner,
                inputs.as_ptr(),
                self.connected.as_ptr(),
                outputs.as_mut_ptr(),
                mode_a,
                mode_b,
                p1,
                p2,
                p3,
                p4,
                split,
                level,
            );
        }
    }
}

impl Drop for TwinHost {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            unsafe { crate::ffi::emenay_twin_delete(self.inner) };
            self.inner = ptr::null_mut();
        }
    }
}

unsafe impl Send for TwinHost {}
