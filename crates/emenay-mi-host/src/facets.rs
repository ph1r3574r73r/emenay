use std::ptr;

use crate::expect_non_null;
use crate::ffi::EmenayFacets;

pub struct FacetsHost {
    inner: *mut EmenayFacets,
    connected: Vec<i32>,
}

impl FacetsHost {
    pub fn new() -> Self {
        let inner = expect_non_null(unsafe { crate::ffi::emenay_facets_new() }, "Facets");
        Self {
            inner,
            connected: vec![0; 8],
        }
    }

    pub fn reset(&mut self) {
        unsafe { crate::ffi::emenay_facets_reset(self.inner) };
    }

    #[allow(clippy::too_many_arguments)]
    pub fn process_sample(
        &mut self,
        inputs: &[f32],
        connected: &[bool],
        outputs: &mut [f32],
        model: f32,
        freq_hz: f32,
        harmonics: f32,
        timbre: f32,
        morph: f32,
        level: f32,
    ) {
        for (i, &c) in connected.iter().enumerate().take(8) {
            self.connected[i] = i32::from(c);
        }
        unsafe {
            crate::ffi::emenay_facets_process(
                self.inner,
                inputs.as_ptr(),
                self.connected.as_ptr(),
                outputs.as_mut_ptr(),
                model,
                freq_hz,
                harmonics,
                timbre,
                morph,
                level,
            );
        }
    }
}

impl Drop for FacetsHost {
    fn drop(&mut self) {
        if !self.inner.is_null() {
            unsafe { crate::ffi::emenay_facets_delete(self.inner) };
            self.inner = ptr::null_mut();
        }
    }
}

unsafe impl Send for FacetsHost {}
