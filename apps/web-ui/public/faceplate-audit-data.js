// src/panelLayouts.ts
function mm(cx, cy, viewW, viewH) {
  return { x: cx / viewW * 100, y: cy / viewH * 100 };
}
var EM2 = { w: 10.16, h: 128.5 };
var FM4 = { w: 20, h: 128.5 };
var EM4 = { w: 20.32, h: 128.5 };
var FM6 = { w: 30.48, h: 128.5 };
var FM8 = { w: 40.3, h: 128.5 };
var EM8 = { w: 40.64, h: 128.5 };
var FM10 = { w: 50.8, h: 128.5 };
var FM10R = { w: 50.5, h: 128.5 };
var FM12 = { w: 60.96, h: 128.5 };
var FM16 = { w: 81.28, h: 128.5 };
var FM18 = { w: 91.44, h: 128.5 };
var FM26 = { w: 132.08, h: 128.5 };
var FM32 = { w: 162.56, h: 128.5 };
var KNOB_BLACK = "#1a1a1c";
var ENV_A = "#fef139";
var ENV_D = "#0998c1";
var ENV_S = "#d23e3e";
var ENV_R = "#379a64";
var fmMixer = {
  source: "Free Modular mixer.svg throughholes",
  hits: [
    { id: "in1", kind: "in", ...mm(6.18, 21.08, FM8.w, FM8.h), size: "md" },
    // Mid column cosmetics are rocker mute toggles (lever path), not LED bezels.
    { id: "mute1", kind: "toggle", ...mm(16.34, 21.08, FM8.w, FM8.h), size: "sm", label: "MUTE" },
    { id: "ch1", kind: "param", ...mm(31.58, 21.08, FM8.w, FM8.h), size: "md", color: KNOB_BLACK },
    { id: "in2", kind: "in", ...mm(6.18, 41.4, FM8.w, FM8.h), size: "md" },
    { id: "mute2", kind: "toggle", ...mm(16.34, 41.4, FM8.w, FM8.h), size: "sm", label: "MUTE" },
    { id: "ch2", kind: "param", ...mm(31.58, 41.4, FM8.w, FM8.h), size: "md", color: KNOB_BLACK },
    { id: "in3", kind: "in", ...mm(6.18, 61.72, FM8.w, FM8.h), size: "md" },
    { id: "mute3", kind: "toggle", ...mm(16.34, 61.72, FM8.w, FM8.h), size: "sm", label: "MUTE" },
    { id: "ch3", kind: "param", ...mm(31.58, 61.72, FM8.w, FM8.h), size: "md", color: KNOB_BLACK },
    { id: "in4", kind: "in", ...mm(6.18, 82.04, FM8.w, FM8.h), size: "md" },
    { id: "mute4", kind: "toggle", ...mm(16.34, 82.04, FM8.w, FM8.h), size: "sm", label: "MUTE" },
    { id: "ch4", kind: "param", ...mm(31.58, 82.04, FM8.w, FM8.h), size: "md", color: KNOB_BLACK },
    // Master mix LED cosmetic (@ ~35.39, 94.74).
    { id: "level", kind: "led", ...mm(35.39, 94.74, FM8.w, FM8.h), size: "sm", color: "#4caf50" },
    { id: "out2", kind: "out", ...mm(6.18, 102.36, FM8.w, FM8.h), size: "md" },
    // 5th rocker between MIX outs — mute both outs.
    { id: "mute_mix", kind: "toggle", ...mm(16.34, 102.36, FM8.w, FM8.h), size: "sm", label: "MUTE" },
    { id: "out", kind: "out", ...mm(31.58, 102.36, FM8.w, FM8.h), size: "md" }
  ]
};
var fmEnvelope = {
  source: "Free Modular envelope.svg throughholes",
  hits: [
    { id: "attack", kind: "param", ...mm(30.31, 28.51, FM8.w, FM8.h), size: "md", color: ENV_A },
    { id: "decay", kind: "param", ...mm(30.31, 48.83, FM8.w, FM8.h), size: "md", color: ENV_D },
    { id: "sustain", kind: "param", ...mm(30.31, 69.15, FM8.w, FM8.h), size: "md", color: ENV_S },
    { id: "release", kind: "param", ...mm(30.31, 89.47, FM8.w, FM8.h), size: "md", color: ENV_R },
    // Left column: stage indicator LEDs fill the letter through-holes.
    { id: "attack", kind: "led", ...mm(7.45, 28.51, FM8.w, FM8.h), size: "md", color: ENV_A, label: "stage" },
    { id: "decay", kind: "led", ...mm(7.45, 48.83, FM8.w, FM8.h), size: "md", color: ENV_D, label: "stage" },
    { id: "sustain", kind: "led", ...mm(7.45, 69.15, FM8.w, FM8.h), size: "md", color: ENV_S, label: "stage" },
    { id: "release", kind: "led", ...mm(7.45, 89.47, FM8.w, FM8.h), size: "md", color: ENV_R, label: "stage" },
    // Small status LED above the stage column (cosmetics @ ~7.45, 15.8).
    { id: "level", kind: "led", ...mm(7.45, 15.81, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "gate", kind: "in", ...mm(4.91, 106.62, FM8.w, FM8.h), size: "md" },
    { id: "trig", kind: "in", ...mm(15.07, 106.62, FM8.w, FM8.h), size: "md" },
    { id: "env", kind: "out", ...mm(25.23, 106.62, FM8.w, FM8.h), size: "md" },
    { id: "eoc", kind: "out", ...mm(35.39, 106.62, FM8.w, FM8.h), size: "md" }
  ]
};
var emenayMidiCv = {
  source: "emenay fm/midi_cv.svg",
  hits: [
    { id: "midi", kind: "led", ...mm(10, 16.5, FM12.w, FM12.h), size: "sm", color: "#6adf8a" },
    {
      id: "omni",
      kind: "toggle",
      ...mm(18, 16.5, FM12.w, FM12.h),
      size: "sm",
      label: "OMNI",
      shape: "rect"
    },
    {
      id: "poly",
      kind: "toggle",
      ...mm(28, 16.5, FM12.w, FM12.h),
      size: "sm",
      label: "POLY",
      shape: "rect"
    },
    {
      id: "voices",
      kind: "param",
      ...mm(38, 16.5, FM12.w, FM12.h),
      size: "sm",
      label: "VOX",
      color: KNOB_BLACK
    },
    {
      id: "bend_range",
      kind: "param",
      ...mm(48, 16.5, FM12.w, FM12.h),
      size: "sm",
      label: "RANGE",
      color: KNOB_BLACK
    },
    { id: "bend", kind: "out", ...mm(10, 28, FM12.w, FM12.h), size: "sm", label: "BEND" },
    { id: "bend", kind: "led", ...mm(15.8, 28, FM12.w, FM12.h), size: "sm", color: "#6adf8a" },
    { id: "mod", kind: "out", ...mm(25, 28, FM12.w, FM12.h), size: "sm", label: "MOD" },
    { id: "mod", kind: "led", ...mm(30.8, 28, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "at", kind: "out", ...mm(40, 28, FM12.w, FM12.h), size: "sm", label: "AT" },
    { id: "at", kind: "led", ...mm(45.8, 28, FM12.w, FM12.h), size: "sm", color: "#6adf8a" },
    { id: "sustain", kind: "out", ...mm(53, 28, FM12.w, FM12.h), size: "sm", label: "SUS" },
    { id: "sustain", kind: "led", ...mm(58.2, 28, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "cv1", kind: "out", ...mm(18, 45.5, FM12.w, FM12.h), size: "md", label: "CV1" },
    { id: "gate1", kind: "out", ...mm(43, 45.5, FM12.w, FM12.h), size: "md", label: "G1" },
    { id: "gate1", kind: "led", ...mm(50.2, 45.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "cv2", kind: "out", ...mm(18, 55.5, FM12.w, FM12.h), size: "md", label: "CV2" },
    { id: "gate2", kind: "out", ...mm(43, 55.5, FM12.w, FM12.h), size: "md", label: "G2" },
    { id: "gate2", kind: "led", ...mm(50.2, 55.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "cv3", kind: "out", ...mm(18, 65.5, FM12.w, FM12.h), size: "md", label: "CV3" },
    { id: "gate3", kind: "out", ...mm(43, 65.5, FM12.w, FM12.h), size: "md", label: "G3" },
    { id: "gate3", kind: "led", ...mm(50.2, 65.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "cv4", kind: "out", ...mm(18, 75.5, FM12.w, FM12.h), size: "md", label: "CV4" },
    { id: "gate4", kind: "out", ...mm(43, 75.5, FM12.w, FM12.h), size: "md", label: "G4" },
    { id: "gate4", kind: "led", ...mm(50.2, 75.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "cv5", kind: "out", ...mm(18, 85.5, FM12.w, FM12.h), size: "md", label: "CV5" },
    { id: "gate5", kind: "out", ...mm(43, 85.5, FM12.w, FM12.h), size: "md", label: "G5" },
    { id: "gate5", kind: "led", ...mm(50.2, 85.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "cv6", kind: "out", ...mm(18, 95.5, FM12.w, FM12.h), size: "md", label: "CV6" },
    { id: "gate6", kind: "out", ...mm(43, 95.5, FM12.w, FM12.h), size: "md", label: "G6" },
    { id: "gate6", kind: "led", ...mm(50.2, 95.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "cv7", kind: "out", ...mm(18, 105.5, FM12.w, FM12.h), size: "md", label: "CV7" },
    { id: "gate7", kind: "out", ...mm(43, 105.5, FM12.w, FM12.h), size: "md", label: "G7" },
    { id: "gate7", kind: "led", ...mm(50.2, 105.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "cv8", kind: "out", ...mm(18, 115.5, FM12.w, FM12.h), size: "md", label: "CV8" },
    { id: "gate8", kind: "out", ...mm(43, 115.5, FM12.w, FM12.h), size: "md", label: "G8" },
    { id: "gate8", kind: "led", ...mm(50.2, 115.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" }
  ]
};
var fmOutput = {
  source: "emenay fm/output.svg (Erica DIY Output)",
  hits: [
    { id: "level", kind: "param", ...mm(13.8, 36.05, FM8.w, FM8.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    { id: "in_l", kind: "in", ...mm(12.53, 56.37, FM8.w, FM8.h), size: "md", label: "IN L" },
    { id: "in_r", kind: "in", ...mm(27.77, 56.37, FM8.w, FM8.h), size: "md", label: "IN R" },
    { id: "line_l", kind: "out", ...mm(20.15, 75.42, FM8.w, FM8.h), size: "md", label: "LINE L" },
    { id: "line_r", kind: "out", ...mm(20.15, 91.93, FM8.w, FM8.h), size: "md", label: "LINE R" },
    // Stereo dB meters: +6 red · +3/0 yellow · −9/−18 green.
    { id: "meter_l_p6", kind: "led", ...mm(8.72, 79.23, FM8.w, FM8.h), size: "sm", color: "#e53935" },
    { id: "meter_l_p3", kind: "led", ...mm(8.72, 85.58, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "meter_l_0", kind: "led", ...mm(8.72, 91.93, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "meter_l_m9", kind: "led", ...mm(8.72, 98.28, FM8.w, FM8.h), size: "sm", color: "#4caf50" },
    { id: "meter_l_m18", kind: "led", ...mm(8.72, 104.63, FM8.w, FM8.h), size: "sm", color: "#4caf50" },
    { id: "meter_r_p6", kind: "led", ...mm(31.58, 79.23, FM8.w, FM8.h), size: "sm", color: "#e53935" },
    { id: "meter_r_p3", kind: "led", ...mm(31.58, 85.58, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "meter_r_0", kind: "led", ...mm(31.58, 91.93, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "meter_r_m9", kind: "led", ...mm(31.58, 98.28, FM8.w, FM8.h), size: "sm", color: "#4caf50" },
    { id: "meter_r_m18", kind: "led", ...mm(31.58, 104.63, FM8.w, FM8.h), size: "sm", color: "#4caf50" }
  ]
};
var fmClock = {
  source: "Free Modular clock.svg throughholes",
  hits: [
    { id: "bpm", kind: "param", ...mm(30.31, 45.63, FM8.w, FM8.h), size: "lg", color: KNOB_BLACK },
    // Yellow encoder graphic on the Free Modular plate (cosmetics @ 9.99, 45.63).
    { id: "pw", kind: "param", ...mm(9.99, 45.63, FM8.w, FM8.h), size: "sm", label: "PW", color: "#e8c547" },
    // LCD window: rect @ (8.245, 14.74) 23.81×12.905 → center + fill.
    {
      id: "bpm",
      kind: "digit",
      ...mm(20.15, 21.19, FM8.w, FM8.h),
      size: "lg",
      digits: 3,
      color: "#e8c547",
      w: 23.81 / FM8.w * 100,
      h: 12.905 / FM8.h * 100
    },
    { id: "clk1", kind: "out", ...mm(12.53, 64.68, FM8.w, FM8.h), size: "md" },
    { id: "clk2", kind: "out", ...mm(27.77, 64.68, FM8.w, FM8.h), size: "md" },
    { id: "clk3", kind: "out", ...mm(12.53, 79.92, FM8.w, FM8.h), size: "md" },
    { id: "clk4", kind: "out", ...mm(27.77, 79.92, FM8.w, FM8.h), size: "md" },
    { id: "clk5", kind: "out", ...mm(12.53, 95.16, FM8.w, FM8.h), size: "md" },
    { id: "clk6", kind: "out", ...mm(27.77, 95.16, FM8.w, FM8.h), size: "md" },
    { id: "clk7", kind: "out", ...mm(12.53, 110.4, FM8.w, FM8.h), size: "md" },
    { id: "clk8", kind: "out", ...mm(27.77, 110.4, FM8.w, FM8.h), size: "md" },
    // LED cosmetics sit inboard of each jack, ~6.35mm above the jack center.
    { id: "clk1", kind: "led", ...mm(16.34, 58.33, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "clk2", kind: "led", ...mm(31.58, 58.33, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "clk3", kind: "led", ...mm(16.34, 73.57, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "clk4", kind: "led", ...mm(31.58, 73.57, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "clk5", kind: "led", ...mm(16.34, 88.81, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "clk6", kind: "led", ...mm(31.58, 88.81, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "clk7", kind: "led", ...mm(16.34, 104.05, FM8.w, FM8.h), size: "sm", color: "#e8c547" },
    { id: "clk8", kind: "led", ...mm(31.58, 104.05, FM8.w, FM8.h), size: "sm", color: "#e8c547" }
  ]
};
var fmOffset = {
  source: "Free Modular offset_atten.svg throughholes",
  hits: [
    { id: "atten_a", kind: "param", ...mm(12.54, 17.54, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "offset_a", kind: "param", ...mm(7.46, 37.86, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "led_a", kind: "led", ...mm(17.62, 46.75, FM4.w, FM4.h), size: "sm", color: "#e8c547" },
    { id: "in_a", kind: "in", ...mm(4.92, 54.37, FM4.w, FM4.h), size: "md" },
    { id: "out_a", kind: "out", ...mm(15.08, 54.37, FM4.w, FM4.h), size: "md" },
    { id: "atten_b", kind: "param", ...mm(12.54, 72.15, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "offset_b", kind: "param", ...mm(7.46, 92.47, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "led_b", kind: "led", ...mm(17.62, 101.36, FM4.w, FM4.h), size: "sm", color: "#e8c547" },
    { id: "in_b", kind: "in", ...mm(4.92, 108.98, FM4.w, FM4.h), size: "md" },
    { id: "out_b", kind: "out", ...mm(15.08, 108.98, FM4.w, FM4.h), size: "md" }
  ]
};
var fmDrift = {
  source: "Free Modular drift.svg throughholes",
  hits: [
    { id: "rate", kind: "param", ...mm(10, 20.62, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "depth", kind: "param", ...mm(10, 43.48, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "smooth", kind: "param", ...mm(10, 66.34, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "rate_cv", kind: "in", ...mm(4.92, 89.2, FM4.w, FM4.h), size: "md" },
    { id: "out", kind: "out", ...mm(15.08, 89.2, FM4.w, FM4.h), size: "md" },
    { id: "led", kind: "led", ...mm(4.92, 104.44, FM4.w, FM4.h), size: "sm", color: "#e8c547" },
    { id: "inv", kind: "out", ...mm(15.08, 104.44, FM4.w, FM4.h), size: "md" }
  ]
};
var fmBoost = {
  source: "Free Modular boost.svg throughholes",
  hits: [
    { id: "gain", kind: "param", ...mm(10, 24.7, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "tone", kind: "param", ...mm(10, 47.56, FM4.w, FM4.h), size: "md", color: KNOB_BLACK },
    { id: "in", kind: "in", ...mm(10, 83.12, FM4.w, FM4.h), size: "md" },
    { id: "out", kind: "out", ...mm(10, 100.9, FM4.w, FM4.h), size: "md" }
  ]
};
var fmRng = {
  source: "Free Modular rng.svg throughholes",
  hits: [
    // Top bit bar (shift-register LEDs), left = LSB.
    { id: "bit0", kind: "led", ...mm(6.2, 16.81, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "bit1", kind: "led", ...mm(12.55, 16.81, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "bit2", kind: "led", ...mm(18.9, 16.81, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "bit3", kind: "led", ...mm(25.25, 16.81, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "bit4", kind: "led", ...mm(31.6, 16.81, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "bit5", kind: "led", ...mm(37.95, 16.81, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "bit6", kind: "led", ...mm(44.3, 16.81, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "prob", kind: "param", ...mm(12.55, 30.78, FM10R.w, FM10R.h), size: "md", color: KNOB_BLACK },
    { id: "steps", kind: "param", ...mm(37.95, 30.78, FM10R.w, FM10R.h), size: "md", color: KNOB_BLACK },
    { id: "scale", kind: "param", ...mm(12.55, 56.18, FM10R.w, FM10R.h), size: "md", color: KNOB_BLACK },
    { id: "bias", kind: "param", ...mm(37.95, 56.18, FM10R.w, FM10R.h), size: "md", color: KNOB_BLACK },
    // HOLD / WRITE pushbuttons on the Free Modular plate.
    { id: "hold", kind: "toggle", ...mm(12.55, 76.5, FM10R.w, FM10R.h), size: "md", label: "HOLD" },
    { id: "write_btn", kind: "toggle", ...mm(37.95, 76.5, FM10R.w, FM10R.h), size: "md", label: "WRITE" },
    { id: "clock", kind: "in", ...mm(7.47, 91.177, FM10R.w, FM10R.h), size: "md" },
    { id: "prob_cv", kind: "in", ...mm(17.63, 91.177, FM10R.w, FM10R.h), size: "md" },
    { id: "write", kind: "in", ...mm(12.55, 105, FM10R.w, FM10R.h), size: "md" },
    { id: "cv", kind: "out", ...mm(37.95, 91.177, FM10R.w, FM10R.h), size: "md" },
    { id: "gate", kind: "out", ...mm(32.87, 105, FM10R.w, FM10R.h), size: "md" },
    { id: "inv", kind: "out", ...mm(43.03, 105, FM10R.w, FM10R.h), size: "md" },
    // Status LEDs beside the lower jack row.
    { id: "clock", kind: "led", ...mm(3.66, 98.09, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "write", kind: "led", ...mm(21.44, 98.09, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "gate", kind: "led", ...mm(29.06, 98.09, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" },
    { id: "hold", kind: "led", ...mm(46.84, 98.09, FM10R.w, FM10R.h), size: "sm", color: "#e8c547" }
  ]
};
var emenayVco = {
  source: "emenay fm/vco.svg (Polivoks VCO3 layout)",
  hits: [
    { id: "freq", kind: "param", ...mm(30.48, 27.5, FM12.w, FM12.h), size: "lg", label: "TUNE", color: KNOB_BLACK },
    { id: "fm_amt", kind: "param", ...mm(15.5, 51, FM12.w, FM12.h), size: "md", label: "FM", color: KNOB_BLACK },
    { id: "pwm_amt", kind: "param", ...mm(15.5, 71, FM12.w, FM12.h), size: "md", label: "PWM", color: KNOB_BLACK },
    { id: "fm", kind: "in", ...mm(46.5, 51, FM12.w, FM12.h), size: "md", label: "FM IN" },
    { id: "pwm", kind: "in", ...mm(46.5, 67, FM12.w, FM12.h), size: "md", label: "PWM IN" },
    { id: "sync", kind: "in", ...mm(46.5, 83, FM12.w, FM12.h), size: "md", label: "SYNC" },
    { id: "v_oct", kind: "in", ...mm(10.5, 106.5, FM12.w, FM12.h), size: "md", label: "1V/OCT" },
    { id: "saw", kind: "out", ...mm(24, 106.5, FM12.w, FM12.h), size: "md", label: "SAW" },
    { id: "tri", kind: "out", ...mm(37.5, 106.5, FM12.w, FM12.h), size: "md", label: "TRI" },
    { id: "sq", kind: "out", ...mm(50.5, 106.5, FM12.w, FM12.h), size: "md", label: "PULSE" }
  ]
};
var emenayDualVca = {
  source: "emenay fm/dual_vca.svg (Erica Dual VCA layout)",
  hits: [
    { id: "bias_a", kind: "param", ...mm(34, 25.5, FM10.w, FM10.h), size: "lg", label: "BIAS A", color: KNOB_BLACK },
    { id: "bias_b", kind: "param", ...mm(34, 47.5, FM10.w, FM10.h), size: "lg", label: "BIAS B", color: KNOB_BLACK },
    { id: "exp_a", kind: "toggle", ...mm(14, 25.5, FM10.w, FM10.h), size: "sm", label: "EXP A" },
    { id: "exp_b", kind: "toggle", ...mm(14, 47.5, FM10.w, FM10.h), size: "sm", label: "EXP B" },
    { id: "cv_a", kind: "in", ...mm(14, 71, FM10.w, FM10.h), size: "md", label: "CV A" },
    { id: "cv_b", kind: "in", ...mm(36.8, 71, FM10.w, FM10.h), size: "md", label: "CV B" },
    { id: "in_a", kind: "in", ...mm(14, 87, FM10.w, FM10.h), size: "md", label: "IN A" },
    { id: "in_b", kind: "in", ...mm(36.8, 87, FM10.w, FM10.h), size: "md", label: "IN B" },
    { id: "out_a", kind: "out", ...mm(10, 106.5, FM10.w, FM10.h), size: "md", label: "OUT A" },
    { id: "out_b", kind: "out", ...mm(25.4, 106.5, FM10.w, FM10.h), size: "md", label: "OUT B" },
    { id: "sum", kind: "out", ...mm(40.8, 106.5, FM10.w, FM10.h), size: "md", label: "SUM" }
  ]
};
var emenayVcf = {
  source: "emenay fm/vcf.svg",
  hits: [
    { id: "cutoff", kind: "param", ...mm(25.4, 28, FM10.w, FM10.h), size: "lg", label: "CUTOFF", color: KNOB_BLACK },
    { id: "res", kind: "param", ...mm(14, 54, FM10.w, FM10.h), size: "md", label: "RES", color: KNOB_BLACK },
    { id: "fm_amt", kind: "param", ...mm(36.8, 54, FM10.w, FM10.h), size: "md", label: "FM", color: KNOB_BLACK },
    { id: "in", kind: "in", ...mm(14, 78, FM10.w, FM10.h), size: "md", label: "IN" },
    { id: "fm", kind: "in", ...mm(36.8, 78, FM10.w, FM10.h), size: "md", label: "FM IN" },
    { id: "res_cv", kind: "in", ...mm(14, 94, FM10.w, FM10.h), size: "md", label: "RES CV" },
    { id: "lp", kind: "out", ...mm(10, 110, FM10.w, FM10.h), size: "md", label: "LP" },
    { id: "bp", kind: "out", ...mm(25.4, 110, FM10.w, FM10.h), size: "md", label: "BP" },
    { id: "hp", kind: "out", ...mm(40.8, 110, FM10.w, FM10.h), size: "md", label: "HP" }
  ]
};
var ericaVco3 = {
  source: "emenay fm/erica_vco3.svg",
  hits: [
    { id: "freq", kind: "param", ...mm(30.48, 27.5, FM12.w, FM12.h), size: "lg", label: "TUNE", color: KNOB_BLACK },
    { id: "fm_amt", kind: "param", ...mm(15.5, 51, FM12.w, FM12.h), size: "md", label: "FM", color: KNOB_BLACK },
    { id: "pwm_amt", kind: "param", ...mm(15.5, 71, FM12.w, FM12.h), size: "md", label: "PWM", color: KNOB_BLACK },
    { id: "fm", kind: "in", ...mm(46.5, 51, FM12.w, FM12.h), size: "md", label: "FM IN" },
    { id: "pwm", kind: "in", ...mm(46.5, 67, FM12.w, FM12.h), size: "md", label: "PWM IN" },
    { id: "sync", kind: "in", ...mm(46.5, 83, FM12.w, FM12.h), size: "md", label: "SYNC" },
    { id: "v_oct", kind: "in", ...mm(10.5, 106.5, FM12.w, FM12.h), size: "md", label: "1V/OCT" },
    { id: "saw", kind: "out", ...mm(24, 106.5, FM12.w, FM12.h), size: "md", label: "SAW" },
    { id: "tri", kind: "out", ...mm(37.5, 106.5, FM12.w, FM12.h), size: "md", label: "TRI" },
    { id: "sq", kind: "out", ...mm(50.5, 106.5, FM12.w, FM12.h), size: "md", label: "PULSE" }
  ]
};
var ericaPolivoksVcf = {
  source: "emenay fm/erica_polivoks_vcf.svg",
  hits: [
    { id: "cutoff", kind: "param", ...mm(25.4, 28, FM10.w, FM10.h), size: "lg", label: "CUTOFF", color: KNOB_BLACK },
    { id: "res", kind: "param", ...mm(14, 54, FM10.w, FM10.h), size: "md", label: "RES", color: KNOB_BLACK },
    { id: "drive", kind: "param", ...mm(36.8, 54, FM10.w, FM10.h), size: "md", label: "DRIVE", color: KNOB_BLACK },
    { id: "in", kind: "in", ...mm(14, 78, FM10.w, FM10.h), size: "md", label: "IN" },
    { id: "fm", kind: "in", ...mm(36.8, 78, FM10.w, FM10.h), size: "md", label: "CV" },
    { id: "res_cv", kind: "in", ...mm(14, 94, FM10.w, FM10.h), size: "md", label: "RES CV" },
    { id: "lp", kind: "out", ...mm(14, 110, FM10.w, FM10.h), size: "md", label: "LP" },
    { id: "bp", kind: "out", ...mm(36.8, 110, FM10.w, FM10.h), size: "md", label: "BP" }
  ]
};
var ericaModulator = {
  source: "emenay fm/erica_modulator.svg",
  hits: [
    { id: "rate", kind: "param", ...mm(18, 30, FM12.w, FM12.h), size: "lg", label: "RATE", color: KNOB_BLACK },
    { id: "shape", kind: "param", ...mm(43, 30, FM12.w, FM12.h), size: "lg", label: "SHAPE", color: KNOB_BLACK },
    { id: "noise_lvl", kind: "param", ...mm(18, 58, FM12.w, FM12.h), size: "md", label: "NOISE", color: KNOB_BLACK },
    { id: "slew", kind: "param", ...mm(43, 58, FM12.w, FM12.h), size: "md", label: "SLEW", color: KNOB_BLACK },
    { id: "rate_cv", kind: "in", ...mm(12, 86, FM12.w, FM12.h), size: "md", label: "RATE" },
    { id: "reset", kind: "in", ...mm(30.48, 86, FM12.w, FM12.h), size: "md", label: "RESET" },
    { id: "clock", kind: "in", ...mm(49, 86, FM12.w, FM12.h), size: "md", label: "CLK" },
    { id: "sh_in", kind: "in", ...mm(12, 108, FM12.w, FM12.h), size: "md", label: "S&H IN" },
    { id: "lfo", kind: "out", ...mm(30.48, 108, FM12.w, FM12.h), size: "md", label: "LFO" },
    { id: "noise", kind: "out", ...mm(40.5, 108, FM12.w, FM12.h), size: "md", label: "NOISE" },
    { id: "sh", kind: "out", ...mm(50.5, 108, FM12.w, FM12.h), size: "md", label: "S&H" }
  ]
};
var ericaBassline = {
  source: "emenay fm/erica_bassline.svg",
  hits: [
    { id: "tune", kind: "param", ...mm(20, 32, FM16.w, FM16.h), size: "lg", label: "TUNE", color: KNOB_BLACK },
    { id: "cutoff", kind: "param", ...mm(40.64, 32, FM16.w, FM16.h), size: "lg", label: "CUTOFF", color: KNOB_BLACK },
    { id: "res", kind: "param", ...mm(61.5, 32, FM16.w, FM16.h), size: "lg", label: "RES", color: KNOB_BLACK },
    { id: "decay", kind: "param", ...mm(20, 62, FM16.w, FM16.h), size: "md", label: "DECAY", color: KNOB_BLACK },
    { id: "accent", kind: "param", ...mm(40.64, 62, FM16.w, FM16.h), size: "md", label: "ACCENT", color: KNOB_BLACK },
    { id: "drive", kind: "param", ...mm(61.5, 62, FM16.w, FM16.h), size: "md", label: "DRIVE", color: KNOB_BLACK },
    { id: "v_oct", kind: "in", ...mm(14, 92, FM16.w, FM16.h), size: "md", label: "1V/OCT" },
    { id: "gate", kind: "in", ...mm(32, 92, FM16.w, FM16.h), size: "md", label: "GATE" },
    { id: "accent_gate", kind: "in", ...mm(50, 92, FM16.w, FM16.h), size: "md", label: "ACC" },
    { id: "cutoff_cv", kind: "in", ...mm(68, 92, FM16.w, FM16.h), size: "md", label: "CUT CV" },
    { id: "out", kind: "out", ...mm(40.64, 112, FM16.w, FM16.h), size: "md", label: "OUT" }
  ]
};
var ericaBbd = {
  source: "emenay fm/erica_bbd.svg",
  hits: [
    { id: "time", kind: "param", ...mm(25.4, 30, FM10.w, FM10.h), size: "lg", label: "TIME", color: KNOB_BLACK },
    { id: "feedback", kind: "param", ...mm(14, 58, FM10.w, FM10.h), size: "md", label: "FB", color: KNOB_BLACK },
    { id: "mix", kind: "param", ...mm(36.8, 58, FM10.w, FM10.h), size: "md", label: "MIX", color: KNOB_BLACK },
    { id: "colour", kind: "param", ...mm(14, 80, FM10.w, FM10.h), size: "md", label: "COLOUR", color: KNOB_BLACK },
    { id: "mod_rate", kind: "param", ...mm(36.8, 80, FM10.w, FM10.h), size: "md", label: "MOD", color: KNOB_BLACK },
    { id: "in", kind: "in", ...mm(10, 104, FM10.w, FM10.h), size: "md", label: "IN" },
    { id: "time_cv", kind: "in", ...mm(25.4, 104, FM10.w, FM10.h), size: "md", label: "TIME" },
    { id: "inhibit", kind: "in", ...mm(40.8, 104, FM10.w, FM10.h), size: "md", label: "INH" },
    { id: "wet", kind: "out", ...mm(14, 118, FM10.w, FM10.h), size: "md", label: "WET" },
    { id: "mix_out", kind: "out", ...mm(36.8, 118, FM10.w, FM10.h), size: "md", label: "MIX" }
  ]
};
var ericaSwamp = {
  source: "emenay fm/erica_swamp.svg",
  hits: [
    { id: "rate", kind: "param", ...mm(18, 32, FM12.w, FM12.h), size: "lg", label: "RATE", color: KNOB_BLACK },
    { id: "chaos", kind: "param", ...mm(43, 32, FM12.w, FM12.h), size: "lg", label: "CHAOS", color: KNOB_BLACK },
    { id: "lag", kind: "param", ...mm(30.48, 62, FM12.w, FM12.h), size: "md", label: "LAG", color: KNOB_BLACK },
    { id: "rate_cv", kind: "in", ...mm(12, 90, FM12.w, FM12.h), size: "md", label: "RATE" },
    { id: "chaos_cv", kind: "in", ...mm(30.48, 90, FM12.w, FM12.h), size: "md", label: "CHAOS" },
    { id: "clock", kind: "in", ...mm(49, 90, FM12.w, FM12.h), size: "md", label: "CLK" },
    { id: "stepped", kind: "out", ...mm(10, 110, FM12.w, FM12.h), size: "md", label: "STEP" },
    { id: "smooth", kind: "out", ...mm(23.5, 110, FM12.w, FM12.h), size: "md", label: "SMOOTH" },
    { id: "burst", kind: "out", ...mm(37.5, 110, FM12.w, FM12.h), size: "md", label: "BURST" },
    { id: "noise", kind: "out", ...mm(51, 110, FM12.w, FM12.h), size: "md", label: "NOISE" }
  ]
};
var emenayNoise = {
  source: "emenay fm/noise.svg",
  hits: [
    { id: "level", kind: "param", ...mm(15.24, 30, FM6.w, FM6.h), size: "lg", label: "LEVEL", color: KNOB_BLACK },
    { id: "color", kind: "param", ...mm(15.24, 54, FM6.w, FM6.h), size: "md", label: "COLOR", color: KNOB_BLACK },
    { id: "level_cv", kind: "in", ...mm(15.24, 80, FM6.w, FM6.h), size: "md", label: "LVL CV" },
    { id: "white", kind: "out", ...mm(8, 98, FM6.w, FM6.h), size: "md", label: "WHITE" },
    { id: "pink", kind: "out", ...mm(22.5, 98, FM6.w, FM6.h), size: "md", label: "PINK" },
    { id: "slow", kind: "out", ...mm(15.24, 112, FM6.w, FM6.h), size: "md", label: "SLOW" }
  ]
};
var emenayFacets = {
  source: "emenay fm/facets.svg",
  hits: [
    { id: "model", kind: "param", ...mm(15, 27, FM12.w, FM12.h), size: "md", label: "MODEL", color: KNOB_BLACK },
    { id: "freq", kind: "param", ...mm(45.5, 27, FM12.w, FM12.h), size: "lg", label: "FREQ", color: KNOB_BLACK },
    { id: "harmonics", kind: "param", ...mm(15, 48, FM12.w, FM12.h), size: "md", label: "HARM", color: KNOB_BLACK },
    { id: "timbre", kind: "param", ...mm(30.48, 48, FM12.w, FM12.h), size: "md", label: "TIMBRE", color: KNOB_BLACK },
    { id: "morph", kind: "param", ...mm(45.5, 48, FM12.w, FM12.h), size: "md", label: "MORPH", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(30.48, 68, FM12.w, FM12.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    // Top CV row — columns align with bottom I/O.
    { id: "v_oct", kind: "in", ...mm(7.5, 90, FM12.w, FM12.h), size: "sm", label: "1V/OCT" },
    { id: "trig", kind: "in", ...mm(18.5, 90, FM12.w, FM12.h), size: "sm", label: "TRIG" },
    { id: "level_cv", kind: "in", ...mm(29.5, 90, FM12.w, FM12.h), size: "sm", label: "LEVEL" },
    { id: "model_cv", kind: "in", ...mm(40.5, 90, FM12.w, FM12.h), size: "sm", label: "MODEL" },
    { id: "harmonics_cv", kind: "in", ...mm(51.5, 90, FM12.w, FM12.h), size: "sm", label: "HARM" },
    // Bottom row — TIMBRE / MORPH / FM / OUT / AUX on one baseline.
    { id: "timbre_cv", kind: "in", ...mm(7.5, 108, FM12.w, FM12.h), size: "sm", label: "TIMBRE" },
    { id: "morph_cv", kind: "in", ...mm(18.5, 108, FM12.w, FM12.h), size: "sm", label: "MORPH" },
    { id: "fm", kind: "in", ...mm(29.5, 108, FM12.w, FM12.h), size: "sm", label: "FM" },
    { id: "out", kind: "out", ...mm(40.5, 108, FM12.w, FM12.h), size: "sm", label: "OUT" },
    { id: "aux", kind: "out", ...mm(51.5, 108, FM12.w, FM12.h), size: "sm", label: "AUX" }
  ]
};
var emenayLfo = {
  source: "emenay fm/lfo.svg",
  hits: [
    { id: "rate", kind: "param", ...mm(20.32, 30, EM8.w, EM8.h), size: "lg", label: "RATE", color: KNOB_BLACK },
    { id: "shape", kind: "param", ...mm(12, 56, EM8.w, EM8.h), size: "md", label: "SHAPE", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(29, 56, EM8.w, EM8.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    { id: "rate_cv", kind: "in", ...mm(12, 80, EM8.w, EM8.h), size: "md", label: "RATE" },
    { id: "reset", kind: "in", ...mm(29, 80, EM8.w, EM8.h), size: "md", label: "RESET" },
    { id: "shape_cv", kind: "in", ...mm(20.32, 96, EM8.w, EM8.h), size: "md", label: "SHAPE" },
    { id: "out", kind: "out", ...mm(10, 110, EM8.w, EM8.h), size: "md", label: "OUT" },
    { id: "inv", kind: "out", ...mm(20.32, 110, EM8.w, EM8.h), size: "md", label: "INV" },
    { id: "uni", kind: "out", ...mm(30.5, 110, EM8.w, EM8.h), size: "md", label: "UNI" }
  ]
};
var emenayDivider = {
  source: "emenay fm/divider.svg",
  hits: [
    { id: "pw", kind: "param", ...mm(10.16, 24, EM4.w, EM4.h), size: "md", label: "PW", color: KNOB_BLACK },
    { id: "clock", kind: "in", ...mm(10.16, 44, EM4.w, EM4.h), size: "md", label: "CLK" },
    { id: "reset", kind: "in", ...mm(10.16, 56, EM4.w, EM4.h), size: "md", label: "RST" },
    { id: "d1", kind: "led", ...mm(4.5, 72, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "d2", kind: "led", ...mm(4.5, 86, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "d4", kind: "led", ...mm(4.5, 100, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "d8", kind: "led", ...mm(4.5, 114, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "d1", kind: "out", ...mm(10.16, 72, EM4.w, EM4.h), size: "md", label: "\xF71" },
    { id: "d2", kind: "out", ...mm(10.16, 86, EM4.w, EM4.h), size: "md", label: "\xF72" },
    { id: "d4", kind: "out", ...mm(10.16, 100, EM4.w, EM4.h), size: "md", label: "\xF74" },
    { id: "d8", kind: "out", ...mm(10.16, 114, EM4.w, EM4.h), size: "md", label: "\xF78" }
  ]
};
var emenaySequencer = {
  source: "emenay fm/sequencer.svg",
  hits: [
    { id: "length", kind: "param", ...mm(14, 22, FM12.w, FM12.h), size: "md", label: "LEN", color: KNOB_BLACK },
    { id: "glide", kind: "param", ...mm(30.48, 22, FM12.w, FM12.h), size: "md", label: "GLIDE", color: KNOB_BLACK },
    { id: "step", kind: "digit", ...mm(47, 22, FM12.w, FM12.h), size: "sm", digits: 1, color: "#e8c547" },
    { id: "led1", kind: "led", ...mm(10, 36, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led2", kind: "led", ...mm(23.5, 36, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led3", kind: "led", ...mm(37, 36, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led4", kind: "led", ...mm(50.5, 36, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "s1", kind: "param", ...mm(10, 44, FM12.w, FM12.h), size: "sm", label: "1", color: KNOB_BLACK },
    { id: "s2", kind: "param", ...mm(23.5, 44, FM12.w, FM12.h), size: "sm", label: "2", color: KNOB_BLACK },
    { id: "s3", kind: "param", ...mm(37, 44, FM12.w, FM12.h), size: "sm", label: "3", color: KNOB_BLACK },
    { id: "s4", kind: "param", ...mm(50.5, 44, FM12.w, FM12.h), size: "sm", label: "4", color: KNOB_BLACK },
    { id: "g1", kind: "toggle", ...mm(10, 56, FM12.w, FM12.h), size: "sm", label: "G1", shape: "circle" },
    { id: "g2", kind: "toggle", ...mm(23.5, 56, FM12.w, FM12.h), size: "sm", label: "G2", shape: "circle" },
    { id: "g3", kind: "toggle", ...mm(37, 56, FM12.w, FM12.h), size: "sm", label: "G3", shape: "circle" },
    { id: "g4", kind: "toggle", ...mm(50.5, 56, FM12.w, FM12.h), size: "sm", label: "G4", shape: "circle" },
    { id: "led5", kind: "led", ...mm(10, 66, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led6", kind: "led", ...mm(23.5, 66, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led7", kind: "led", ...mm(37, 66, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led8", kind: "led", ...mm(50.5, 66, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "s5", kind: "param", ...mm(10, 74, FM12.w, FM12.h), size: "sm", label: "5", color: KNOB_BLACK },
    { id: "s6", kind: "param", ...mm(23.5, 74, FM12.w, FM12.h), size: "sm", label: "6", color: KNOB_BLACK },
    { id: "s7", kind: "param", ...mm(37, 74, FM12.w, FM12.h), size: "sm", label: "7", color: KNOB_BLACK },
    { id: "s8", kind: "param", ...mm(50.5, 74, FM12.w, FM12.h), size: "sm", label: "8", color: KNOB_BLACK },
    { id: "g5", kind: "toggle", ...mm(10, 86, FM12.w, FM12.h), size: "sm", label: "G5", shape: "circle" },
    { id: "g6", kind: "toggle", ...mm(23.5, 86, FM12.w, FM12.h), size: "sm", label: "G6", shape: "circle" },
    { id: "g7", kind: "toggle", ...mm(37, 86, FM12.w, FM12.h), size: "sm", label: "G7", shape: "circle" },
    { id: "g8", kind: "toggle", ...mm(50.5, 86, FM12.w, FM12.h), size: "sm", label: "G8", shape: "circle" },
    { id: "clock", kind: "in", ...mm(18, 100, FM12.w, FM12.h), size: "md", label: "CLK" },
    { id: "reset", kind: "in", ...mm(42, 100, FM12.w, FM12.h), size: "md", label: "RST" },
    { id: "cv", kind: "out", ...mm(12, 114, FM12.w, FM12.h), size: "md", label: "CV" },
    { id: "gate", kind: "out", ...mm(30.48, 114, FM12.w, FM12.h), size: "md", label: "GATE" },
    { id: "eoc", kind: "out", ...mm(49, 114, FM12.w, FM12.h), size: "md", label: "EOC" }
  ]
};
var emenaySequencer16 = {
  source: "emenay fm/sequencer16.svg",
  hits: [
    { id: "length", kind: "param", ...mm(18, 20, FM16.w, FM16.h), size: "md", label: "LEN", color: KNOB_BLACK },
    { id: "glide", kind: "param", ...mm(36, 20, FM16.w, FM16.h), size: "md", label: "GLIDE", color: KNOB_BLACK },
    { id: "step", kind: "digit", ...mm(62, 20, FM16.w, FM16.h), size: "md", digits: 2, color: "#e8c547" },
    // leds 1–8
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `led${i + 1}`,
      kind: "led",
      ...mm(x, 34, FM16.w, FM16.h),
      size: "sm",
      color: "#e8c547"
    })),
    // pots 1–8
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `s${i + 1}`,
      kind: "param",
      ...mm(x, 42, FM16.w, FM16.h),
      size: "sm",
      label: `${i + 1}`,
      color: KNOB_BLACK
    })),
    // gates 1–8 — 12mm under pots so pitch silk fits
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `g${i + 1}`,
      kind: "toggle",
      ...mm(x, 54, FM16.w, FM16.h),
      size: "sm",
      label: `G${i + 1}`,
      shape: "circle"
    })),
    // leds 9–16
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `led${i + 9}`,
      kind: "led",
      ...mm(x, 64, FM16.w, FM16.h),
      size: "sm",
      color: "#e8c547"
    })),
    // pots 9–16
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `s${i + 9}`,
      kind: "param",
      ...mm(x, 72, FM16.w, FM16.h),
      size: "sm",
      label: `${i + 9}`,
      color: KNOB_BLACK
    })),
    // gates 9–16
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `g${i + 9}`,
      kind: "toggle",
      ...mm(x, 84, FM16.w, FM16.h),
      size: "sm",
      label: `G${i + 9}`,
      shape: "circle"
    })),
    { id: "clock", kind: "in", ...mm(26, 100, FM16.w, FM16.h), size: "md", label: "CLK" },
    { id: "reset", kind: "in", ...mm(55, 100, FM16.w, FM16.h), size: "md", label: "RST" },
    { id: "cv", kind: "out", ...mm(18, 114, FM16.w, FM16.h), size: "md", label: "CV" },
    { id: "gate", kind: "out", ...mm(40.64, 114, FM16.w, FM16.h), size: "md", label: "GATE" },
    { id: "eoc", kind: "out", ...mm(63, 114, FM16.w, FM16.h), size: "md", label: "EOC" }
  ]
};
function seqStepBank(view, xs, cols, rows, bank0, bankH) {
  const hits = [];
  for (let r = 0; r < rows; r++) {
    const by = bank0 + r * bankH;
    const ledY = by + bankH * 0.06;
    const potY = by + bankH * 0.32;
    const gateY = by + bankH * 0.84;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c + 1;
      const x = xs[c];
      hits.push({
        id: `led${i}`,
        kind: "led",
        ...mm(x, ledY, view.w, view.h),
        size: "sm",
        color: "#e8c547"
      });
      hits.push({
        id: `s${i}`,
        kind: "param",
        ...mm(x, potY, view.w, view.h),
        size: "sm",
        label: `${i}`,
        color: KNOB_BLACK
      });
      hits.push({
        id: `g${i}`,
        kind: "toggle",
        ...mm(x, gateY, view.w, view.h),
        size: "sm",
        label: `G${i}`,
        shape: "circle"
      });
    }
  }
  return hits;
}
var SEQ_LONG_BANK0 = 28;
var SEQ_LONG_BANK_H = 16.5;
var emenaySequencer32 = {
  source: "emenay fm/sequencer32.svg",
  hits: [
    {
      id: "length",
      kind: "param",
      ...mm(23.77, 20, FM26.w, FM26.h),
      size: "md",
      label: "LEN",
      color: KNOB_BLACK
    },
    {
      id: "glide",
      kind: "param",
      ...mm(50.19, 20, FM26.w, FM26.h),
      size: "md",
      label: "GLIDE",
      color: KNOB_BLACK
    },
    {
      id: "step",
      kind: "digit",
      ...mm(95.1, 20, FM26.w, FM26.h),
      size: "md",
      digits: 2,
      color: "#e8c547"
    },
    ...seqStepBank(
      FM26,
      [13.07, 28.2, 43.34, 58.47, 73.61, 88.74, 103.88, 119.01],
      8,
      4,
      SEQ_LONG_BANK0,
      SEQ_LONG_BANK_H
    ),
    { id: "clock", kind: "in", ...mm(36.98, 102, FM26.w, FM26.h), size: "md", label: "CLK" },
    { id: "reset", kind: "in", ...mm(72.64, 102, FM26.w, FM26.h), size: "md", label: "RST" },
    { id: "cv", kind: "out", ...mm(29.06, 115, FM26.w, FM26.h), size: "md", label: "CV" },
    { id: "gate", kind: "out", ...mm(66.04, 115, FM26.w, FM26.h), size: "md", label: "GATE" },
    { id: "eoc", kind: "out", ...mm(103.02, 115, FM26.w, FM26.h), size: "md", label: "EOC" }
  ]
};
var emenaySequencer64 = {
  source: "emenay fm/sequencer64.svg",
  hits: [
    {
      id: "length",
      kind: "param",
      ...mm(29.26, 20, FM32.w, FM32.h),
      size: "md",
      label: "LEN",
      color: KNOB_BLACK
    },
    {
      id: "glide",
      kind: "param",
      ...mm(61.77, 20, FM32.w, FM32.h),
      size: "md",
      label: "GLIDE",
      color: KNOB_BLACK
    },
    {
      id: "step",
      kind: "digit",
      ...mm(117.04, 20, FM32.w, FM32.h),
      size: "md",
      digits: 2,
      color: "#e8c547"
    },
    ...seqStepBank(
      FM32,
      [
        8.83,
        18.49,
        28.15,
        37.81,
        47.47,
        57.13,
        66.79,
        76.45,
        86.11,
        95.77,
        105.43,
        115.09,
        124.75,
        134.41,
        144.07,
        153.73
      ],
      16,
      4,
      SEQ_LONG_BANK0,
      SEQ_LONG_BANK_H
    ),
    { id: "clock", kind: "in", ...mm(45.52, 102, FM32.w, FM32.h), size: "md", label: "CLK" },
    { id: "reset", kind: "in", ...mm(89.41, 102, FM32.w, FM32.h), size: "md", label: "RST" },
    { id: "cv", kind: "out", ...mm(35.76, 115, FM32.w, FM32.h), size: "md", label: "CV" },
    { id: "gate", kind: "out", ...mm(81.28, 115, FM32.w, FM32.h), size: "md", label: "GATE" },
    { id: "eoc", kind: "out", ...mm(126.8, 115, FM32.w, FM32.h), size: "md", label: "EOC" }
  ]
};
var emenaySampleHold = {
  source: "emenay fm/sample_hold.svg",
  hits: [
    { id: "slew", kind: "param", ...mm(10.16, 30, EM4.w, EM4.h), size: "md", label: "SLEW", color: KNOB_BLACK },
    { id: "noise", kind: "param", ...mm(10.16, 54, EM4.w, EM4.h), size: "md", label: "NOISE", color: KNOB_BLACK },
    { id: "in", kind: "in", ...mm(10.16, 80, EM4.w, EM4.h), size: "md", label: "IN" },
    { id: "clock", kind: "in", ...mm(10.16, 96, EM4.w, EM4.h), size: "md", label: "CLK" },
    { id: "out", kind: "out", ...mm(10.16, 112, EM4.w, EM4.h), size: "md", label: "OUT" }
  ]
};
var emenayLots = {
  source: "emenay fm/lots.svg",
  hits: [
    { id: "rate", kind: "param", ...mm(15.5, 28, FM18.w, FM18.h), size: "md", label: "RATE", color: KNOB_BLACK },
    { id: "deja_vu", kind: "param", ...mm(45.72, 28, FM18.w, FM18.h), size: "md", label: "AMOUNT", color: KNOB_BLACK },
    { id: "spread", kind: "param", ...mm(76, 28, FM18.w, FM18.h), size: "md", label: "SPREAD", color: KNOB_BLACK },
    { id: "bias", kind: "param", ...mm(15.5, 44, FM18.w, FM18.h), size: "md", label: "BIAS", color: KNOB_BLACK },
    { id: "deja_vu_length", kind: "param", ...mm(45.72, 44, FM18.w, FM18.h), size: "md", label: "LENGTH", color: KNOB_BLACK },
    { id: "x_bias", kind: "param", ...mm(76, 44, FM18.w, FM18.h), size: "md", label: "BIAS", color: KNOB_BLACK },
    { id: "jitter", kind: "param", ...mm(15.5, 60, FM18.w, FM18.h), size: "sm", label: "JITTER", color: KNOB_BLACK },
    { id: "t_mode", kind: "param", ...mm(35, 60, FM18.w, FM18.h), size: "sm", label: "t MODE", color: KNOB_BLACK },
    { id: "x_mode", kind: "param", ...mm(56.5, 60, FM18.w, FM18.h), size: "sm", label: "X MODE", color: KNOB_BLACK },
    { id: "steps", kind: "param", ...mm(76, 60, FM18.w, FM18.h), size: "sm", label: "STEPS", color: KNOB_BLACK },
    { id: "t_clock", kind: "in", ...mm(9, 76, FM18.w, FM18.h), size: "sm", label: "t CLK" },
    { id: "x_clock", kind: "in", ...mm(22, 76, FM18.w, FM18.h), size: "sm", label: "X CLK" },
    { id: "rate_cv", kind: "in", ...mm(35, 76, FM18.w, FM18.h), size: "sm", label: "RATE" },
    { id: "bias_cv", kind: "in", ...mm(48, 76, FM18.w, FM18.h), size: "sm", label: "BIAS" },
    { id: "jitter_cv", kind: "in", ...mm(61, 76, FM18.w, FM18.h), size: "sm", label: "JIT" },
    { id: "spread_cv", kind: "in", ...mm(74, 76, FM18.w, FM18.h), size: "sm", label: "SPR" },
    { id: "x_bias_cv", kind: "in", ...mm(84.5, 76, FM18.w, FM18.h), size: "sm", label: "XB" },
    { id: "steps_cv", kind: "in", ...mm(15.5, 89, FM18.w, FM18.h), size: "sm", label: "STEPS" },
    { id: "t1", kind: "led", ...mm(18, 98, FM18.w, FM18.h), size: "sm", color: "#e8c547" },
    { id: "t2", kind: "led", ...mm(35, 98, FM18.w, FM18.h), size: "sm", color: "#e8c547" },
    { id: "t3", kind: "led", ...mm(52, 98, FM18.w, FM18.h), size: "sm", color: "#e8c547" },
    { id: "t1", kind: "out", ...mm(18, 103, FM18.w, FM18.h), size: "sm", label: "t1" },
    { id: "t2", kind: "out", ...mm(35, 103, FM18.w, FM18.h), size: "sm", label: "t2" },
    { id: "t3", kind: "out", ...mm(52, 103, FM18.w, FM18.h), size: "sm", label: "t3" },
    { id: "x1", kind: "out", ...mm(15.5, 116, FM18.w, FM18.h), size: "sm", label: "X1" },
    { id: "x2", kind: "out", ...mm(32, 116, FM18.w, FM18.h), size: "sm", label: "X2" },
    { id: "x3", kind: "out", ...mm(48.5, 116, FM18.w, FM18.h), size: "sm", label: "X3" },
    { id: "y", kind: "out", ...mm(68, 116, FM18.w, FM18.h), size: "sm", label: "Y" }
  ]
};
var emenayTwin = {
  source: "emenay fm/twin.svg",
  hits: [
    { id: "mode_a", kind: "param", ...mm(12, 28, EM8.w, EM8.h), size: "sm", label: "MODE A", color: KNOB_BLACK },
    { id: "mode_a", kind: "digit", ...mm(12, 20, EM8.w, EM8.h), size: "sm", digits: 1, color: "#e8c547" },
    { id: "mode_b", kind: "param", ...mm(28.5, 28, EM8.w, EM8.h), size: "sm", label: "MODE B", color: KNOB_BLACK },
    { id: "mode_b", kind: "digit", ...mm(28.5, 20, EM8.w, EM8.h), size: "sm", digits: 1, color: "#e8c547" },
    { id: "p1", kind: "param", ...mm(12, 50, EM8.w, EM8.h), size: "md", label: "P1", color: KNOB_BLACK },
    { id: "p2", kind: "param", ...mm(28.5, 50, EM8.w, EM8.h), size: "md", label: "P2", color: KNOB_BLACK },
    { id: "p3", kind: "param", ...mm(12, 72, EM8.w, EM8.h), size: "md", label: "P3", color: KNOB_BLACK },
    { id: "p4", kind: "param", ...mm(28.5, 72, EM8.w, EM8.h), size: "md", label: "P4", color: KNOB_BLACK },
    { id: "split", kind: "param", ...mm(12, 92, EM8.w, EM8.h), size: "sm", label: "SPLIT", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(28.5, 92, EM8.w, EM8.h), size: "sm", label: "LEVEL", color: KNOB_BLACK },
    { id: "trig_a", kind: "in", ...mm(10, 110, EM8.w, EM8.h), size: "sm", label: "TRIG A" },
    { id: "trig_b", kind: "in", ...mm(30.5, 110, EM8.w, EM8.h), size: "sm", label: "TRIG B" },
    { id: "out_a", kind: "out", ...mm(8, 122, EM8.w, EM8.h), size: "sm", label: "A" },
    { id: "out_b", kind: "out", ...mm(20.32, 122, EM8.w, EM8.h), size: "sm", label: "B" },
    { id: "mix", kind: "out", ...mm(32.5, 122, EM8.w, EM8.h), size: "sm", label: "MIX" },
    { id: "a", kind: "led", ...mm(16, 110, EM8.w, EM8.h), size: "sm" },
    { id: "b", kind: "led", ...mm(24.5, 110, EM8.w, EM8.h), size: "sm" }
  ]
};
var emenaySwell = {
  source: "emenay fm/swell.svg",
  hits: [
    { id: "freq", kind: "param", ...mm(30.48, 28, FM12.w, FM12.h), size: "lg", label: "FREQ", color: KNOB_BLACK },
    { id: "shape", kind: "param", ...mm(12, 48, FM12.w, FM12.h), size: "md", label: "SHAPE", color: KNOB_BLACK },
    { id: "slope", kind: "param", ...mm(30.48, 48, FM12.w, FM12.h), size: "md", label: "SLOPE", color: KNOB_BLACK },
    { id: "smoothness", kind: "param", ...mm(49, 48, FM12.w, FM12.h), size: "md", label: "SMOOTH", color: KNOB_BLACK },
    { id: "mode", kind: "param", ...mm(18, 68, FM12.w, FM12.h), size: "sm", label: "MODE", color: KNOB_BLACK },
    { id: "range", kind: "param", ...mm(43, 68, FM12.w, FM12.h), size: "sm", label: "RANGE", color: KNOB_BLACK },
    { id: "v_oct", kind: "in", ...mm(8, 85, FM12.w, FM12.h), size: "sm", label: "1V/O" },
    { id: "trig", kind: "in", ...mm(18, 85, FM12.w, FM12.h), size: "sm", label: "TRIG" },
    { id: "clock", kind: "in", ...mm(28, 85, FM12.w, FM12.h), size: "sm", label: "CLK" },
    { id: "freeze", kind: "in", ...mm(38, 85, FM12.w, FM12.h), size: "sm", label: "FRZ" },
    { id: "fm", kind: "in", ...mm(50, 85, FM12.w, FM12.h), size: "sm", label: "FM" },
    { id: "shape_cv", kind: "in", ...mm(10, 101, FM12.w, FM12.h), size: "sm", label: "SHP" },
    { id: "slope_cv", kind: "in", ...mm(22, 101, FM12.w, FM12.h), size: "sm", label: "SLP" },
    { id: "smooth_cv", kind: "in", ...mm(34, 101, FM12.w, FM12.h), size: "sm", label: "SMT" },
    { id: "uni", kind: "out", ...mm(12, 116, FM12.w, FM12.h), size: "sm", label: "UNI" },
    { id: "bi", kind: "out", ...mm(26, 116, FM12.w, FM12.h), size: "sm", label: "BI" },
    { id: "eoa", kind: "out", ...mm(40, 116, FM12.w, FM12.h), size: "sm", label: "EOA" },
    { id: "eor", kind: "out", ...mm(52, 116, FM12.w, FM12.h), size: "sm", label: "EOR" }
  ]
};
var emenayChimes = {
  source: "emenay fm/chimes.svg",
  hits: [
    { id: "freq", kind: "param", ...mm(30.48, 28, FM12.w, FM12.h), size: "lg", label: "FREQ", color: KNOB_BLACK },
    { id: "structure", kind: "param", ...mm(12, 50, FM12.w, FM12.h), size: "md", label: "STRUCT", color: KNOB_BLACK },
    { id: "brightness", kind: "param", ...mm(30.48, 50, FM12.w, FM12.h), size: "md", label: "BRIGHT", color: KNOB_BLACK },
    { id: "damping", kind: "param", ...mm(49, 50, FM12.w, FM12.h), size: "md", label: "DAMP", color: KNOB_BLACK },
    { id: "model", kind: "param", ...mm(12, 68, FM12.w, FM12.h), size: "sm", label: "MODEL", color: KNOB_BLACK },
    { id: "position", kind: "param", ...mm(30.48, 68, FM12.w, FM12.h), size: "md", label: "POS", color: KNOB_BLACK },
    { id: "polyphony", kind: "param", ...mm(49, 68, FM12.w, FM12.h), size: "sm", label: "POLY", color: KNOB_BLACK },
    { id: "v_oct", kind: "in", ...mm(10, 85, FM12.w, FM12.h), size: "sm", label: "1V/O" },
    { id: "trig", kind: "in", ...mm(22, 85, FM12.w, FM12.h), size: "sm", label: "TRIG" },
    { id: "in", kind: "in", ...mm(34, 85, FM12.w, FM12.h), size: "sm", label: "IN" },
    { id: "freq_cv", kind: "in", ...mm(48, 85, FM12.w, FM12.h), size: "sm", label: "FREQ" },
    { id: "structure_cv", kind: "in", ...mm(8, 103, FM12.w, FM12.h), size: "sm", label: "STR" },
    { id: "brightness_cv", kind: "in", ...mm(18, 103, FM12.w, FM12.h), size: "sm", label: "BRT" },
    { id: "damping_cv", kind: "in", ...mm(28, 103, FM12.w, FM12.h), size: "sm", label: "DMP" },
    { id: "position_cv", kind: "in", ...mm(38, 103, FM12.w, FM12.h), size: "sm", label: "POS" },
    { id: "out", kind: "out", ...mm(48, 103, FM12.w, FM12.h), size: "sm", label: "OUT" },
    { id: "aux", kind: "out", ...mm(56.5, 103, FM12.w, FM12.h), size: "sm", label: "AUX" }
  ]
};
var emenayTwist = {
  source: "emenay fm/twist.svg",
  hits: [
    { id: "algorithm", kind: "param", ...mm(25.4, 29, FM10.w, FM10.h), size: "lg", label: "ALGO", color: KNOB_BLACK },
    { id: "timbre", kind: "param", ...mm(12, 52, FM10.w, FM10.h), size: "md", label: "TIMBRE", color: KNOB_BLACK },
    { id: "level1", kind: "param", ...mm(38.5, 52, FM10.w, FM10.h), size: "md", label: "LVL1", color: KNOB_BLACK },
    { id: "level2", kind: "param", ...mm(12, 70, FM10.w, FM10.h), size: "md", label: "LVL2", color: KNOB_BLACK },
    { id: "freq", kind: "param", ...mm(38.5, 70, FM10.w, FM10.h), size: "md", label: "FREQ", color: KNOB_BLACK },
    { id: "carrier_shape", kind: "param", ...mm(25.4, 84, FM10.w, FM10.h), size: "sm", label: "SHAPE", color: KNOB_BLACK },
    { id: "carrier", kind: "in", ...mm(12, 95, FM10.w, FM10.h), size: "md", label: "CAR" },
    { id: "modulator", kind: "in", ...mm(38.5, 95, FM10.w, FM10.h), size: "md", label: "MOD" },
    { id: "algo_cv", kind: "in", ...mm(7, 111, FM10.w, FM10.h), size: "sm", label: "ALG" },
    { id: "timbre_cv", kind: "in", ...mm(15.5, 111, FM10.w, FM10.h), size: "sm", label: "TMB" },
    { id: "level1_cv", kind: "in", ...mm(24, 111, FM10.w, FM10.h), size: "sm", label: "L1" },
    { id: "level2_cv", kind: "in", ...mm(32.5, 111, FM10.w, FM10.h), size: "sm", label: "L2" },
    { id: "out", kind: "out", ...mm(40.5, 111, FM10.w, FM10.h), size: "sm", label: "OUT" },
    { id: "aux", kind: "out", ...mm(47.5, 111, FM10.w, FM10.h), size: "sm", label: "AUX" }
  ]
};
var emenaySwitch = {
  source: "emenay fm/switch.svg",
  hits: [
    // STEPS = cycle length (2–4). Advance is automatic via TRIG.
    { id: "steps", kind: "param", ...mm(15.24, 25, FM6.w, FM6.h), size: "md", label: "STEPS", color: KNOB_BLACK },
    { id: "step", kind: "digit", ...mm(15.24, 36, FM6.w, FM6.h), size: "sm", digits: 1, color: "#e8c547" },
    { id: "trig", kind: "in", ...mm(8, 44, FM6.w, FM6.h), size: "sm", label: "TRIG" },
    { id: "reset", kind: "in", ...mm(22.5, 44, FM6.w, FM6.h), size: "sm", label: "RST" },
    { id: "com", kind: "in", ...mm(8, 58, FM6.w, FM6.h), size: "sm", label: "COM IN" },
    { id: "com_out", kind: "out", ...mm(22.5, 58, FM6.w, FM6.h), size: "sm", label: "COM OUT" },
    { id: "led1", kind: "led", ...mm(4.5, 77, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "led2", kind: "led", ...mm(26.5, 77, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "led3", kind: "led", ...mm(4.5, 89, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "led4", kind: "led", ...mm(26.5, 89, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "o1", kind: "out", ...mm(8, 77, FM6.w, FM6.h), size: "sm", label: "O1" },
    { id: "o2", kind: "out", ...mm(22.5, 77, FM6.w, FM6.h), size: "sm", label: "O2" },
    { id: "o3", kind: "out", ...mm(8, 89, FM6.w, FM6.h), size: "sm", label: "O3" },
    { id: "o4", kind: "out", ...mm(22.5, 89, FM6.w, FM6.h), size: "sm", label: "O4" },
    { id: "i1", kind: "in", ...mm(5.5, 108, FM6.w, FM6.h), size: "sm", label: "I1" },
    { id: "i2", kind: "in", ...mm(12.2, 108, FM6.w, FM6.h), size: "sm", label: "I2" },
    { id: "i3", kind: "in", ...mm(18.9, 108, FM6.w, FM6.h), size: "sm", label: "I3" },
    { id: "i4", kind: "in", ...mm(25.5, 108, FM6.w, FM6.h), size: "sm", label: "I4" }
  ]
};
var emenayWasp = {
  source: "emenay fm/wasp.svg",
  hits: [
    { id: "cutoff", kind: "param", ...mm(20.32, 28, EM8.w, EM8.h), size: "lg", label: "CUTOFF", color: KNOB_BLACK },
    { id: "res", kind: "param", ...mm(12, 54, EM8.w, EM8.h), size: "md", label: "RES", color: KNOB_BLACK },
    { id: "drive", kind: "param", ...mm(28.5, 54, EM8.w, EM8.h), size: "md", label: "DRIVE", color: KNOB_BLACK },
    { id: "level", kind: "led", ...mm(20.32, 68, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "in", kind: "in", ...mm(12, 82, EM8.w, EM8.h), size: "md", label: "IN" },
    { id: "cv", kind: "in", ...mm(28.5, 82, EM8.w, EM8.h), size: "md", label: "CV" },
    { id: "lp", kind: "out", ...mm(10, 104, EM8.w, EM8.h), size: "md", label: "LP" },
    { id: "bp", kind: "out", ...mm(20.32, 104, EM8.w, EM8.h), size: "md", label: "BP" },
    { id: "hp", kind: "out", ...mm(30.5, 104, EM8.w, EM8.h), size: "md", label: "HP" }
  ]
};
var emenayMidiCc = {
  source: "emenay fm/midi_cc.svg",
  hits: [
    { id: "cc_num_1", kind: "param", ...mm(10, 24, EM8.w, EM8.h), size: "sm", label: "#1", color: KNOB_BLACK },
    { id: "cc1", kind: "out", ...mm(30, 24, EM8.w, EM8.h), size: "sm", label: "CC1" },
    { id: "cc1", kind: "led", ...mm(35.5, 24, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "cc_num_2", kind: "param", ...mm(10, 36.5, EM8.w, EM8.h), size: "sm", label: "#2", color: KNOB_BLACK },
    { id: "cc2", kind: "out", ...mm(30, 36.5, EM8.w, EM8.h), size: "sm", label: "CC2" },
    { id: "cc2", kind: "led", ...mm(35.5, 36.5, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "cc_num_3", kind: "param", ...mm(10, 49, EM8.w, EM8.h), size: "sm", label: "#3", color: KNOB_BLACK },
    { id: "cc3", kind: "out", ...mm(30, 49, EM8.w, EM8.h), size: "sm", label: "CC3" },
    { id: "cc3", kind: "led", ...mm(35.5, 49, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "cc_num_4", kind: "param", ...mm(10, 61.5, EM8.w, EM8.h), size: "sm", label: "#4", color: KNOB_BLACK },
    { id: "cc4", kind: "out", ...mm(30, 61.5, EM8.w, EM8.h), size: "sm", label: "CC4" },
    { id: "cc4", kind: "led", ...mm(35.5, 61.5, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "cc_num_5", kind: "param", ...mm(10, 74, EM8.w, EM8.h), size: "sm", label: "#5", color: KNOB_BLACK },
    { id: "cc5", kind: "out", ...mm(30, 74, EM8.w, EM8.h), size: "sm", label: "CC5" },
    { id: "cc5", kind: "led", ...mm(35.5, 74, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "cc_num_6", kind: "param", ...mm(10, 86.5, EM8.w, EM8.h), size: "sm", label: "#6", color: KNOB_BLACK },
    { id: "cc6", kind: "out", ...mm(30, 86.5, EM8.w, EM8.h), size: "sm", label: "CC6" },
    { id: "cc6", kind: "led", ...mm(35.5, 86.5, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "cc_num_7", kind: "param", ...mm(10, 99, EM8.w, EM8.h), size: "sm", label: "#7", color: KNOB_BLACK },
    { id: "cc7", kind: "out", ...mm(30, 99, EM8.w, EM8.h), size: "sm", label: "CC7" },
    { id: "cc7", kind: "led", ...mm(35.5, 99, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "cc_num_8", kind: "param", ...mm(10, 111.5, EM8.w, EM8.h), size: "sm", label: "#8", color: KNOB_BLACK },
    { id: "cc8", kind: "out", ...mm(30, 111.5, EM8.w, EM8.h), size: "sm", label: "CC8" },
    { id: "cc8", kind: "led", ...mm(35.5, 111.5, EM8.w, EM8.h), size: "sm", color: "#e8c547" }
  ]
};
var emenayMidiPads = {
  source: "emenay fm/midi_pads.svg",
  hits: [
    { id: "note_1", kind: "param", ...mm(12, 32, EM8.w, EM8.h), size: "md", label: "N1", color: KNOB_BLACK },
    { id: "bd", kind: "out", ...mm(29, 32, EM8.w, EM8.h), size: "md", label: "BD" },
    { id: "bd", kind: "led", ...mm(35.2, 32, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "note_2", kind: "param", ...mm(12, 56, EM8.w, EM8.h), size: "md", label: "N2", color: KNOB_BLACK },
    { id: "sd", kind: "out", ...mm(29, 56, EM8.w, EM8.h), size: "md", label: "SD" },
    { id: "sd", kind: "led", ...mm(35.2, 56, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "note_3", kind: "param", ...mm(12, 80, EM8.w, EM8.h), size: "md", label: "N3", color: KNOB_BLACK },
    { id: "ch", kind: "out", ...mm(29, 80, EM8.w, EM8.h), size: "md", label: "CH" },
    { id: "ch", kind: "led", ...mm(35.2, 80, EM8.w, EM8.h), size: "sm", color: "#e8c547" },
    { id: "note_4", kind: "param", ...mm(12, 104, EM8.w, EM8.h), size: "md", label: "N4", color: KNOB_BLACK },
    { id: "oh", kind: "out", ...mm(29, 104, EM8.w, EM8.h), size: "md", label: "OH" },
    { id: "oh", kind: "led", ...mm(35.2, 104, EM8.w, EM8.h), size: "sm", color: "#e8c547" }
  ]
};
var emenayPolysynth = {
  source: "emenay fm/polysynth.svg",
  hits: [
    { id: "v1", kind: "led", ...mm(18, 20, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "v2", kind: "led", ...mm(26, 20, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "v3", kind: "led", ...mm(34, 20, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "v4", kind: "led", ...mm(42, 20, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "tune", kind: "param", ...mm(18, 36, FM12.w, FM12.h), size: "md", label: "TUNE", color: KNOB_BLACK },
    { id: "shape", kind: "param", ...mm(42, 36, FM12.w, FM12.h), size: "md", label: "SHAPE", color: KNOB_BLACK },
    { id: "cutoff", kind: "param", ...mm(18, 58, FM12.w, FM12.h), size: "md", label: "CUTOFF", color: KNOB_BLACK },
    { id: "detune", kind: "param", ...mm(42, 58, FM12.w, FM12.h), size: "md", label: "DETUNE", color: KNOB_BLACK },
    { id: "attack", kind: "param", ...mm(14, 80, FM12.w, FM12.h), size: "md", label: "A", color: ENV_A },
    { id: "release", kind: "param", ...mm(30.48, 80, FM12.w, FM12.h), size: "md", label: "R", color: ENV_R },
    { id: "level", kind: "param", ...mm(47, 80, FM12.w, FM12.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    { id: "cutoff_cv", kind: "in", ...mm(14, 100, FM12.w, FM12.h), size: "md", label: "CUT CV" },
    { id: "shape_cv", kind: "in", ...mm(30.48, 100, FM12.w, FM12.h), size: "md", label: "SHAPE" },
    { id: "level", kind: "led", ...mm(47, 100, FM12.w, FM12.h), size: "sm", color: "#6adf8a" },
    { id: "out", kind: "out", ...mm(20, 116, FM12.w, FM12.h), size: "md", label: "OUT L" },
    { id: "out_r", kind: "out", ...mm(40, 116, FM12.w, FM12.h), size: "md", label: "OUT R" }
  ]
};
var emenayAr = {
  source: "emenay fm/ar.svg",
  hits: [
    { id: "attack", kind: "param", ...mm(10.16, 28, EM4.w, EM4.h), size: "md", label: "A", color: ENV_A },
    { id: "release", kind: "param", ...mm(10.16, 52, EM4.w, EM4.h), size: "md", label: "R", color: ENV_R },
    { id: "level", kind: "led", ...mm(10.16, 66, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "gate", kind: "in", ...mm(10.16, 76, EM4.w, EM4.h), size: "md", label: "GATE" },
    { id: "trig", kind: "in", ...mm(10.16, 90, EM4.w, EM4.h), size: "md", label: "TRIG" },
    { id: "env", kind: "out", ...mm(10.16, 104, EM4.w, EM4.h), size: "md", label: "ENV" },
    { id: "eoc", kind: "out", ...mm(10.16, 116, EM4.w, EM4.h), size: "md", label: "EOC" }
  ]
};
var emenayAdsr = {
  source: "emenay fm/adsr.svg",
  hits: [
    { id: "attack", kind: "param", ...mm(15.24, 24, FM6.w, FM6.h), size: "md", label: "A", color: ENV_A },
    { id: "decay", kind: "param", ...mm(15.24, 44, FM6.w, FM6.h), size: "md", label: "D", color: ENV_D },
    { id: "sustain", kind: "param", ...mm(15.24, 64, FM6.w, FM6.h), size: "md", label: "S", color: ENV_S },
    { id: "release", kind: "param", ...mm(15.24, 84, FM6.w, FM6.h), size: "md", label: "R", color: ENV_R },
    { id: "level", kind: "led", ...mm(15.24, 96, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "gate", kind: "in", ...mm(8, 104, FM6.w, FM6.h), size: "md", label: "GATE" },
    { id: "trig", kind: "in", ...mm(22.5, 104, FM6.w, FM6.h), size: "md", label: "TRIG" },
    { id: "env", kind: "out", ...mm(8, 116, FM6.w, FM6.h), size: "md", label: "ENV" },
    { id: "eoc", kind: "out", ...mm(22.5, 116, FM6.w, FM6.h), size: "md", label: "EOC" }
  ]
};
var emenayDrums = {
  source: "emenay fm/drums.svg",
  hits: [
    { id: "tone", kind: "param", ...mm(15, 26, FM12.w, FM12.h), size: "md", label: "TONE", color: KNOB_BLACK },
    { id: "snappy", kind: "param", ...mm(30.48, 26, FM12.w, FM12.h), size: "md", label: "SNAP", color: KNOB_BLACK },
    { id: "decay", kind: "param", ...mm(46, 26, FM12.w, FM12.h), size: "md", label: "DECAY", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(30.48, 48, FM12.w, FM12.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    { id: "bd", kind: "led", ...mm(10, 66, FM12.w, FM12.h), size: "sm", color: "#e85d04" },
    { id: "sd", kind: "led", ...mm(20.5, 66, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "ch", kind: "led", ...mm(31, 66, FM12.w, FM12.h), size: "sm", color: "#6adf8a" },
    { id: "oh", kind: "led", ...mm(41.5, 66, FM12.w, FM12.h), size: "sm", color: "#6adf8a" },
    { id: "cp", kind: "led", ...mm(52, 66, FM12.w, FM12.h), size: "sm", color: "#9b5de5" },
    { id: "tom", kind: "led", ...mm(30.48, 82, FM12.w, FM12.h), size: "sm", color: "#00b4d8" },
    { id: "bd", kind: "in", ...mm(10, 74, FM12.w, FM12.h), size: "md", label: "BD" },
    { id: "sd", kind: "in", ...mm(20.5, 74, FM12.w, FM12.h), size: "md", label: "SD" },
    { id: "ch", kind: "in", ...mm(31, 74, FM12.w, FM12.h), size: "md", label: "CH" },
    { id: "oh", kind: "in", ...mm(41.5, 74, FM12.w, FM12.h), size: "md", label: "OH" },
    { id: "cp", kind: "in", ...mm(52, 74, FM12.w, FM12.h), size: "md", label: "CP" },
    { id: "tom", kind: "in", ...mm(30.48, 90, FM12.w, FM12.h), size: "md", label: "TOM" },
    { id: "mix", kind: "out", ...mm(12, 110, FM12.w, FM12.h), size: "md", label: "MIX" },
    { id: "bd", kind: "out", ...mm(24, 110, FM12.w, FM12.h), size: "md", label: "BD" },
    { id: "sd", kind: "out", ...mm(36, 110, FM12.w, FM12.h), size: "md", label: "SD" },
    { id: "hh", kind: "out", ...mm(48, 110, FM12.w, FM12.h), size: "md", label: "HH" }
  ]
};
var emenayBeat = {
  source: "emenay fm/beat.svg",
  hits: [
    { id: "pattern", kind: "param", ...mm(18, 30, FM12.w, FM12.h), size: "md", label: "PATTERN", color: KNOB_BLACK },
    { id: "pattern", kind: "digit", ...mm(18, 20, FM12.w, FM12.h), size: "sm", digits: 2, color: "#e8c547" },
    { id: "swing", kind: "param", ...mm(43, 30, FM12.w, FM12.h), size: "md", label: "SWING", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(30.48, 54, FM12.w, FM12.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    { id: "run", kind: "led", ...mm(30.48, 68, FM12.w, FM12.h), size: "sm", color: "#6adf8a" },
    { id: "clock", kind: "in", ...mm(18, 78, FM12.w, FM12.h), size: "md", label: "CLK" },
    { id: "reset", kind: "in", ...mm(43, 78, FM12.w, FM12.h), size: "md", label: "RST" },
    { id: "bd_g", kind: "out", ...mm(12, 98, FM12.w, FM12.h), size: "sm", label: "BD" },
    { id: "sd_g", kind: "out", ...mm(24, 98, FM12.w, FM12.h), size: "sm", label: "SD" },
    { id: "ch_g", kind: "out", ...mm(36, 98, FM12.w, FM12.h), size: "sm", label: "CH" },
    { id: "oh_g", kind: "out", ...mm(48, 98, FM12.w, FM12.h), size: "sm", label: "OH" },
    { id: "out_l", kind: "out", ...mm(14, 114, FM12.w, FM12.h), size: "md", label: "L" },
    { id: "out_r", kind: "out", ...mm(30.48, 114, FM12.w, FM12.h), size: "md", label: "R" },
    { id: "mix", kind: "out", ...mm(47, 114, FM12.w, FM12.h), size: "sm", label: "MIX" }
  ]
};
var emenayBitboy = {
  source: "emenay fm/bitboy.svg",
  hits: [
    { id: "tune", kind: "param", ...mm(20.32, 26, EM8.w, EM8.h), size: "lg", label: "TUNE", color: KNOB_BLACK },
    { id: "mode", kind: "param", ...mm(12, 50, EM8.w, EM8.h), size: "md", label: "MODE", color: KNOB_BLACK },
    { id: "frame", kind: "param", ...mm(28.5, 50, EM8.w, EM8.h), size: "md", label: "FRAME", color: KNOB_BLACK },
    { id: "mode", kind: "digit", ...mm(20.32, 40, EM8.w, EM8.h), size: "sm", digits: 1, color: "#e8c547" },
    { id: "morph", kind: "param", ...mm(12, 72, EM8.w, EM8.h), size: "md", label: "MORPH", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(28.5, 72, EM8.w, EM8.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    { id: "level", kind: "led", ...mm(20.32, 84, EM8.w, EM8.h), size: "sm", color: "#9cbc68" },
    { id: "v_oct", kind: "in", ...mm(8, 90, EM8.w, EM8.h), size: "md", label: "1V/O" },
    { id: "mode_cv", kind: "in", ...mm(20.32, 90, EM8.w, EM8.h), size: "md", label: "MODE" },
    { id: "frame_cv", kind: "in", ...mm(32.5, 90, EM8.w, EM8.h), size: "md", label: "FRAME" },
    { id: "gate", kind: "in", ...mm(12, 104, EM8.w, EM8.h), size: "md", label: "GATE" },
    { id: "level_cv", kind: "in", ...mm(28.5, 104, EM8.w, EM8.h), size: "md", label: "LVL" },
    { id: "out", kind: "out", ...mm(12, 118, EM8.w, EM8.h), size: "md", label: "OUT" },
    { id: "step", kind: "out", ...mm(28.5, 118, EM8.w, EM8.h), size: "md", label: "STEP" }
  ]
};
var emenayMult = {
  source: "emenay fm/mult.svg",
  hits: [
    { id: "in", kind: "in", ...mm(5.08, 28, EM2.w, EM2.h), size: "sm" },
    { id: "out1", kind: "out", ...mm(5.08, 52, EM2.w, EM2.h), size: "sm" },
    { id: "out2", kind: "out", ...mm(5.08, 70, EM2.w, EM2.h), size: "sm" },
    { id: "out3", kind: "out", ...mm(5.08, 88, EM2.w, EM2.h), size: "sm" },
    { id: "out4", kind: "out", ...mm(5.08, 106, EM2.w, EM2.h), size: "sm" }
  ]
};
var emenayClkMult = {
  source: "emenay fm/clk_mult.svg",
  hits: [
    { id: "pw", kind: "param", ...mm(10.16, 26, EM4.w, EM4.h), size: "md", label: "PW", color: KNOB_BLACK },
    { id: "clock", kind: "in", ...mm(10.16, 50, EM4.w, EM4.h), size: "md", label: "CLK" },
    { id: "x1", kind: "led", ...mm(4.5, 70, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "x2", kind: "led", ...mm(4.5, 84, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "x4", kind: "led", ...mm(4.5, 98, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "x8", kind: "led", ...mm(4.5, 112, EM4.w, EM4.h), size: "sm", color: "#e8c547" },
    { id: "x1", kind: "out", ...mm(10.16, 70, EM4.w, EM4.h), size: "md", label: "\xD71" },
    { id: "x2", kind: "out", ...mm(10.16, 84, EM4.w, EM4.h), size: "md", label: "\xD72" },
    { id: "x4", kind: "out", ...mm(10.16, 98, EM4.w, EM4.h), size: "md", label: "\xD74" },
    { id: "x8", kind: "out", ...mm(10.16, 112, EM4.w, EM4.h), size: "md", label: "\xD78" }
  ]
};
var emenayCvSwitch = {
  source: "emenay fm/cv_switch.svg",
  hits: [
    { id: "select", kind: "param", ...mm(15.24, 22, FM6.w, FM6.h), size: "md", label: "SEL", color: KNOB_BLACK },
    { id: "steps", kind: "param", ...mm(8.5, 42, FM6.w, FM6.h), size: "sm", label: "STEPS", color: KNOB_BLACK },
    { id: "step", kind: "digit", ...mm(22.5, 42, FM6.w, FM6.h), size: "sm", digits: 1, color: "#e8c547" },
    { id: "cv", kind: "in", ...mm(8, 58, FM6.w, FM6.h), size: "sm", label: "CV" },
    { id: "com", kind: "in", ...mm(22.5, 58, FM6.w, FM6.h), size: "sm", label: "COM" },
    { id: "led1", kind: "led", ...mm(7, 70, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "led2", kind: "led", ...mm(13, 70, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "led3", kind: "led", ...mm(19.5, 70, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "led4", kind: "led", ...mm(25.5, 70, FM6.w, FM6.h), size: "sm", color: "#e8c547" },
    { id: "i1", kind: "in", ...mm(7, 78, FM6.w, FM6.h), size: "sm", label: "I1" },
    { id: "i2", kind: "in", ...mm(13, 78, FM6.w, FM6.h), size: "sm", label: "I2" },
    { id: "i3", kind: "in", ...mm(19.5, 78, FM6.w, FM6.h), size: "sm", label: "I3" },
    { id: "i4", kind: "in", ...mm(25.5, 78, FM6.w, FM6.h), size: "sm", label: "I4" },
    { id: "o1", kind: "out", ...mm(7, 96, FM6.w, FM6.h), size: "sm", label: "O1" },
    { id: "o2", kind: "out", ...mm(13, 96, FM6.w, FM6.h), size: "sm", label: "O2" },
    { id: "o3", kind: "out", ...mm(19.5, 96, FM6.w, FM6.h), size: "sm", label: "O3" },
    { id: "o4", kind: "out", ...mm(25.5, 96, FM6.w, FM6.h), size: "sm", label: "O4" },
    { id: "com_out", kind: "out", ...mm(15.24, 114, FM6.w, FM6.h), size: "sm", label: "COM OUT" }
  ]
};
var emenayStereo = {
  source: "emenay fm/stereo.svg",
  hits: [
    { id: "pan", kind: "param", ...mm(15.24, 28, FM6.w, FM6.h), size: "md", label: "PAN", color: KNOB_BLACK },
    { id: "width", kind: "param", ...mm(8, 52, FM6.w, FM6.h), size: "md", label: "WIDTH", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(22.5, 52, FM6.w, FM6.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    { id: "in_l", kind: "in", ...mm(8, 78, FM6.w, FM6.h), size: "md", label: "IN L" },
    { id: "in_r", kind: "in", ...mm(22.5, 78, FM6.w, FM6.h), size: "md", label: "IN R" },
    { id: "pan_cv", kind: "in", ...mm(15.24, 94, FM6.w, FM6.h), size: "md", label: "PAN CV" },
    { id: "out_l", kind: "out", ...mm(8, 112, FM6.w, FM6.h), size: "md", label: "OUT L" },
    { id: "out_r", kind: "out", ...mm(22.5, 112, FM6.w, FM6.h), size: "md", label: "OUT R" }
  ]
};
var emenayDelay = {
  source: "emenay fm/delay.svg",
  hits: [
    { id: "time", kind: "param", ...mm(20.32, 28, EM8.w, EM8.h), size: "lg", label: "TIME", color: KNOB_BLACK },
    { id: "feedback", kind: "param", ...mm(10, 52, EM8.w, EM8.h), size: "md", label: "FB", color: KNOB_BLACK },
    { id: "mix", kind: "param", ...mm(30.5, 52, EM8.w, EM8.h), size: "md", label: "MIX", color: KNOB_BLACK },
    { id: "pingpong", kind: "toggle", ...mm(18, 71, EM8.w, EM8.h), size: "md", label: "PP" },
    { id: "in", kind: "in", ...mm(8, 86, EM8.w, EM8.h), size: "md", label: "IN" },
    { id: "time_cv", kind: "in", ...mm(20.32, 86, EM8.w, EM8.h), size: "md", label: "TIME" },
    { id: "fb_cv", kind: "in", ...mm(32.5, 86, EM8.w, EM8.h), size: "md", label: "FB" },
    { id: "out_l", kind: "out", ...mm(10, 108, EM8.w, EM8.h), size: "md", label: "OUT L" },
    { id: "out_r", kind: "out", ...mm(20.32, 108, EM8.w, EM8.h), size: "md", label: "OUT R" },
    { id: "mix", kind: "out", ...mm(30.5, 108, EM8.w, EM8.h), size: "md", label: "MIX" }
  ]
};
var emenayReverb = {
  source: "emenay fm/reverb.svg",
  hits: [
    { id: "size", kind: "param", ...mm(10, 28, EM8.w, EM8.h), size: "md", label: "SIZE", color: KNOB_BLACK },
    { id: "decay", kind: "param", ...mm(30.5, 28, EM8.w, EM8.h), size: "md", label: "DECAY", color: KNOB_BLACK },
    { id: "damp", kind: "param", ...mm(10, 54, EM8.w, EM8.h), size: "md", label: "DAMP", color: KNOB_BLACK },
    { id: "mix", kind: "param", ...mm(30.5, 54, EM8.w, EM8.h), size: "md", label: "MIX", color: KNOB_BLACK },
    { id: "in_l", kind: "in", ...mm(10, 82, EM8.w, EM8.h), size: "md", label: "IN L" },
    { id: "in_r", kind: "in", ...mm(20.32, 82, EM8.w, EM8.h), size: "md", label: "IN R" },
    { id: "size_cv", kind: "in", ...mm(30.5, 82, EM8.w, EM8.h), size: "md", label: "SIZE" },
    { id: "out_l", kind: "out", ...mm(14, 108, EM8.w, EM8.h), size: "md", label: "OUT L" },
    { id: "out_r", kind: "out", ...mm(27, 108, EM8.w, EM8.h), size: "md", label: "OUT R" }
  ]
};
var emenaySampler = {
  source: "emenay fm/sampler.svg",
  hits: [
    { id: "start", kind: "param", ...mm(15, 28, FM12.w, FM12.h), size: "md", label: "START", color: KNOB_BLACK },
    { id: "length", kind: "param", ...mm(30.48, 28, FM12.w, FM12.h), size: "md", label: "LEN", color: KNOB_BLACK },
    { id: "pitch", kind: "param", ...mm(46, 28, FM12.w, FM12.h), size: "md", label: "PITCH", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(22, 54, FM12.w, FM12.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    // Faceplate draws a knob here — use a latching knob, not a pushbutton.
    { id: "loop", kind: "param", ...mm(40, 54, FM12.w, FM12.h), size: "md", label: "LOOP", color: KNOB_BLACK },
    { id: "rec", kind: "led", ...mm(36, 70, FM12.w, FM12.h), size: "sm", color: "#e85d04" },
    { id: "play", kind: "led", ...mm(24, 70, FM12.w, FM12.h), size: "sm", color: "#6adf8a" },
    { id: "sample", kind: "led", ...mm(48, 70, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "in", kind: "in", ...mm(12, 78, FM12.w, FM12.h), size: "md", label: "IN" },
    { id: "trig", kind: "in", ...mm(24, 78, FM12.w, FM12.h), size: "md", label: "TRIG" },
    { id: "rec", kind: "in", ...mm(36, 78, FM12.w, FM12.h), size: "md", label: "REC" },
    { id: "v_oct", kind: "in", ...mm(48, 78, FM12.w, FM12.h), size: "md", label: "1V/O" },
    { id: "out", kind: "out", ...mm(15, 100, FM12.w, FM12.h), size: "md", label: "OUT" },
    { id: "eoc", kind: "out", ...mm(30.48, 100, FM12.w, FM12.h), size: "md", label: "EOC" },
    { id: "busy", kind: "out", ...mm(46, 100, FM12.w, FM12.h), size: "md", label: "BUSY" }
  ]
};
var PANEL_LAYOUTS = {
  erica_mixer: fmMixer,
  fm_mixer: fmMixer,
  erica_output: fmOutput,
  fm_output: fmOutput,
  midi_cv: emenayMidiCv,
  midi_cc: emenayMidiCc,
  midi_pads: emenayMidiPads,
  polysynth: emenayPolysynth,
  envelope: fmEnvelope,
  fm_envelope: fmEnvelope,
  dual_vca: emenayDualVca,
  vco: emenayVco,
  erica_vco3: ericaVco3,
  erica_polivoks_vcf: ericaPolivoksVcf,
  erica_modulator: ericaModulator,
  erica_bassline: ericaBassline,
  erica_bbd: ericaBbd,
  erica_swamp: ericaSwamp,
  fm_clock: fmClock,
  fm_offset: fmOffset,
  fm_drift: fmDrift,
  fm_boost: fmBoost,
  fm_rng: fmRng,
  vcf: emenayVcf,
  noise: emenayNoise,
  facets: emenayFacets,
  lfo: emenayLfo,
  divider: emenayDivider,
  sequencer: emenaySequencer,
  sequencer16: emenaySequencer16,
  sequencer32: emenaySequencer32,
  sequencer64: emenaySequencer64,
  sample_hold: emenaySampleHold,
  lots: emenayLots,
  twin: emenayTwin,
  swell: emenaySwell,
  chimes: emenayChimes,
  twist: emenayTwist,
  seq_switch: emenaySwitch,
  wasp: emenayWasp,
  ar: emenayAr,
  adsr: emenayAdsr,
  sampler: emenaySampler,
  drums: emenayDrums,
  beat: emenayBeat,
  bitboy: emenayBitboy,
  mult: emenayMult,
  clk_mult: emenayClkMult,
  cv_switch: emenayCvSwitch,
  stereo: emenayStereo,
  delay: emenayDelay,
  reverb: emenayReverb
};

// src/panels.ts
var FM = "Free Modular faceplate SVG";
var EMENAY = "emenay faceplate (Erica DIY layout, CC-BY-SA-3.0)";
var PANEL_ART = {
  erica_mixer: {
    src: "/panels/fm/mixer.svg",
    fit: "fill",
    credit: `${FM} (Erica DIY DSP)`,
    hp: 8,
    showJackCaps: true
  },
  erica_output: {
    src: "/panels/fm/output.svg",
    fit: "fill",
    credit: "emenay faceplate (Erica DIY Output, CC-BY-SA-3.0)",
    hp: 8,
    jackArtInSvg: true
  },
  midi_cv: {
    src: "/panels/fm/midi_cv.svg",
    fit: "fill",
    credit: "emenay faceplate (8-ch MIDI\u2192CV)",
    hp: 12,
    jackArtInSvg: true
  },
  midi_cc: {
    src: "/panels/fm/midi_cc.svg",
    fit: "fill",
    credit: "emenay faceplate (8\xD7 MIDI CC\u2192CV)",
    hp: 8,
    jackArtInSvg: true
  },
  midi_pads: {
    src: "/panels/fm/midi_pads.svg",
    fit: "fill",
    credit: "emenay faceplate (MIDI note\u2192drum gates)",
    hp: 8,
    jackArtInSvg: true
  },
  polysynth: {
    src: "/panels/fm/polysynth.svg",
    fit: "fill",
    credit: "emenay faceplate (4-voice \u2014 built-in MIDI bus, no MidiCv needed)",
    hp: 12,
    jackArtInSvg: true
  },
  envelope: {
    src: "/panels/fm/envelope.svg",
    fit: "fill",
    credit: FM,
    hp: 8
  },
  dual_vca: {
    src: "/panels/fm/dual_vca.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 10,
    jackArtInSvg: true
  },
  vco: {
    src: "/panels/fm/vco.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 12,
    jackArtInSvg: true
  },
  erica_vco3: {
    src: "/panels/fm/erica_vco3.svg",
    fit: "fill",
    credit: "emenay faceplate (Erica DIY VCO3, CC-BY-SA-3.0)",
    hp: 12,
    jackArtInSvg: true
  },
  erica_polivoks_vcf: {
    src: "/panels/fm/erica_polivoks_vcf.svg",
    fit: "fill",
    credit: "emenay faceplate (Erica DIY Polivoks VCF, CC-BY-SA-3.0)",
    hp: 10,
    jackArtInSvg: true
  },
  erica_modulator: {
    src: "/panels/fm/erica_modulator.svg",
    fit: "fill",
    credit: "emenay faceplate (Erica DIY Modulator, CC-BY-SA-3.0)",
    hp: 12,
    jackArtInSvg: true
  },
  erica_bassline: {
    src: "/panels/fm/erica_bassline.svg",
    fit: "fill",
    credit: "emenay faceplate (Erica DIY Bassline, CC-BY-SA-3.0)",
    hp: 16,
    jackArtInSvg: true
  },
  erica_bbd: {
    src: "/panels/fm/erica_bbd.svg",
    fit: "fill",
    credit: "emenay faceplate (Erica DIY BBD, CC-BY-SA-3.0)",
    hp: 10,
    jackArtInSvg: true
  },
  erica_swamp: {
    src: "/panels/fm/erica_swamp.svg",
    fit: "fill",
    credit: "emenay faceplate (Erica DIY Swamp, CC-BY-SA-3.0)",
    hp: 12,
    jackArtInSvg: true
  },
  fm_mixer: {
    src: "/panels/fm/mixer.svg",
    fit: "fill",
    credit: FM,
    hp: 8,
    showJackCaps: true
  },
  fm_output: {
    src: "/panels/fm/output.svg",
    fit: "fill",
    credit: "emenay faceplate (Erica DIY Output, CC-BY-SA-3.0)",
    hp: 8,
    jackArtInSvg: true
  },
  fm_envelope: {
    src: "/panels/fm/envelope.svg",
    fit: "fill",
    credit: FM,
    hp: 8
  },
  fm_offset: {
    src: "/panels/fm/offset_atten.svg",
    fit: "fill",
    credit: FM,
    hp: 4,
    showJackCaps: true
  },
  fm_clock: {
    src: "/panels/fm/clock.svg",
    fit: "fill",
    credit: FM,
    hp: 8
  },
  fm_drift: {
    src: "/panels/fm/drift.svg",
    fit: "fill",
    credit: FM,
    hp: 4
  },
  fm_boost: {
    src: "/panels/fm/boost.svg",
    fit: "fill",
    credit: FM,
    hp: 4,
    showJackCaps: true
  },
  fm_rng: {
    src: "/panels/fm/rng.svg",
    fit: "fill",
    credit: FM,
    hp: 10,
    showJackCaps: true
  },
  vcf: {
    src: "/panels/fm/vcf.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 10,
    jackArtInSvg: true
  },
  noise: {
    src: "/panels/fm/noise.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 6,
    jackArtInSvg: true
  },
  facets: {
    src: "/panels/fm/facets.svg",
    fit: "fill",
    credit: "emenay faceplate (Facets \u2014 MI firmware)",
    hp: 12,
    jackArtInSvg: true
  },
  lfo: {
    src: "/panels/fm/lfo.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 8,
    jackArtInSvg: true
  },
  divider: {
    src: "/panels/fm/divider.svg",
    fit: "fill",
    credit: "emenay faceplate (clock divider \xF71/\xF72/\xF74/\xF78)",
    hp: 4,
    jackArtInSvg: true
  },
  sequencer: {
    src: "/panels/fm/sequencer.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 12,
    jackArtInSvg: true
  },
  sequencer16: {
    src: "/panels/fm/sequencer16.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 16,
    jackArtInSvg: true
  },
  sequencer32: {
    src: "/panels/fm/sequencer32.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 26,
    jackArtInSvg: true
  },
  sequencer64: {
    src: "/panels/fm/sequencer64.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 32,
    jackArtInSvg: true
  },
  sample_hold: {
    src: "/panels/fm/sample_hold.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 4,
    jackArtInSvg: true
  },
  lots: {
    src: "/panels/fm/lots.svg",
    fit: "fill",
    credit: "emenay faceplate (Lots \u2014 MI firmware)",
    hp: 18,
    jackArtInSvg: true
  },
  swell: {
    src: "/panels/fm/swell.svg",
    fit: "fill",
    credit: "emenay faceplate (Swell \u2014 MI firmware)",
    hp: 12,
    jackArtInSvg: true
  },
  chimes: {
    src: "/panels/fm/chimes.svg",
    fit: "fill",
    credit: "emenay faceplate (Chimes \u2014 MI firmware)",
    hp: 12,
    jackArtInSvg: true
  },
  twist: {
    src: "/panels/fm/twist.svg",
    fit: "fill",
    credit: "emenay faceplate (Twist \u2014 MI firmware)",
    hp: 10,
    jackArtInSvg: true
  },
  twin: {
    src: "/panels/fm/twin.svg",
    fit: "fill",
    credit: "emenay faceplate (Twin \u2014 Peaks MIT: EG / LFO / 808 drums)",
    hp: 8,
    jackArtInSvg: true
  },
  beat: {
    src: "/panels/fm/beat.svg",
    fit: "fill",
    credit: "emenay faceplate (Beat \u2014 pattern + lane mixer; select module to edit)",
    hp: 12,
    jackArtInSvg: true
  },
  seq_switch: {
    src: "/panels/fm/switch.svg",
    fit: "fill",
    credit: "emenay faceplate (Doepfer A-151\u2013inspired sequential switch)",
    hp: 6,
    jackArtInSvg: true
  },
  wasp: {
    src: "/panels/fm/wasp.svg",
    fit: "fill",
    credit: "emenay faceplate (EDP WASP\u2013inspired CMOS filter)",
    hp: 8,
    jackArtInSvg: true
  },
  ar: {
    src: "/panels/fm/ar.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 4,
    jackArtInSvg: true
  },
  adsr: {
    src: "/panels/fm/adsr.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 6,
    jackArtInSvg: true
  },
  sampler: {
    src: "/panels/fm/sampler.svg",
    fit: "fill",
    credit: "emenay faceplate (record / play sampler)",
    hp: 12,
    jackArtInSvg: true
  },
  drums: {
    src: "/panels/fm/drums.svg",
    fit: "fill",
    credit: "emenay faceplate (analog drum voices)",
    hp: 12,
    jackArtInSvg: true
  },
  bitboy: {
    src: "/panels/fm/bitboy.svg",
    fit: "fill",
    credit: "emenay faceplate (BitBoy \u2014 DMG CH1\u20134: sweep / pulse / wave / noise)",
    hp: 8,
    jackArtInSvg: true
  },
  mult: {
    src: "/panels/fm/mult.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 2,
    jackArtInSvg: true
  },
  clk_mult: {
    src: "/panels/fm/clk_mult.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 4
  },
  cv_switch: {
    src: "/panels/fm/cv_switch.svg",
    fit: "fill",
    credit: "emenay faceplate (CV-addressable switch)",
    hp: 6,
    jackArtInSvg: true
  },
  stereo: {
    src: "/panels/fm/stereo.svg",
    fit: "fill",
    credit: "emenay faceplate (stereo pan / width)",
    hp: 6,
    jackArtInSvg: true
  },
  delay: {
    src: "/panels/fm/delay.svg",
    fit: "fill",
    credit: "emenay faceplate (delay / ping-pong)",
    hp: 8,
    jackArtInSvg: true
  },
  reverb: {
    src: "/panels/fm/reverb.svg",
    fit: "fill",
    credit: "emenay faceplate (stereo reverb)",
    hp: 8,
    jackArtInSvg: true
  }
};
export {
  PANEL_ART,
  PANEL_LAYOUTS
};
