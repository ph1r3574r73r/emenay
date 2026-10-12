use std::os::raw::{c_float, c_int};

pub enum EmenayFacets {}
pub enum EmenayChimes {}
pub enum EmenayTwist {}
pub enum EmenaySwell {}
pub enum EmenayLots {}
pub enum EmenayTwin {}

extern "C" {
    pub fn emenay_facets_new() -> *mut EmenayFacets;
    pub fn emenay_facets_delete(p: *mut EmenayFacets);
    pub fn emenay_facets_reset(p: *mut EmenayFacets);
    pub fn emenay_facets_process(
        p: *mut EmenayFacets,
        inputs: *const c_float,
        connected: *const c_int,
        outputs: *mut c_float,
        model: c_float,
        freq_hz: c_float,
        harmonics: c_float,
        timbre: c_float,
        morph: c_float,
        level: c_float,
    );

    pub fn emenay_chimes_new() -> *mut EmenayChimes;
    pub fn emenay_chimes_delete(p: *mut EmenayChimes);
    pub fn emenay_chimes_reset(p: *mut EmenayChimes);
    pub fn emenay_chimes_process(
        p: *mut EmenayChimes,
        inputs: *const c_float,
        connected: *const c_int,
        outputs: *mut c_float,
        freq_hz: c_float,
        structure: c_float,
        brightness: c_float,
        damping: c_float,
        position: c_float,
        model: c_float,
        polyphony: c_float,
    );

    pub fn emenay_twist_new() -> *mut EmenayTwist;
    pub fn emenay_twist_delete(p: *mut EmenayTwist);
    pub fn emenay_twist_reset(p: *mut EmenayTwist);
    pub fn emenay_twist_process(
        p: *mut EmenayTwist,
        inputs: *const c_float,
        connected: *const c_int,
        outputs: *mut c_float,
        algorithm: c_float,
        timbre: c_float,
        level1: c_float,
        level2: c_float,
        internal_freq_hz: c_float,
        carrier_shape: c_int,
    );

    pub fn emenay_swell_new() -> *mut EmenaySwell;
    pub fn emenay_swell_delete(p: *mut EmenaySwell);
    pub fn emenay_swell_reset(p: *mut EmenaySwell);
    pub fn emenay_swell_process(
        p: *mut EmenaySwell,
        inputs: *const c_float,
        connected: *const c_int,
        outputs: *mut c_float,
        freq_hz: c_float,
        shape: c_float,
        slope: c_float,
        smoothness: c_float,
        mode: c_int,
        range: c_int,
    );

    pub fn emenay_lots_new() -> *mut EmenayLots;
    pub fn emenay_lots_delete(p: *mut EmenayLots);
    pub fn emenay_lots_reset(p: *mut EmenayLots);
    pub fn emenay_lots_process(
        p: *mut EmenayLots,
        inputs: *const c_float,
        connected: *const c_int,
        outputs: *mut c_float,
        rate: c_float,
        bias: c_float,
        jitter: c_float,
        spread: c_float,
        x_bias: c_float,
        steps: c_float,
        deja_vu: c_float,
        deja_vu_length: c_float,
        t_mode: c_int,
        x_mode: c_int,
        lights_t: *mut c_float,
    );

    pub fn emenay_twin_new() -> *mut EmenayTwin;
    pub fn emenay_twin_delete(p: *mut EmenayTwin);
    pub fn emenay_twin_reset(p: *mut EmenayTwin);
    pub fn emenay_twin_process(
        p: *mut EmenayTwin,
        inputs: *const c_float,
        connected: *const c_int,
        outputs: *mut c_float,
        mode_a: c_int,
        mode_b: c_int,
        p1: c_float,
        p2: c_float,
        p3: c_float,
        p4: c_float,
        split: c_int,
        level: c_float,
    );
}
