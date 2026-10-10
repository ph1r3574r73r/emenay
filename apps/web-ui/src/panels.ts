/**
 * Faceplate artwork for open-source Eurorack modules.
 *
 * Free Modular: SVG faceplates from https://freemodular.org / fm-artifacts (Quinn Freedman)
 * Erica Synths DIY: layout inspiration (CC-BY-SA-3.0); emenay VCO/Dual VCA/VCF/Noise plates are
 * clean aluminum-style SVGs matching DIY panel hole maps (not PCB Fab schematics).
 */

export type PanelArt = {
  src: string
  fit: 'contain' | 'cover' | 'fill'
  credit: string
  hp?: number
  /**
   * When true, overlay HTML silk on knobs/jacks. Only for plates that have
   * no printed labels in the SVG — otherwise labels double up and the
   * has-silk transform pulls controls off the artwork.
   */
  showHitLabels?: boolean
  /**
   * Free Modular plates use through-hole circles (+) instead of drawn jacks.
   * Draw HTML jack caps on top of those holes.
   */
  showJackCaps?: boolean
  /** Plate already draws jack rings in SVG — use invisible hit targets only. */
  jackArtInSvg?: boolean
}

const FM = 'Free Modular faceplate SVG'
const EMENAY = 'emenay faceplate (Erica DIY layout, CC-BY-SA-3.0)'

/** Map engine type_id → panel art */
export const PANEL_ART: Record<string, PanelArt> = {
  erica_mixer: {
    src: '/panels/fm/mixer.svg',
    fit: 'fill',
    credit: `${FM} (Erica DIY DSP)`,
    hp: 8,
    showJackCaps: true,
  },
  erica_output: {
    src: '/panels/fm/output.svg',
    fit: 'fill',
    credit: `${FM} (Erica DIY DSP)`,
    hp: 8,
    showJackCaps: true,
  },
  midi_cv: {
    src: '/panels/fm/midi_cv.svg',
    fit: 'fill',
    credit: 'emenay faceplate (8-ch MIDI→CV)',
    hp: 12,
    jackArtInSvg: true,
  },
  envelope: {
    src: '/panels/fm/envelope.svg',
    fit: 'fill',
    credit: FM,
    hp: 8,
  },
  dual_vca: {
    src: '/panels/fm/dual_vca.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 10,
  },
  vco: {
    src: '/panels/fm/vco.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 12,
  },
  fm_mixer: {
    src: '/panels/fm/mixer.svg',
    fit: 'fill',
    credit: FM,
    hp: 8,
    showJackCaps: true,
  },
  fm_output: {
    src: '/panels/fm/output.svg',
    fit: 'fill',
    credit: FM,
    hp: 8,
    showJackCaps: true,
  },
  fm_envelope: {
    src: '/panels/fm/envelope.svg',
    fit: 'fill',
    credit: FM,
    hp: 8,
  },
  fm_offset: {
    src: '/panels/fm/offset_atten.svg',
    fit: 'fill',
    credit: FM,
    hp: 4,
    showJackCaps: true,
  },
  fm_clock: {
    src: '/panels/fm/clock.svg',
    fit: 'fill',
    credit: FM,
    hp: 8,
  },
  fm_drift: {
    src: '/panels/fm/drift.svg',
    fit: 'fill',
    credit: FM,
    hp: 4,
  },
  fm_boost: {
    src: '/panels/fm/boost.svg',
    fit: 'fill',
    credit: FM,
    hp: 4,
    showJackCaps: true,
  },
  fm_rng: {
    src: '/panels/fm/rng.svg',
    fit: 'fill',
    credit: FM,
    hp: 10,
    showJackCaps: true,
  },
  vcf: {
    src: '/panels/fm/vcf.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 10,
  },
  noise: {
    src: '/panels/fm/noise.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 6,
  },
  facets: {
    src: '/panels/fm/facets.svg',
    fit: 'fill',
    credit: 'emenay faceplate (Facets — MI firmware)',
    hp: 12,
  },
  lfo: {
    src: '/panels/fm/lfo.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 8,
  },
  divider: {
    src: '/panels/fm/divider.svg',
    fit: 'fill',
    credit: 'emenay faceplate (clock divider ÷1/÷2/÷4/÷8)',
    hp: 4,
  },
  sequencer: {
    src: '/panels/fm/sequencer.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 12,
  },
  sequencer16: {
    src: '/panels/fm/sequencer16.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 16,
  },
  sequencer32: {
    src: '/panels/fm/sequencer32.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 26,
  },
  sequencer64: {
    src: '/panels/fm/sequencer64.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 32,
  },
  sample_hold: {
    src: '/panels/fm/sample_hold.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 4,
  },
  lots: {
    src: '/panels/fm/lots.svg',
    fit: 'fill',
    credit: 'emenay faceplate (Lots — MI firmware)',
    hp: 18,
  },
  swell: {
    src: '/panels/fm/swell.svg',
    fit: 'fill',
    credit: 'emenay faceplate (Swell — MI firmware)',
    hp: 12,
  },
  chimes: {
    src: '/panels/fm/chimes.svg',
    fit: 'fill',
    credit: 'emenay faceplate (Chimes — MI firmware)',
    hp: 12,
  },
  twist: {
    src: '/panels/fm/twist.svg',
    fit: 'fill',
    credit: 'emenay faceplate (Twist — MI firmware)',
    hp: 10,
  },
  seq_switch: {
    src: '/panels/fm/switch.svg',
    fit: 'fill',
    credit: 'emenay faceplate (Doepfer A-151–inspired sequential switch)',
    hp: 6,
  },
  wasp: {
    src: '/panels/fm/wasp.svg',
    fit: 'fill',
    credit: 'emenay faceplate (EDP WASP–inspired CMOS filter)',
    hp: 8,
  },
  ar: {
    src: '/panels/fm/ar.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 4,
  },
  adsr: {
    src: '/panels/fm/adsr.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 6,
  },
  sampler: {
    src: '/panels/fm/sampler.svg',
    fit: 'fill',
    credit: 'emenay faceplate (record / play sampler)',
    hp: 12,
  },
  drums: {
    src: '/panels/fm/drums.svg',
    fit: 'fill',
    credit: 'emenay faceplate (analog drum voices)',
    hp: 12,
  },
  bitboy: {
    src: '/panels/fm/bitboy.svg',
    fit: 'fill',
    credit: 'emenay faceplate (BitBoy — GB/LSDJ–inspired, not a WaveBoy clone)',
    hp: 8,
  },
  mult: {
    src: '/panels/fm/mult.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 2,
    jackArtInSvg: true,
  },
  clk_mult: {
    src: '/panels/fm/clk_mult.svg',
    fit: 'fill',
    credit: EMENAY,
    hp: 4,
  },
  cv_switch: {
    src: '/panels/fm/cv_switch.svg',
    fit: 'fill',
    credit: 'emenay faceplate (CV-addressable switch)',
    hp: 6,
  },
  stereo: {
    src: '/panels/fm/stereo.svg',
    fit: 'fill',
    credit: 'emenay faceplate (stereo pan / width)',
    hp: 6,
  },
  delay: {
    src: '/panels/fm/delay.svg',
    fit: 'fill',
    credit: 'emenay faceplate (delay / ping-pong)',
    hp: 8,
  },
  reverb: {
    src: '/panels/fm/reverb.svg',
    fit: 'fill',
    credit: 'emenay faceplate (stereo reverb)',
    hp: 8,
  },
}

export function resolvePanel(typeId: string): PanelArt | undefined {
  if (typeId === 'speaker') return undefined
  return PANEL_ART[typeId]
}
