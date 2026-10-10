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
var fmOutput = {
  source: "Free Modular output.svg throughholes",
  hits: [
    { id: "phones", kind: "param", ...mm(29.04, 19.54, FM8.w, FM8.h), size: "md", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(13.8, 36.05, FM8.w, FM8.h), size: "md", color: KNOB_BLACK },
    { id: "in_l", kind: "in", ...mm(12.53, 56.37, FM8.w, FM8.h), size: "md" },
    { id: "in_r", kind: "in", ...mm(27.77, 56.37, FM8.w, FM8.h), size: "md" },
    { id: "line_l", kind: "out", ...mm(20.15, 75.42, FM8.w, FM8.h), size: "lg" },
    { id: "line_r", kind: "out", ...mm(20.15, 91.93, FM8.w, FM8.h), size: "lg" },
    { id: "phones", kind: "out", ...mm(20.15, 108.44, FM8.w, FM8.h), size: "lg" },
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
    { id: "length", kind: "param", ...mm(14, 26, FM12.w, FM12.h), size: "md", label: "LEN", color: KNOB_BLACK },
    { id: "glide", kind: "param", ...mm(30.48, 26, FM12.w, FM12.h), size: "md", label: "GLIDE", color: KNOB_BLACK },
    { id: "step", kind: "digit", ...mm(47, 26, FM12.w, FM12.h), size: "sm", digits: 1, color: "#e8c547" },
    { id: "s1", kind: "param", ...mm(10, 48, FM12.w, FM12.h), size: "sm", label: "1", color: KNOB_BLACK },
    { id: "s2", kind: "param", ...mm(23.5, 48, FM12.w, FM12.h), size: "sm", label: "2", color: KNOB_BLACK },
    { id: "s3", kind: "param", ...mm(37, 48, FM12.w, FM12.h), size: "sm", label: "3", color: KNOB_BLACK },
    { id: "s4", kind: "param", ...mm(50.5, 48, FM12.w, FM12.h), size: "sm", label: "4", color: KNOB_BLACK },
    { id: "g1", kind: "toggle", ...mm(10, 58, FM12.w, FM12.h), size: "sm", label: "G1" },
    { id: "g2", kind: "toggle", ...mm(23.5, 58, FM12.w, FM12.h), size: "sm", label: "G2" },
    { id: "g3", kind: "toggle", ...mm(37, 58, FM12.w, FM12.h), size: "sm", label: "G3" },
    { id: "g4", kind: "toggle", ...mm(50.5, 58, FM12.w, FM12.h), size: "sm", label: "G4" },
    { id: "led1", kind: "led", ...mm(10, 41.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led2", kind: "led", ...mm(23.5, 41.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led3", kind: "led", ...mm(37, 41.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led4", kind: "led", ...mm(50.5, 41.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "s5", kind: "param", ...mm(10, 72, FM12.w, FM12.h), size: "sm", label: "5", color: KNOB_BLACK },
    { id: "s6", kind: "param", ...mm(23.5, 72, FM12.w, FM12.h), size: "sm", label: "6", color: KNOB_BLACK },
    { id: "s7", kind: "param", ...mm(37, 72, FM12.w, FM12.h), size: "sm", label: "7", color: KNOB_BLACK },
    { id: "s8", kind: "param", ...mm(50.5, 72, FM12.w, FM12.h), size: "sm", label: "8", color: KNOB_BLACK },
    { id: "g5", kind: "toggle", ...mm(10, 82, FM12.w, FM12.h), size: "sm", label: "G5" },
    { id: "g6", kind: "toggle", ...mm(23.5, 82, FM12.w, FM12.h), size: "sm", label: "G6" },
    { id: "g7", kind: "toggle", ...mm(37, 82, FM12.w, FM12.h), size: "sm", label: "G7" },
    { id: "g8", kind: "toggle", ...mm(50.5, 82, FM12.w, FM12.h), size: "sm", label: "G8" },
    { id: "led5", kind: "led", ...mm(10, 65.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led6", kind: "led", ...mm(23.5, 65.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led7", kind: "led", ...mm(37, 65.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "led8", kind: "led", ...mm(50.5, 65.5, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "clock", kind: "in", ...mm(18, 96, FM12.w, FM12.h), size: "md", label: "CLK" },
    { id: "reset", kind: "in", ...mm(42, 96, FM12.w, FM12.h), size: "md", label: "RST" },
    { id: "cv", kind: "out", ...mm(12, 114, FM12.w, FM12.h), size: "md", label: "CV" },
    { id: "gate", kind: "out", ...mm(30.48, 114, FM12.w, FM12.h), size: "md", label: "GATE" },
    { id: "eoc", kind: "out", ...mm(49, 114, FM12.w, FM12.h), size: "md", label: "EOC" }
  ]
};
var emenaySequencer16 = {
  source: "emenay fm/sequencer16.svg",
  hits: [
    { id: "length", kind: "param", ...mm(18, 24, FM16.w, FM16.h), size: "md", label: "LEN", color: KNOB_BLACK },
    { id: "glide", kind: "param", ...mm(36, 24, FM16.w, FM16.h), size: "md", label: "GLIDE", color: KNOB_BLACK },
    { id: "step", kind: "digit", ...mm(62, 24, FM16.w, FM16.h), size: "md", digits: 2, color: "#e8c547" },
    // pots 1–8
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `s${i + 1}`,
      kind: "param",
      ...mm(x, 42, FM16.w, FM16.h),
      size: "sm",
      label: `${i + 1}`,
      color: KNOB_BLACK
    })),
    // gates 1–8
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `g${i + 1}`,
      kind: "toggle",
      ...mm(x, 51.3, FM16.w, FM16.h),
      size: "sm",
      label: `G${i + 1}`
    })),
    // leds 1–8
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `led${i + 1}`,
      kind: "led",
      ...mm(x, 36.5, FM16.w, FM16.h),
      size: "sm",
      color: "#e8c547"
    })),
    // pots 9–16
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `s${i + 9}`,
      kind: "param",
      ...mm(x, 68, FM16.w, FM16.h),
      size: "sm",
      label: `${i + 9}`,
      color: KNOB_BLACK
    })),
    // gates 9–16
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `g${i + 9}`,
      kind: "toggle",
      ...mm(x, 77.3, FM16.w, FM16.h),
      size: "sm",
      label: `G${i + 9}`
    })),
    // leds 9–16
    ...[7, 16.5, 26, 35.5, 45, 54.5, 64, 73.5].map((x, i) => ({
      id: `led${i + 9}`,
      kind: "led",
      ...mm(x, 62.5, FM16.w, FM16.h),
      size: "sm",
      color: "#e8c547"
    })),
    { id: "clock", kind: "in", ...mm(26, 96, FM16.w, FM16.h), size: "md", label: "CLK" },
    { id: "reset", kind: "in", ...mm(55, 96, FM16.w, FM16.h), size: "md", label: "RST" },
    { id: "cv", kind: "out", ...mm(18, 114, FM16.w, FM16.h), size: "md", label: "CV" },
    { id: "gate", kind: "out", ...mm(40.64, 114, FM16.w, FM16.h), size: "md", label: "GATE" },
    { id: "eoc", kind: "out", ...mm(63, 114, FM16.w, FM16.h), size: "md", label: "EOC" }
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
    { id: "rate", kind: "param", ...mm(15, 28, FM12.w, FM12.h), size: "md", label: "RATE", color: KNOB_BLACK },
    { id: "bias", kind: "param", ...mm(45.5, 28, FM12.w, FM12.h), size: "md", label: "BIAS", color: KNOB_BLACK },
    { id: "jitter", kind: "param", ...mm(15, 52, FM12.w, FM12.h), size: "md", label: "JITTER", color: KNOB_BLACK },
    { id: "spread", kind: "param", ...mm(30.48, 52, FM12.w, FM12.h), size: "md", label: "SPREAD", color: KNOB_BLACK },
    { id: "steps", kind: "param", ...mm(45.5, 52, FM12.w, FM12.h), size: "md", label: "STEPS", color: KNOB_BLACK },
    { id: "t_mode", kind: "param", ...mm(15, 66, FM12.w, FM12.h), size: "sm", label: "t MODE", color: KNOB_BLACK },
    { id: "x_mode", kind: "param", ...mm(45.5, 66, FM12.w, FM12.h), size: "sm", label: "X MODE", color: KNOB_BLACK },
    { id: "clock", kind: "in", ...mm(15, 78, FM12.w, FM12.h), size: "md", label: "CLK" },
    { id: "rate_cv", kind: "in", ...mm(30.48, 78, FM12.w, FM12.h), size: "md", label: "RATE" },
    { id: "spread_cv", kind: "in", ...mm(45.5, 78, FM12.w, FM12.h), size: "md", label: "SPR" },
    { id: "t1", kind: "led", ...mm(12, 90, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "t2", kind: "led", ...mm(30.48, 90, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "t3", kind: "led", ...mm(49, 90, FM12.w, FM12.h), size: "sm", color: "#e8c547" },
    { id: "t1", kind: "out", ...mm(12, 96, FM12.w, FM12.h), size: "md", label: "t1" },
    { id: "t2", kind: "out", ...mm(30.48, 96, FM12.w, FM12.h), size: "md", label: "t2" },
    { id: "t3", kind: "out", ...mm(49, 96, FM12.w, FM12.h), size: "md", label: "t3" },
    { id: "x1", kind: "out", ...mm(12, 114, FM12.w, FM12.h), size: "md", label: "X1" },
    { id: "x2", kind: "out", ...mm(30.48, 114, FM12.w, FM12.h), size: "md", label: "X2" },
    { id: "x3", kind: "out", ...mm(49, 114, FM12.w, FM12.h), size: "md", label: "X3" }
  ]
};
var emenaySwell = {
  source: "emenay fm/swell.svg",
  hits: [
    { id: "freq", kind: "param", ...mm(30.48, 28, FM12.w, FM12.h), size: "lg", label: "FREQ", color: KNOB_BLACK },
    { id: "shape", kind: "param", ...mm(12, 54, FM12.w, FM12.h), size: "md", label: "SHAPE", color: KNOB_BLACK },
    { id: "slope", kind: "param", ...mm(30.48, 54, FM12.w, FM12.h), size: "md", label: "SLOPE", color: KNOB_BLACK },
    { id: "smooth", kind: "param", ...mm(49, 54, FM12.w, FM12.h), size: "md", label: "SMOOTH", color: KNOB_BLACK },
    { id: "shift", kind: "param", ...mm(30.48, 74, FM12.w, FM12.h), size: "md", label: "SHIFT", color: KNOB_BLACK },
    { id: "pluck", kind: "toggle", ...mm(49, 74, FM12.w, FM12.h), size: "sm", label: "PLUCK" },
    { id: "v_oct", kind: "in", ...mm(8, 92, FM12.w, FM12.h), size: "sm", label: "1V/O" },
    { id: "trig", kind: "in", ...mm(19.5, 92, FM12.w, FM12.h), size: "sm", label: "TRIG" },
    { id: "shape_cv", kind: "in", ...mm(30.48, 92, FM12.w, FM12.h), size: "sm", label: "SHP" },
    { id: "slope_cv", kind: "in", ...mm(41.5, 92, FM12.w, FM12.h), size: "sm", label: "SLP" },
    { id: "fm", kind: "in", ...mm(52.5, 92, FM12.w, FM12.h), size: "sm", label: "FM" },
    { id: "uni", kind: "out", ...mm(12, 112, FM12.w, FM12.h), size: "sm", label: "UNI" },
    { id: "bi", kind: "out", ...mm(24.5, 112, FM12.w, FM12.h), size: "sm", label: "BI" },
    { id: "tri", kind: "out", ...mm(37, 112, FM12.w, FM12.h), size: "sm", label: "TRI" },
    { id: "gate", kind: "out", ...mm(49.5, 112, FM12.w, FM12.h), size: "sm", label: "GATE" }
  ]
};
var emenayChimes = {
  source: "emenay fm/chimes.svg",
  hits: [
    { id: "freq", kind: "param", ...mm(30.48, 28, FM12.w, FM12.h), size: "lg", label: "FREQ", color: KNOB_BLACK },
    { id: "structure", kind: "param", ...mm(12, 54, FM12.w, FM12.h), size: "md", label: "STRUCT", color: KNOB_BLACK },
    { id: "brightness", kind: "param", ...mm(30.48, 54, FM12.w, FM12.h), size: "md", label: "BRIGHT", color: KNOB_BLACK },
    { id: "damping", kind: "param", ...mm(49, 54, FM12.w, FM12.h), size: "md", label: "DAMP", color: KNOB_BLACK },
    { id: "position", kind: "param", ...mm(30.48, 74, FM12.w, FM12.h), size: "md", label: "POS", color: KNOB_BLACK },
    { id: "v_oct", kind: "in", ...mm(12, 94, FM12.w, FM12.h), size: "md", label: "1V/O" },
    { id: "trig", kind: "in", ...mm(30.48, 94, FM12.w, FM12.h), size: "md", label: "TRIG" },
    { id: "in", kind: "in", ...mm(49, 94, FM12.w, FM12.h), size: "md", label: "IN" },
    { id: "structure_cv", kind: "in", ...mm(8, 108, FM12.w, FM12.h), size: "sm", label: "STR" },
    { id: "brightness_cv", kind: "in", ...mm(17, 108, FM12.w, FM12.h), size: "sm", label: "BRT" },
    { id: "damping_cv", kind: "in", ...mm(26, 108, FM12.w, FM12.h), size: "sm", label: "DMP" },
    { id: "out", kind: "out", ...mm(36, 108, FM12.w, FM12.h), size: "md", label: "OUT" },
    { id: "odd", kind: "out", ...mm(46, 108, FM12.w, FM12.h), size: "sm", label: "ODD" },
    { id: "even", kind: "out", ...mm(55, 108, FM12.w, FM12.h), size: "sm", label: "EVEN" }
  ]
};
var emenayTwist = {
  source: "emenay fm/twist.svg",
  hits: [
    { id: "algorithm", kind: "param", ...mm(25.4, 29, FM10.w, FM10.h), size: "lg", label: "ALGO", color: KNOB_BLACK },
    { id: "timbre", kind: "param", ...mm(14, 56, FM10.w, FM10.h), size: "md", label: "TIMBRE", color: KNOB_BLACK },
    { id: "level", kind: "param", ...mm(36.8, 56, FM10.w, FM10.h), size: "md", label: "LEVEL", color: KNOB_BLACK },
    { id: "freq", kind: "param", ...mm(25.4, 76, FM10.w, FM10.h), size: "md", label: "FREQ", color: KNOB_BLACK },
    { id: "carrier", kind: "in", ...mm(14, 96, FM10.w, FM10.h), size: "md", label: "CAR" },
    { id: "modulator", kind: "in", ...mm(36.8, 96, FM10.w, FM10.h), size: "md", label: "MOD" },
    { id: "algo_cv", kind: "in", ...mm(8, 110, FM10.w, FM10.h), size: "md", label: "ALG" },
    { id: "timbre_cv", kind: "in", ...mm(17.5, 110, FM10.w, FM10.h), size: "md", label: "TMB" },
    { id: "level_cv", kind: "in", ...mm(27, 110, FM10.w, FM10.h), size: "md", label: "LVL" },
    { id: "out", kind: "out", ...mm(36.5, 110, FM10.w, FM10.h), size: "md", label: "OUT" },
    { id: "aux", kind: "out", ...mm(46, 110, FM10.w, FM10.h), size: "md", label: "AUX" }
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
    { id: "v_oct", kind: "in", ...mm(10, 96, EM8.w, EM8.h), size: "md", label: "1V/O" },
    { id: "frame_cv", kind: "in", ...mm(20.32, 96, EM8.w, EM8.h), size: "md", label: "FRAME" },
    { id: "gate", kind: "in", ...mm(30.5, 96, EM8.w, EM8.h), size: "md", label: "GATE" },
    { id: "out", kind: "out", ...mm(14, 114, EM8.w, EM8.h), size: "md", label: "OUT" },
    { id: "step", kind: "out", ...mm(27, 114, EM8.w, EM8.h), size: "md", label: "STEP" }
  ]
};
var emenayMult = {
  source: "emenay fm/mult.svg",
  hits: [
    { id: "in", kind: "in", ...mm(5.08, 28, EM2.w, EM2.h), size: "md", label: "IN" },
    { id: "out1", kind: "out", ...mm(5.08, 52, EM2.w, EM2.h), size: "md", label: "1" },
    { id: "out2", kind: "out", ...mm(5.08, 70, EM2.w, EM2.h), size: "md", label: "2" },
    { id: "out3", kind: "out", ...mm(5.08, 88, EM2.w, EM2.h), size: "md", label: "3" },
    { id: "out4", kind: "out", ...mm(5.08, 106, EM2.w, EM2.h), size: "md", label: "4" }
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
  envelope: fmEnvelope,
  fm_envelope: fmEnvelope,
  dual_vca: emenayDualVca,
  vco: emenayVco,
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
  sample_hold: emenaySampleHold,
  lots: emenayLots,
  swell: emenaySwell,
  chimes: emenayChimes,
  twist: emenayTwist,
  seq_switch: emenaySwitch,
  wasp: emenayWasp,
  ar: emenayAr,
  adsr: emenayAdsr,
  sampler: emenaySampler,
  drums: emenayDrums,
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
    hp: 8
  },
  erica_output: {
    src: "/panels/fm/output.svg",
    fit: "fill",
    credit: `${FM} (Erica DIY DSP)`,
    hp: 8
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
    hp: 10
  },
  vco: {
    src: "/panels/fm/vco.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 12
  },
  fm_mixer: {
    src: "/panels/fm/mixer.svg",
    fit: "fill",
    credit: FM,
    hp: 8
  },
  fm_output: {
    src: "/panels/fm/output.svg",
    fit: "fill",
    credit: FM,
    hp: 8
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
    hp: 4
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
    hp: 4
  },
  fm_rng: {
    src: "/panels/fm/rng.svg",
    fit: "fill",
    credit: FM,
    hp: 10
  },
  vcf: {
    src: "/panels/fm/vcf.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 10
  },
  noise: {
    src: "/panels/fm/noise.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 6
  },
  facets: {
    src: "/panels/fm/facets.svg",
    fit: "fill",
    credit: "emenay faceplate (Facets — MI firmware)",
    hp: 12
  },
  lfo: {
    src: "/panels/fm/lfo.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 8
  },
  divider: {
    src: "/panels/fm/divider.svg",
    fit: "fill",
    credit: "emenay faceplate (clock divider \xF71/\xF72/\xF74/\xF78)",
    hp: 4
  },
  sequencer: {
    src: "/panels/fm/sequencer.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 12
  },
  sequencer16: {
    src: "/panels/fm/sequencer16.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 16
  },
  sample_hold: {
    src: "/panels/fm/sample_hold.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 4
  },
  lots: {
    src: "/panels/fm/lots.svg",
    fit: "fill",
    credit: "emenay faceplate (Lots — MI firmware)",
    hp: 12
  },
  swell: {
    src: "/panels/fm/swell.svg",
    fit: "fill",
    credit: "emenay faceplate (Swell — MI firmware)",
    hp: 12
  },
  chimes: {
    src: "/panels/fm/chimes.svg",
    fit: "fill",
    credit: "emenay faceplate (Chimes — MI firmware)",
    hp: 12
  },
  twist: {
    src: "/panels/fm/twist.svg",
    fit: "fill",
    credit: "emenay faceplate (Twist — MI firmware)",
    hp: 10
  },
  seq_switch: {
    src: "/panels/fm/switch.svg",
    fit: "fill",
    credit: "emenay faceplate (Doepfer A-151\u2013inspired sequential switch)",
    hp: 6
  },
  wasp: {
    src: "/panels/fm/wasp.svg",
    fit: "fill",
    credit: "emenay faceplate (EDP WASP\u2013inspired CMOS filter)",
    hp: 8
  },
  ar: {
    src: "/panels/fm/ar.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 4
  },
  adsr: {
    src: "/panels/fm/adsr.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 6
  },
  sampler: {
    src: "/panels/fm/sampler.svg",
    fit: "fill",
    credit: "emenay faceplate (record / play sampler)",
    hp: 12
  },
  drums: {
    src: "/panels/fm/drums.svg",
    fit: "fill",
    credit: "emenay faceplate (analog drum voices)",
    hp: 12
  },
  bitboy: {
    src: "/panels/fm/bitboy.svg",
    fit: "fill",
    credit: "emenay faceplate (BitBoy \u2014 GB/LSDJ\u2013inspired, not a WaveBoy clone)",
    hp: 8
  },
  mult: {
    src: "/panels/fm/mult.svg",
    fit: "fill",
    credit: EMENAY,
    hp: 2
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
    hp: 6
  },
  stereo: {
    src: "/panels/fm/stereo.svg",
    fit: "fill",
    credit: "emenay faceplate (stereo pan / width)",
    hp: 6
  },
  delay: {
    src: "/panels/fm/delay.svg",
    fit: "fill",
    credit: "emenay faceplate (delay / ping-pong)",
    hp: 8
  },
  reverb: {
    src: "/panels/fm/reverb.svg",
    fit: "fill",
    credit: "emenay faceplate (stereo reverb)",
    hp: 8
  }
};
export {
  PANEL_ART,
  PANEL_LAYOUTS
};
