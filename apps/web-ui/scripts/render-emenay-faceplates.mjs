#!/usr/bin/env node
/**
 * Pedal-shop faceplates: each module gets its own color world + extravagant art.
 * Wells/jacks are still laid out from PANEL_LAYOUTS so hits never drift.
 *
 * Families:
 *   mi     — name-as-art (crystals, marbles, tides…)
 *   erica  — black & white DIY silk, ornate linework
 *   emenay — loud, mismatched, guitar-pedal energy
 *
 *   npm run faceplates:render
 *   npm run faceplates:render -- beat delay facets
 */
import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const web = path.resolve(__dirname, '..')
const outBundle = path.join(web, 'scripts/.faceplate-bundle.mjs')

await esbuild.build({
  entryPoints: [path.join(web, 'scripts/faceplate-audit-entry.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: outBundle,
  logLevel: 'silent',
})

const { PANEL_LAYOUTS, PANEL_ART } = await import(outBundle + `?t=${Date.now()}`)

const HP_MM = 5.08
const H = 128.5

/** Resolve /panels/... paths to data URIs so art survives SVG-as-<img>. */
function embedLocalImage(href) {
  if (!href || href.startsWith('data:')) return href
  const rel = href.replace(/^\//, '')
  const file = path.join(web, 'public', rel)
  if (!fs.existsSync(file)) {
    console.warn(`bgImage missing: ${href}`)
    return href
  }
  const ext = path.extname(file).slice(1).toLowerCase()
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : `image/${ext}`
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

/** Pedal-shop type rack — pick per plate via theme.face / theme.labelFace. */
const FACES = {
  futurist: '"Avenir Next", Futura, "Century Gothic", "Trebuchet MS", sans-serif',
  condensed: '"DIN Condensed", "Avenir Next Condensed", "Arial Narrow", sans-serif',
  grotesk: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  soft: '"Gill Sans", "Trebuchet MS", "Segoe UI", sans-serif',
  display: 'Georgia, "Palatino Linotype", "Book Antiqua", serif',
  slab: 'Rockwell, "Courier New", "Lucida Console", monospace',
  mono: '"Courier New", Courier, Monaco, monospace',
  impact: 'Impact, "Arial Black", "Helvetica Neue", sans-serif',
  tech: 'Menlo, "Lucida Console", Monaco, monospace',
  rounded: '"Avenir Next", "Segoe UI", "Trebuchet MS", sans-serif',
}

const FONT_ERICA = FACES.condensed
const FONT_EMENAY = FACES.grotesk
const FONT_LABEL = FACES.grotesk

const ERICA = {
  family: 'erica',
  top: '#f7f7f4',
  bot: '#e6e6e0',
  ink: '#0a0a0a',
  mute: '#2e2e2e',
  accent: '#0a0a0a',
  accent2: '#0a0a0a',
  skin: 'erica-ornament',
}

/** @type {Record<string, any>} */
const THEMES = {
  // ── MI — quiet palette + concept art that matches the name / job ─
  facets: {
    family: 'mi',
    title: 'FACETS',
    sub: 'macro oscillator',
    top: '#1c1828',
    bot: '#121018',
    ink: '#f4efe8',
    mute: '#c8c0b4',
    accent: '#d4b896',
    accent2: '#8a7a98',
    bgImage: '/panels/fm/art/facets.jpg',
    bgOpacity: 0.78,
    skin: 'mi-vignette',
    motif: null,
    titleStyle: 'stamp',
  },
  lots: {
    family: 'mi',
    title: 'LOTS',
    sub: 'random streams',
    top: '#1a2430',
    bot: '#101820',
    ink: '#f0f4f8',
    mute: '#a8b4c0',
    accent: '#c4a882',
    accent2: '#6a8498',
    bgImage: '/panels/fm/art/lots.jpg',
    bgOpacity: 0.75,
    skin: 'mi-vignette',
    motif: null,
    titleStyle: 'stamp',
  },
  swell: {
    family: 'mi',
    title: 'SWELL',
    sub: 'tidal modulator',
    top: '#142428',
    bot: '#0c181c',
    ink: '#eef6f4',
    mute: '#a0b8b4',
    accent: '#8ab4b0',
    accent2: '#c8b090',
    bgImage: '/panels/fm/art/swell.jpg',
    bgOpacity: 0.72,
    skin: 'mi-vignette',
    motif: null,
    titleStyle: 'serif',
  },
  chimes: {
    family: 'mi',
    title: 'CHIMES',
    sub: 'resonator',
    top: '#241c14',
    bot: '#14100c',
    ink: '#f8f0e4',
    mute: '#c0a888',
    accent: '#d4a878',
    accent2: '#8a7060',
    bgImage: '/panels/fm/art/chimes.jpg',
    bgOpacity: 0.76,
    skin: 'mi-vignette',
    motif: null,
    titleStyle: 'serif',
  },
  twist: {
    family: 'mi',
    title: 'TWIST',
    sub: 'meta-modulator',
    top: '#201820',
    bot: '#141018',
    ink: '#f6f0f4',
    mute: '#b8a8b4',
    accent: '#c898a8',
    accent2: '#78a8a0',
    bgImage: '/panels/fm/art/twist.jpg',
    bgOpacity: 0.74,
    skin: 'mi-vignette',
    motif: null,
    titleStyle: 'stamp',
  },
  twin: {
    family: 'mi',
    title: 'TWIN',
    sub: 'dual peaks',
    top: '#1c2028',
    bot: '#101418',
    ink: '#f0f2f4',
    mute: '#a8b0b8',
    accent: '#d08070',
    accent2: '#7090b0',
    bgImage: '/panels/fm/art/twin.jpg',
    bgOpacity: 0.74,
    skin: 'mi-vignette',
    motif: null,
    titleStyle: 'split',
  },

  // ── Erica DIY — B&W, ornate ───────────────────────────────
  erica_vco3: { ...ERICA, title: 'VCO3', sub: 'ERICA DIY', motif: 'erica-wave' },
  erica_polivoks_vcf: {
    ...ERICA,
    title: 'POLIVOKS',
    sub: 'ERICA DIY · VCF',
    motif: 'erica-filter',
  },
  erica_modulator: {
    ...ERICA,
    title: 'MODULATOR',
    sub: 'ERICA DIY',
    motif: 'erica-mod',
  },
  erica_bassline: {
    ...ERICA,
    title: 'BASSLINE',
    sub: 'ERICA DIY',
    motif: 'erica-bass',
  },
  erica_bbd: { ...ERICA, title: 'BBD', sub: 'ERICA DIY', motif: 'erica-bbd' },
  erica_swamp: {
    ...ERICA,
    title: 'SWAMP',
    sub: 'ERICA DIY',
    motif: 'erica-swamp',
  },
  erica_output: {
    ...ERICA,
    title: 'OUTPUT',
    sub: 'ERICA DIY · LINE',
    motif: 'erica-out',
    skin: 'erica-ornament',
  },

  // ── emenay — pedal-shop chaos (no shared palette) ─────────
  beat: {
    family: 'emenay',
    title: 'BEAT',
    sub: 'pattern · lanes',
    top: '#ff0099',
    bot: '#1a0033',
    ink: '#ffffff',
    mute: '#ffb3e0',
    accent: '#00ffcc',
    accent2: '#ffff00',
    skin: 'step-grid',
    motif: 'beat-boom',
    titleStyle: 'neon',
  },
  polysynth: {
    family: 'emenay',
    title: 'POLY',
    sub: '4-voice MIDI',
    top: '#a8e6cf',
    bot: '#3d5a80',
    ink: '#0d1b2a',
    mute: '#1b3a4b',
    accent: '#ee6c4d',
    accent2: '#98c1d9',
    skin: 'soft-blobs',
    motif: 'poly-keys',
    titleStyle: 'round',
  },
  midi_cv: {
    family: 'emenay',
    title: 'MIDI→CV',
    sub: '8 voices',
    top: '#2d3436',
    bot: '#00cec9',
    ink: '#dfe6e9',
    mute: '#b2bec3',
    accent: '#fd79a8',
    accent2: '#ffeaa7',
    skin: 'circuit',
    motif: 'din-plug',
    titleStyle: 'mono',
  },
  midi_cc: {
    family: 'emenay',
    title: 'MIDI CC',
    sub: '8× CC → CV',
    top: '#fdcb6e',
    bot: '#e17055',
    ink: '#2d3436',
    mute: '#636e72',
    accent: '#0984e3',
    accent2: '#2d3436',
    skin: 'chevron',
    motif: 'knob-row',
    titleStyle: 'block',
  },
  midi_pads: {
    family: 'emenay',
    title: 'PADS',
    sub: 'note → gates',
    top: '#6c5ce7',
    bot: '#fd79a8',
    ink: '#ffffff',
    mute: '#dfe6e9',
    accent: '#ffeaa7',
    accent2: '#00b894',
    skin: 'pad-tiles',
    motif: 'pad-hands',
    titleStyle: 'stamp',
  },
  bitboy: {
    family: 'emenay',
    title: 'BITBOY',
    sub: '1sw 2pu 3wv 4nz',
    top: '#c6e377',
    bot: '#4a7c23',
    ink: '#1a2f0a',
    mute: '#2d5016',
    accent: '#8b0000',
    accent2: '#ffcc00',
    skin: 'dmg-pixels',
    motif: 'bitboy-face',
    titleStyle: 'pixel',
  },
  delay: {
    family: 'emenay',
    title: 'DELAY',
    sub: 'echo · ping-pong',
    top: '#c0392b',
    bot: '#1a0a00',
    ink: '#fff5e6',
    mute: '#f5c6a0',
    accent: '#f39c12',
    accent2: '#e74c3c',
    skin: 'echo-ripples',
    motif: 'tape-echo',
    titleStyle: 'serif',
  },
  reverb: {
    family: 'emenay',
    title: 'REVERB',
    sub: 'stereo space',
    top: '#74b9ff',
    bot: '#0984e3',
    ink: '#ffffff',
    mute: '#dfe6e9',
    accent: '#ffffff',
    accent2: '#a29bfe',
    skin: 'cloud-wash',
    motif: 'space-orb',
    titleStyle: 'airy',
  },
  stereo: {
    family: 'emenay',
    title: 'STEREO',
    sub: 'pan · width',
    top: '#ffeaa7',
    bot: '#fd79a8',
    ink: '#2d3436',
    mute: '#636e72',
    accent: '#6c5ce7',
    accent2: '#00cec9',
    skin: 'lr-split',
    motif: 'headphones',
    titleStyle: 'round',
  },
  drums: {
    family: 'emenay',
    title: 'DRUMS',
    sub: 'analog kit',
    top: '#000000',
    bot: '#c0392b',
    ink: '#ffffff',
    mute: '#bbbbbb',
    accent: '#f1c40f',
    accent2: '#e74c3c',
    skin: 'hazard',
    motif: 'kick-hit',
    titleStyle: 'block',
  },
  sampler: {
    family: 'emenay',
    title: 'SAMPLER',
    sub: 'record · play',
    top: '#dfe6e9',
    bot: '#636e72',
    ink: '#2d3436',
    mute: '#2d3436',
    accent: '#e17055',
    accent2: '#0984e3',
    skin: 'reel-to-reel',
    motif: 'tape-reels',
    titleStyle: 'mono',
  },
  wasp: {
    family: 'emenay',
    title: 'WASP',
    sub: 'cmos filter',
    top: '#111111',
    bot: '#f1c40f',
    ink: '#111111',
    mute: '#333333',
    accent: '#111111',
    accent2: '#f1c40f',
    skin: 'wasp-stripes',
    motif: 'sting',
    titleStyle: 'block',
  },
  vco: {
    family: 'emenay',
    title: 'VCO',
    sub: 'analog core',
    top: '#fab1a0',
    bot: '#e17055',
    ink: '#2d3436',
    mute: '#636e72',
    accent: '#0984e3',
    accent2: '#2d3436',
    skin: 'sawtooth-field',
    motif: 'osc-eye',
    titleStyle: 'stamp',
  },
  dual_vca: {
    family: 'emenay',
    title: 'DUAL VCA',
    sub: 'lin · exp',
    top: '#55efc4',
    bot: '#00b894',
    ink: '#004d40',
    mute: '#00695c',
    accent: '#fdcb6e',
    accent2: '#2d3436',
    skin: 'amp-bars',
    motif: 'vca-duo',
    titleStyle: 'round',
  },
  vcf: {
    family: 'emenay',
    title: 'VCF',
    sub: 'state variable',
    top: '#a29bfe',
    bot: '#6c5ce7',
    ink: '#ffffff',
    mute: '#dfe6e9',
    accent: '#ffeaa7',
    accent2: '#fd79a8',
    skin: 'filter-slope',
    motif: 'cutoff-curve',
    titleStyle: 'neon',
  },
  noise: {
    family: 'emenay',
    title: 'NOISE',
    sub: 'white · pink · slow',
    top: '#2d3436',
    bot: '#b2bec3',
    ink: '#ffffff',
    mute: '#dfe6e9',
    accent: '#e84393',
    accent2: '#00cec9',
    skin: 'static',
    motif: 'snow',
    titleStyle: 'glitch',
  },
  lfo: {
    family: 'emenay',
    title: 'LFO',
    sub: 'modulation',
    top: '#fd79a8',
    bot: '#e84393',
    ink: '#ffffff',
    mute: '#ffe0ef',
    accent: '#74b9ff',
    accent2: '#ffeaa7',
    skin: 'sine-field',
    motif: 'lfo-orb',
    titleStyle: 'wave',
  },
  divider: {
    family: 'emenay',
    title: 'DIV',
    sub: '÷1 ÷2 ÷4 ÷8',
    top: '#81ecec',
    bot: '#00b894',
    ink: '#004d40',
    mute: '#00695c',
    accent: '#2d3436',
    accent2: '#fdcb6e',
    skin: 'halves',
    motif: 'div-mark',
    titleStyle: 'block',
  },
  clk_mult: {
    family: 'emenay',
    title: '×CLK',
    sub: '×1 ×2 ×4 ×8',
    top: '#ffeaa7',
    bot: '#f39c12',
    ink: '#2d3436',
    mute: '#6c5e00',
    accent: '#e17055',
    accent2: '#2d3436',
    skin: 'rays',
    motif: 'mult-mark',
    titleStyle: 'stamp',
  },
  mult: {
    family: 'emenay',
    title: 'MULT',
    sub: '1→4',
    top: '#dfe6e9',
    bot: '#b2bec3',
    ink: '#2d3436',
    mute: '#636e72',
    accent: '#e17055',
    accent2: '#0984e3',
    skin: 'fork',
    motif: 'mult-tree',
    titleStyle: 'mono',
  },
  sample_hold: {
    family: 'emenay',
    title: 'S&H',
    sub: 'sample · hold',
    top: '#55a3ff',
    bot: '#1e3799',
    ink: '#ffffff',
    mute: '#c8d6e5',
    accent: '#ff9f1a',
    accent2: '#ee5a24',
    skin: 'stairs',
    motif: 'sh-step',
    titleStyle: 'block',
  },
  seq_switch: {
    family: 'emenay',
    title: 'SWITCH',
    sub: 'sequential',
    top: '#f8c291',
    bot: '#e55039',
    ink: '#2d3436',
    mute: '#4a3728',
    accent: '#1e3799',
    accent2: '#2d3436',
    skin: 'rotary',
    motif: 'switch-arm',
    titleStyle: 'stamp',
  },
  cv_switch: {
    family: 'emenay',
    title: 'CV SW',
    sub: 'addressable',
    top: '#7bed9f',
    bot: '#2ed573',
    ink: '#0c3b1e',
    mute: '#1e5c36',
    accent: '#ff6b81',
    accent2: '#2d3436',
    skin: 'address',
    motif: 'switch-arm',
    titleStyle: 'mono',
  },
  ar: {
    family: 'emenay',
    title: 'A/R',
    sub: 'attack · release',
    top: '#ff9ff3',
    bot: '#f368e0',
    ink: '#2d3436',
    mute: '#5a2a52',
    accent: '#48dbfb',
    accent2: '#2d3436',
    skin: 'env-fill',
    motif: 'ar-shape',
    titleStyle: 'round',
  },
  adsr: {
    family: 'emenay',
    title: 'ADSR',
    sub: 'envelope',
    top: '#cd84f1',
    bot: '#7158e2',
    ink: '#ffffff',
    mute: '#e0d4ff',
    accent: '#fffa65',
    accent2: '#ff4d4d',
    skin: 'adsr-shape',
    motif: 'adsr-line',
    titleStyle: 'neon',
  },
  sequencer: {
    family: 'emenay',
    title: 'SEQ 8',
    sub: 'steps · gates',
    top: '#1b9cfc',
    bot: '#182C61',
    ink: '#ffffff',
    mute: '#a5b1c2',
    accent: '#f7b731',
    accent2: '#fc5c65',
    skin: 'seq-dots',
    motif: 'seq-rail',
    titleStyle: 'block',
  },
  sequencer16: {
    family: 'emenay',
    title: 'SEQ 16',
    sub: 'steps · gates',
    top: '#26de81',
    bot: '#0c3b2e',
    ink: '#ffffff',
    mute: '#a8e6cf',
    accent: '#fed330',
    accent2: '#fd9644',
    skin: 'seq-dots',
    motif: 'seq-rail',
    titleStyle: 'block',
  },
  sequencer32: {
    family: 'emenay',
    title: 'SEQ 32',
    sub: 'steps · gates',
    top: '#a55eea',
    bot: '#2c1654',
    ink: '#ffffff',
    mute: '#d6bcfa',
    accent: '#45aaf2',
    accent2: '#fd79a8',
    skin: 'seq-dots',
    motif: 'seq-rail',
    titleStyle: 'block',
  },
  sequencer64: {
    family: 'emenay',
    title: 'SEQ 64',
    sub: 'steps · gates',
    top: '#fc5c65',
    bot: '#4a0e14',
    ink: '#ffffff',
    mute: '#ffb8b8',
    accent: '#fed330',
    accent2: '#45aaf2',
    skin: 'seq-dots',
    motif: 'seq-rail',
    titleStyle: 'block',
  },
}

/** Distinct type per plate (title + control silk). */
const FACE_BY_ID = {
  facets: { face: 'futurist', labelFace: 'soft' },
  lots: { face: 'soft', labelFace: 'grotesk' },
  swell: { face: 'display', labelFace: 'soft' },
  chimes: { face: 'display', labelFace: 'display' },
  twist: { face: 'futurist', labelFace: 'rounded' },
  twin: { face: 'condensed', labelFace: 'condensed' },
  erica_vco3: { face: 'condensed', labelFace: 'condensed' },
  erica_polivoks_vcf: { face: 'condensed', labelFace: 'condensed' },
  erica_modulator: { face: 'condensed', labelFace: 'condensed' },
  erica_bassline: { face: 'condensed', labelFace: 'condensed' },
  erica_bbd: { face: 'condensed', labelFace: 'condensed' },
  erica_swamp: { face: 'condensed', labelFace: 'condensed' },
  erica_output: { face: 'condensed', labelFace: 'condensed' },
  beat: { face: 'impact', labelFace: 'rounded' },
  polysynth: { face: 'rounded', labelFace: 'soft' },
  midi_cv: { face: 'tech', labelFace: 'mono' },
  midi_cc: { face: 'slab', labelFace: 'condensed' },
  midi_pads: { face: 'impact', labelFace: 'grotesk' },
  bitboy: { face: 'mono', labelFace: 'mono' },
  delay: { face: 'display', labelFace: 'soft' },
  reverb: { face: 'display', labelFace: 'display' },
  stereo: { face: 'rounded', labelFace: 'soft' },
  drums: { face: 'impact', labelFace: 'condensed' },
  sampler: { face: 'mono', labelFace: 'tech' },
  wasp: { face: 'impact', labelFace: 'condensed' },
  vco: { face: 'slab', labelFace: 'grotesk' },
  dual_vca: { face: 'soft', labelFace: 'soft' },
  vcf: { face: 'futurist', labelFace: 'rounded' },
  noise: { face: 'tech', labelFace: 'mono' },
  lfo: { face: 'rounded', labelFace: 'soft' },
  divider: { face: 'condensed', labelFace: 'condensed' },
  clk_mult: { face: 'slab', labelFace: 'condensed' },
  mult: { face: 'grotesk', labelFace: 'grotesk' },
  sample_hold: { face: 'tech', labelFace: 'mono' },
  seq_switch: { face: 'slab', labelFace: 'grotesk' },
  cv_switch: { face: 'mono', labelFace: 'tech' },
  ar: { face: 'rounded', labelFace: 'soft' },
  adsr: { face: 'futurist', labelFace: 'rounded' },
  sequencer: { face: 'condensed', labelFace: 'condensed' },
  sequencer16: { face: 'condensed', labelFace: 'condensed' },
  sequencer32: { face: 'futurist', labelFace: 'condensed' },
  sequencer64: { face: 'impact', labelFace: 'condensed' },
}
for (const [id, faces] of Object.entries(FACE_BY_ID)) {
  if (THEMES[id]) Object.assign(THEMES[id], faces)
}

/** Calm the non-MI / non-Erica plates — keep character, drop carnival energy. */
const CALM_TITLE = new Set(['neon', 'glitch', 'wave', 'airy', 'pixel'])
for (const t of Object.values(THEMES)) {
  if (t.family !== 'emenay') continue
  if (CALM_TITLE.has(t.titleStyle)) t.titleStyle = 'stamp'
  t.motif = null
  // Pull loud primaries toward aluminum / muted pedal tones.
  const mutePair = (hex, toward = '#8a8680') => {
    if (typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return hex
    const n = (h) => parseInt(h, 16)
    const mix = (a, b, k) => Math.round(a * (1 - k) + b * k)
    const r = mix(n(hex.slice(1, 3)), n(toward.slice(1, 3)), 0.35)
    const g = mix(n(hex.slice(3, 5)), n(toward.slice(3, 5)), 0.35)
    const b = mix(n(hex.slice(5, 7)), n(toward.slice(5, 7)), 0.35)
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  }
  t.top = mutePair(t.top, '#c8c4bc')
  t.bot = mutePair(t.bot, '#3a3834')
  t.accent = mutePair(t.accent, '#6a6560')
  t.accent2 = mutePair(t.accent2 || t.accent, '#5a5550')
  t.skinOpacity = 0.45
}

const WELL = { sm: 4.4, md: 5.0, lg: 6.2 }

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function faceStack(name) {
  return FACES[name] || FACES.grotesk
}

function titleFace(theme) {
  if (theme.face) return faceStack(theme.face)
  if (theme.family === 'erica') return FONT_ERICA
  if (theme.titleStyle === 'serif' || theme.titleStyle === 'airy') return FACES.display
  if (theme.titleStyle === 'mono' || theme.titleStyle === 'pixel') return FACES.mono
  if (theme.titleStyle === 'neon' || theme.titleStyle === 'glitch') return FACES.impact
  if (theme.family === 'mi') return FACES.futurist
  return FONT_EMENAY
}

function labelFace(theme) {
  if (theme.labelFace) return faceStack(theme.labelFace)
  if (theme.family === 'erica') return FONT_ERICA
  if (theme.face === 'mono' || theme.face === 'tech' || theme.face === 'pixel')
    return FACES.mono
  if (theme.face === 'display' || theme.face === 'slab') return FACES.soft
  return FONT_LABEL
}

/** Halo so silk stays readable on loud pedal art. */
function inkAttrs(theme, weight = 700) {
  const halo = theme.family === 'erica' ? '#f7f7f4' : theme.bot
  return `font-weight="${weight}" fill="${theme.ink}" stroke="${halo}" stroke-width="0.45" paint-order="stroke fill"`
}

function shouldLabel(h, wellCount) {
  if (/^[sg]\d+$/i.test(h.id)) return false
  if (/^mute\d*$/i.test(h.id)) return !!h.label
  if (wellCount > 14 && !h.label) return false
  return true
}

/** Full-panel extravagant backgrounds (guitar-pedal energy). */
function skinSvg(skin, w, theme) {
  const a = theme.accent
  const a2 = theme.accent2 || a
  const m = theme.mute
  const cx = w / 2
  if (!skin) return ''

  switch (skin) {
    case 'mi-vignette':
      // Soft readabilty wash over concept art — keeps the illustration, quietens noise.
      return `<g>
        <rect width="${w}" height="${H}" fill="${theme.bot}" opacity=".28"/>
        <rect x="2" y="26" width="${(w - 4).toFixed(2)}" height="90" rx="2" fill="${theme.bot}" opacity=".42"/>
        <rect x="0" y="0" width="${w}" height="18" fill="${theme.top}" opacity=".55"/>
      </g>`
    case 'crystal-field': {
      let g = `<g opacity=".55">`
      for (let i = 0; i < 18; i++) {
        const x = 4 + (i % 5) * (w / 4.5)
        const y = 28 + Math.floor(i / 5) * 22
        const s = 4 + (i % 4) * 2.2
        g += `<polygon points="${x},${y - s} ${x + s * 0.85},${y} ${x},${y + s} ${x - s * 0.85},${y}" fill="${i % 2 ? a : a2}" fill-opacity=".22" stroke="${a}" stroke-width=".2"/>`
      }
      return g + `</g>`
    }
    case 'marble-bag': {
      let g = `<g opacity=".5">`
      const balls = [
        [0.15, 0.25, 8],
        [0.7, 0.2, 6],
        [0.4, 0.45, 10],
        [0.85, 0.55, 7],
        [0.2, 0.7, 9],
        [0.55, 0.75, 5],
        [0.75, 0.85, 8],
        [0.35, 0.9, 4],
      ]
      for (const [fx, fy, r] of balls) {
        const x = fx * w
        const y = fy * H
        g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${a}" fill-opacity=".2"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="none" stroke="${a2}" stroke-width=".5" opacity=".5"/><circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.3).toFixed(1)}" r="${(r * 0.25).toFixed(1)}" fill="#fff" opacity=".35"/>`
      }
      return g + `</g>`
    }
    case 'tide-bands': {
      let g = `<g fill="none" stroke="${a}" stroke-width="1.1" opacity=".35">`
      for (let i = 0; i < 14; i++) {
        const y = 20 + i * 7.5
        const amp = 4 + (i % 3)
        g += `<path d="M0 ${y} Q${cx * 0.5} ${y - amp} ${cx} ${y + (i % 2 ? amp : -amp)} T${w} ${y}"/>`
      }
      return g + `</g>`
    }
    case 'bell-rings': {
      let g = `<g fill="none" stroke="${a}" stroke-width=".6" opacity=".3">`
      for (let i = 0; i < 8; i++) {
        g += `<circle cx="${cx.toFixed(1)}" cy="${(40 + i * 10).toFixed(1)}" r="${(8 + i * 4).toFixed(1)}"/>`
      }
      return g + `</g>`
    }
    case 'helix': {
      let g = `<g fill="none" stroke-width="1.2" opacity=".4">`
      for (let i = 0; i < 3; i++) {
        const col = i === 1 ? a2 : a
        g += `<path d="M${4 + i * 2} 20 C${cx} ${30 + i * 8}, ${cx} ${90 - i * 8}, ${w - 4 - i * 2} 110" stroke="${col}"/>`
      }
      return g + `</g>`
    }
    case 'split-peaks':
      return `<g opacity=".4">
        <path d="M0 128.5 L0 70 L${(cx - 2).toFixed(1)} 35 L${cx.toFixed(1)} 55 L${(cx + 2).toFixed(1)} 30 L${w} 65 L${w} 128.5 Z" fill="${a}" fill-opacity=".25"/>
        <path d="M0 128.5 L${(cx - 2).toFixed(1)} 80 L${cx.toFixed(1)} 95 L${(cx + 2).toFixed(1)} 75 L${w} 128.5 Z" fill="${a2}" fill-opacity=".3"/>
      </g>`
    case 'erica-ornament':
      return `<g fill="none" stroke="${theme.ink}" stroke-width=".35" opacity=".55">
        <rect x="2.5" y="2.5" width="${(w - 5).toFixed(2)}" height="123.5" rx="1.2"/>
        <rect x="4.5" y="4.5" width="${(w - 9).toFixed(2)}" height="119.5"/>
        <path d="M8 14 H${(w - 8).toFixed(1)} M8 114 H${(w - 8).toFixed(1)}"/>
        <circle cx="8" cy="14" r="1.2"/><circle cx="${(w - 8).toFixed(1)}" cy="14" r="1.2"/>
        <circle cx="8" cy="114" r="1.2"/><circle cx="${(w - 8).toFixed(1)}" cy="114" r="1.2"/>
      </g>`
    case 'step-grid': {
      let g = `<g opacity=".35">`
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 4; col++) {
          const on = (row + col) % 3 !== 0
          g += `<rect x="${(4 + col * ((w - 8) / 4)).toFixed(2)}" y="${(22 + row * 10).toFixed(1)}" width="${((w - 12) / 4).toFixed(2)}" height="7" rx=".4" fill="${on ? a : a2}" fill-opacity="${on ? '.35' : '.15'}"/>`
        }
      }
      return g + `</g>`
    }
    case 'soft-blobs':
      return `<g opacity=".35">
        <ellipse cx="${(cx * 0.5).toFixed(1)}" cy="50" rx="14" ry="22" fill="${a}"/>
        <ellipse cx="${(cx * 1.4).toFixed(1)}" cy="80" rx="16" ry="28" fill="${a2}"/>
        <ellipse cx="${cx.toFixed(1)}" cy="110" rx="20" ry="12" fill="${a}" fill-opacity=".5"/>
      </g>`
    case 'circuit': {
      let g = `<g fill="none" stroke="${a}" stroke-width=".45" opacity=".4">`
      for (let i = 0; i < 8; i++) {
        const y = 25 + i * 12
        g += `<path d="M2 ${y} H${(w * 0.35).toFixed(1)} V${y + 6} H${(w * 0.65).toFixed(1)} V${y} H${(w - 2).toFixed(1)}"/>`
      }
      return g + `</g>`
    }
    case 'chevron': {
      let g = `<g fill="none" stroke="${a}" stroke-width="2.2" opacity=".25">`
      for (let i = 0; i < 12; i++) {
        const y = 18 + i * 9
        g += `<path d="M0 ${y} L${cx.toFixed(1)} ${y + 5} L${w} ${y}"/>`
      }
      return g + `</g>`
    }
    case 'pad-tiles': {
      let g = `<g opacity=".4">`
      for (let i = 0; i < 8; i++) {
        const x = 3 + (i % 2) * (w / 2 - 2)
        const y = 24 + Math.floor(i / 2) * 24
        g += `<rect x="${x.toFixed(1)}" y="${y}" width="${(w / 2 - 5).toFixed(1)}" height="20" rx="2.5" fill="${i % 2 ? a : a2}" fill-opacity=".3" stroke="${a}" stroke-width=".4"/>`
      }
      return g + `</g>`
    }
    case 'dmg-pixels': {
      let g = `<g opacity=".4">`
      for (let i = 0; i < 80; i++) {
        const x = 2 + (i % 8) * (w / 8)
        const y = 20 + Math.floor(i / 8) * 10
        if ((i * 7) % 5 < 2) g += `<rect x="${x.toFixed(1)}" y="${y}" width="${(w / 8 - 1).toFixed(1)}" height="8" fill="${(i * 3) % 2 ? a : a2}"/>`
      }
      return g + `</g>`
    }
    case 'echo-ripples': {
      let g = `<g fill="none" stroke="${a}" stroke-width=".7" opacity=".35">`
      for (let i = 0; i < 10; i++) {
        g += `<ellipse cx="${cx.toFixed(1)}" cy="64" rx="${(6 + i * 5).toFixed(1)}" ry="${(10 + i * 7).toFixed(1)}"/>`
      }
      return g + `</g>`
    }
    case 'cloud-wash':
      return `<g opacity=".3" fill="${a}">
        <ellipse cx="${(cx * 0.6).toFixed(1)}" cy="40" rx="18" ry="10"/>
        <ellipse cx="${(cx * 1.2).toFixed(1)}" cy="55" rx="22" ry="12"/>
        <ellipse cx="${cx.toFixed(1)}" cy="90" rx="26" ry="14"/>
        <ellipse cx="${(cx * 0.7).toFixed(1)}" cy="110" rx="16" ry="9"/>
      </g>`
    case 'lr-split':
      return `<g opacity=".35">
        <rect x="0" y="0" width="${(cx).toFixed(2)}" height="${H}" fill="${a}" fill-opacity=".2"/>
        <rect x="${cx.toFixed(2)}" y="0" width="${(w - cx).toFixed(2)}" height="${H}" fill="${a2}" fill-opacity=".25"/>
        <line x1="${cx.toFixed(2)}" y1="16" x2="${cx.toFixed(2)}" y2="120" stroke="${theme.ink}" stroke-width=".4" stroke-dasharray="2 2"/>
      </g>`
    case 'hazard': {
      let g = `<g opacity=".35">`
      for (let i = -4; i < 20; i++) {
        g += `<path d="M${(i * 10).toFixed(1)} 0 L${(i * 10 + 40).toFixed(1)} ${H} L${(i * 10 + 28).toFixed(1)} ${H} L${(i * 10 - 12).toFixed(1)} 0 Z" fill="${i % 2 ? a : '#111'}"/>`
      }
      return g + `</g>`
    }
    case 'reel-to-reel':
      return `<g fill="none" stroke="${a}" stroke-width="1" opacity=".35">
        <circle cx="${(cx - 8).toFixed(1)}" cy="55" r="16"/><circle cx="${(cx + 8).toFixed(1)}" cy="90" r="16"/>
        <circle cx="${(cx - 8).toFixed(1)}" cy="55" r="4"/><circle cx="${(cx + 8).toFixed(1)}" cy="90" r="4"/>
        <path d="M${(cx - 8).toFixed(1)} 71 C${cx.toFixed(1)} 75, ${cx.toFixed(1)} 80, ${(cx + 8).toFixed(1)} 74"/>
      </g>`
    case 'wasp-stripes': {
      let g = `<g opacity=".55">`
      for (let i = 0; i < 22; i++) {
        g += `<rect x="0" y="${(i * 6).toFixed(1)}" width="${w}" height="3.2" fill="${i % 2 ? a : a2}"/>`
      }
      return g + `</g>`
    }
    case 'sawtooth-field': {
      let g = `<g fill="none" stroke="${a}" stroke-width=".8" opacity=".35">`
      for (let row = 0; row < 8; row++) {
        const y = 25 + row * 12
        let d = `M0 ${y + 6}`
        for (let i = 0; i < 6; i++) d += ` L${((i + 0.5) * w) / 6} ${y} L${((i + 1) * w) / 6} ${y + 6}`
        g += `<path d="${d}"/>`
      }
      return g + `</g>`
    }
    case 'amp-bars': {
      let g = `<g opacity=".35" fill="${a}">`
      for (let i = 0; i < 12; i++) {
        const h = 8 + ((i * 5) % 40)
        g += `<rect x="${(3 + i * ((w - 6) / 12)).toFixed(2)}" y="${(110 - h).toFixed(1)}" width="${((w - 6) / 12 - 1).toFixed(2)}" height="${h}"/>`
      }
      return g + `</g>`
    }
    case 'filter-slope':
      return `<g opacity=".35">
        <path d="M0 100 L${(w * 0.35).toFixed(1)} 30 H${(w * 0.55).toFixed(1)} L${w} 100 Z" fill="${a}" fill-opacity=".3"/>
        <path d="M0 100 L${(w * 0.35).toFixed(1)} 30 H${(w * 0.55).toFixed(1)} L${w} 100" fill="none" stroke="${a2}" stroke-width="1.2"/>
      </g>`
    case 'static': {
      let g = `<g opacity=".45" fill="${a}">`
      for (let i = 0; i < 120; i++) {
        const x = (i * 17) % w
        const y = 18 + ((i * 31) % 100)
        const h = 1 + (i % 5)
        g += `<rect x="${x.toFixed(1)}" y="${y}" width="1.2" height="${h}" fill="${i % 3 ? a : a2}"/>`
      }
      return g + `</g>`
    }
    case 'sine-field': {
      let g = `<g fill="none" stroke="${a}" stroke-width=".9" opacity=".35">`
      for (let i = 0; i < 8; i++) {
        const y = 28 + i * 12
        g += `<path d="M0 ${y} Q${cx * 0.5} ${y - 8} ${cx} ${y} T${w} ${y}"/>`
      }
      return g + `</g>`
    }
    case 'halves':
      return `<g opacity=".3" fill="${a}">
        <rect x="0" y="20" width="${w}" height="20"/>
        <rect x="0" y="50" width="${(w / 2).toFixed(1)}" height="20"/>
        <rect x="0" y="80" width="${(w / 4).toFixed(1)}" height="20"/>
        <rect x="0" y="105" width="${(w / 8).toFixed(1)}" height="14"/>
      </g>`
    case 'rays': {
      let g = `<g opacity=".3" stroke="${a}" stroke-width="1.4">`
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2
        const x2 = cx + Math.cos(ang) * 80
        const y2 = 64 + Math.sin(ang) * 80
        g += `<line x1="${cx.toFixed(1)}" y1="64" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
      }
      return g + `</g>`
    }
    case 'fork':
      return `<g fill="none" stroke="${a}" stroke-width="1.1" opacity=".4">
        <path d="M${cx.toFixed(1)} 20 V50"/>
        <path d="M${cx.toFixed(1)} 50 L${(cx - w * 0.3).toFixed(1)} 90 M${cx.toFixed(1)} 50 L${(cx + w * 0.3).toFixed(1)} 90"/>
        <path d="M${(cx - w * 0.3).toFixed(1)} 90 V115 M${(cx + w * 0.3).toFixed(1)} 90 V115"/>
      </g>`
    case 'stairs': {
      let g = `<g fill="${a}" opacity=".3">`
      for (let i = 0; i < 8; i++) {
        g += `<rect x="${(4 + i * ((w - 8) / 8)).toFixed(2)}" y="${(30 + i * 10).toFixed(1)}" width="${((w - 8) / 8 + 2).toFixed(2)}" height="${(90 - i * 10).toFixed(1)}"/>`
      }
      return g + `</g>`
    }
    case 'rotary':
      return `<g fill="none" stroke="${a}" stroke-width="1" opacity=".35">
        <circle cx="${cx.toFixed(1)}" cy="64" r="28"/>
        <circle cx="${cx.toFixed(1)}" cy="64" r="18"/>
        <path d="M${cx.toFixed(1)} 64 L${(cx + 22).toFixed(1)} 48"/>
        ${[0, 1, 2, 3]
          .map((i) => {
            const ang = -0.8 + i * 0.55
            const x = cx + Math.cos(ang) * 34
            const y = 64 + Math.sin(ang) * 34
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${a2}" stroke="none" opacity=".6"/>`
          })
          .join('')}
      </g>`
    case 'address': {
      let g = `<g opacity=".35">`
      for (let i = 0; i < 8; i++) {
        g += `<text x="3" y="${(30 + i * 11).toFixed(1)}" font-family='monospace' font-size="3.5" fill="${a}">${i.toString(2).padStart(3, '0')}</text>`
      }
      return g + `</g>`
    }
    case 'env-fill':
      return `<path d="M4 100 L20 35 L40 45 L70 100 Z" fill="${a}" fill-opacity=".3" stroke="${a2}" stroke-width="1"/>`
    case 'adsr-shape':
      return `<path d="M4 105 L18 30 L32 50 L55 50 L75 105" fill="${a}" fill-opacity=".25" stroke="${a2}" stroke-width="1.3"/>`
    case 'seq-dots': {
      // Quiet header rail only — dense step grids fought the real controls.
      let g = `<g opacity=".28">`
      const cols = Math.max(4, Math.floor(w / 9))
      for (let c = 0; c < cols; c++) {
        g += `<circle cx="${(6 + c * ((w - 12) / cols)).toFixed(1)}" cy="17" r="1.6" fill="${c % 4 === 0 ? a2 : a}" fill-opacity=".55"/>`
      }
      return g + `</g>`
    }
    default:
      return ''
  }
}

/** Corner / header figurative art on top of skin. */
function motifSvg(kind, w, theme) {
  const a = theme.accent
  const a2 = theme.accent2 || a
  const cx = w / 2
  if (!kind) return ''

  switch (kind) {
    case 'facets-xl':
      return `<g opacity=".7" stroke="${a}" stroke-width=".35">
        <polygon points="${cx},16 ${cx + 12},28 ${cx + 4},40 ${cx - 8},36 ${cx - 12},24" fill="${a2}" fill-opacity=".35"/>
        <polygon points="${cx + 8},20 ${w - 4},26 ${w - 8},38 ${cx + 14},34" fill="${a}" fill-opacity=".3"/>
      </g>`
    case 'lots-xl':
      return `<g opacity=".65">${[
        [cx - 10, 22, 5],
        [cx + 2, 20, 3.5],
        [cx + 12, 24, 4],
      ]
        .map(
          ([x, y, r]) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="${a}" fill-opacity=".4"/><circle cx="${x - 1.2}" cy="${y - 1.2}" r="${r * 0.3}" fill="#fff" opacity=".5"/>`,
        )
        .join('')}</g>`
    case 'swell-xl':
      return `<g fill="none" stroke="${a}" stroke-width="1.1" opacity=".65">
        <path d="M2 20 Q${cx} 10 ${w - 2} 20"/>
        <path d="M2 24 Q${cx} 32 ${w - 2} 24"/>
      </g>`
    case 'chimes-xl':
      return `<g fill="none" stroke="${a}" stroke-width=".8" opacity=".6">
        <circle cx="${cx}" cy="22" r="4"/><circle cx="${cx}" cy="22" r="7"/><circle cx="${cx}" cy="22" r="10"/>
      </g>`
    case 'twist-xl':
      return `<g fill="none" stroke-width="1.3" opacity=".65">
        <path d="M4 16 C${cx} 8, ${cx} 32, ${w - 4} 18" stroke="${a}"/>
        <path d="M4 24 C${cx} 34, ${cx} 10, ${w - 4} 26" stroke="${a2}"/>
      </g>`
    case 'twin-xl':
      return `<g fill="${a}" opacity=".55">
        <path d="M4 28 L${(cx - 3).toFixed(1)} 14 L${cx.toFixed(1)} 22 L${(cx + 3).toFixed(1)} 12 L${w - 4} 28 Z"/>
      </g>`
    case 'erica-wave':
      return `<path d="M8 20 C16 12, 24 28, 32 20 S48 12, ${Math.min(w - 8, 70).toFixed(1)} 20" fill="none" stroke="${theme.ink}" stroke-width="1"/>`
    case 'erica-filter':
      return `<path d="M10 26 L${(w * 0.35).toFixed(1)} 14 H${(w * 0.55).toFixed(1)} L${(w - 10).toFixed(1)} 26" fill="none" stroke="${theme.ink}" stroke-width="1"/>`
    case 'erica-mod':
      return `<path d="M8 20 Q16 10 24 20 T40 20 T${Math.min(w - 8, 70).toFixed(1)} 20" fill="none" stroke="${theme.ink}" stroke-width="1"/>`
    case 'erica-bass':
      return `<g fill="${theme.ink}">${[0, 1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<rect x="${8 + i * 5}" y="${12 + ((i * 3) % 8)}" width="3.2" height="${10 - ((i * 3) % 8)}"/>`,
        )
        .join('')}</g>`
    case 'erica-bbd':
      return `<g fill="none" stroke="${theme.ink}" stroke-width=".8">${[0, 1, 2, 3, 4, 5, 6]
        .map((i) => `<circle cx="${(10 + i * 7).toFixed(1)}" cy="20" r="2.6"/>`)
        .join('')}</g>`
    case 'erica-swamp':
      return `<g fill="none" stroke="${theme.ink}" stroke-width=".9"><path d="M6 18 Q${cx} 10 ${w - 6} 18"/><path d="M8 23 Q${cx} 30 ${w - 8} 23"/></g>`
    case 'erica-out':
      // Stereo meters + line-out silhouette
      return `<g fill="none" stroke="${theme.ink}" stroke-width=".7" opacity=".7">
        <rect x="${(cx - 10).toFixed(1)}" y="16" width="3" height="10"/>
        <rect x="${(cx - 5).toFixed(1)}" y="18" width="3" height="8"/>
        <rect x="${(cx).toFixed(1)}" y="20" width="3" height="6"/>
        <rect x="${(cx + 5).toFixed(1)}" y="17" width="3" height="9"/>
        <circle cx="${(cx - 6).toFixed(1)}" cy="30" r="2.2"/><circle cx="${(cx + 6).toFixed(1)}" cy="30" r="2.2"/>
      </g>`
    case 'beat-boom':
      return `<text x="${cx.toFixed(1)}" y="26" text-anchor="middle" font-family='Impact, "Arial Black", sans-serif' font-size="7" fill="${a2}" opacity=".55">★</text>`
    case 'poly-keys':
      return `<g opacity=".5">${[0, 1, 2, 3]
        .map(
          (i) =>
            `<rect x="${(cx - 14 + i * 7).toFixed(1)}" y="16" width="5.5" height="10" rx=".5" fill="${i % 2 ? a : '#fff'}" stroke="${theme.ink}" stroke-width=".3"/>`,
        )
        .join('')}</g>`
    case 'din-plug':
      return `<g fill="none" stroke="${a}" stroke-width=".8" opacity=".6">
        <circle cx="${cx.toFixed(1)}" cy="22" r="7"/><circle cx="${(cx - 2.5).toFixed(1)}" cy="21" r="1.1" fill="${a}"/><circle cx="${(cx + 2.5).toFixed(1)}" cy="21" r="1.1" fill="${a}"/><circle cx="${cx.toFixed(1)}" cy="24.5" r="1.1" fill="${a}"/>
      </g>`
    case 'knob-row':
      return `<g opacity=".5">${[0, 1, 2]
        .map(
          (i) =>
            `<circle cx="${(cx - 10 + i * 10).toFixed(1)}" cy="21" r="3.5" fill="none" stroke="${a}" stroke-width=".7"/><line x1="${(cx - 10 + i * 10).toFixed(1)}" y1="${21 - 2.5}" x2="${(cx - 10 + i * 10).toFixed(1)}" y2="${21 - 0.5}" stroke="${a2}" stroke-width=".8"/>`,
        )
        .join('')}</g>`
    case 'pad-hands':
      return `<g opacity=".45" fill="${a}"><rect x="${(cx - 12).toFixed(1)}" y="16" width="10" height="10" rx="1.5"/><rect x="${(cx + 2).toFixed(1)}" y="16" width="10" height="10" rx="1.5"/></g>`
    case 'bitboy-face':
      return `<g opacity=".55">
        <rect x="${(cx - 10).toFixed(1)}" y="15" width="20" height="14" rx="2" fill="${a2}" stroke="${theme.ink}" stroke-width=".4"/>
        <rect x="${(cx - 7).toFixed(1)}" y="18" width="5" height="5" fill="${theme.ink}"/><rect x="${(cx + 2).toFixed(1)}" y="18" width="5" height="5" fill="${theme.ink}"/>
        <rect x="${(cx - 4).toFixed(1)}" y="25" width="8" height="2" fill="${theme.ink}"/>
      </g>`
    case 'tape-echo':
      return `<g fill="none" stroke="${a}" stroke-width=".9" opacity=".6">
        <circle cx="${(cx - 8).toFixed(1)}" cy="22" r="6"/><circle cx="${(cx + 8).toFixed(1)}" cy="22" r="6"/>
        <path d="M${(cx - 2).toFixed(1)} 22 H${(cx + 2).toFixed(1)}"/>
      </g>`
    case 'space-orb':
      return `<g fill="none" stroke="${a}" stroke-width=".7" opacity=".55">
        <circle cx="${cx.toFixed(1)}" cy="22" r="5"/><circle cx="${cx.toFixed(1)}" cy="22" r="8"/><ellipse cx="${cx.toFixed(1)}" cy="22" rx="11" ry="3.5"/>
      </g>`
    case 'headphones':
      return `<g fill="none" stroke="${a}" stroke-width="1" opacity=".55">
        <path d="M${(cx - 9).toFixed(1)} 24 A9 9 0 0 1 ${(cx + 9).toFixed(1)} 24"/>
        <rect x="${(cx - 11).toFixed(1)}" y="22" width="4" height="7" rx="1" fill="${a2}" stroke="none" opacity=".7"/>
        <rect x="${(cx + 7).toFixed(1)}" y="22" width="4" height="7" rx="1" fill="${a2}" stroke="none" opacity=".7"/>
      </g>`
    case 'kick-hit':
      return `<g opacity=".55">
        <circle cx="${cx.toFixed(1)}" cy="22" r="8" fill="none" stroke="${a}" stroke-width="1.2"/>
        <circle cx="${cx.toFixed(1)}" cy="22" r="3" fill="${a2}"/>
      </g>`
    case 'tape-reels':
      return `<g fill="none" stroke="${a}" stroke-width=".9" opacity=".55">
        <circle cx="${(cx - 7).toFixed(1)}" cy="22" r="7"/><circle cx="${(cx + 7).toFixed(1)}" cy="22" r="7"/>
        <circle cx="${(cx - 7).toFixed(1)}" cy="22" r="2" fill="${a2}" stroke="none"/><circle cx="${(cx + 7).toFixed(1)}" cy="22" r="2" fill="${a2}" stroke="none"/>
      </g>`
    case 'sting':
      return `<polygon points="${cx},14 ${cx + 6},26 ${cx},24 ${cx - 6},26" fill="${theme.ink}" opacity=".5"/>`
    case 'osc-eye':
      return `<g opacity=".55">
        <ellipse cx="${cx.toFixed(1)}" cy="22" rx="12" ry="7" fill="none" stroke="${a}" stroke-width=".9"/>
        <circle cx="${cx.toFixed(1)}" cy="22" r="3.5" fill="${a2}"/>
      </g>`
    case 'vca-duo':
      return `<g fill="none" stroke="${a}" stroke-width=".9" opacity=".55">
        <path d="M${(cx - 12).toFixed(1)} 16 L${(cx - 4).toFixed(1)} 22 L${(cx - 12).toFixed(1)} 28 Z"/>
        <path d="M${(cx + 12).toFixed(1)} 16 L${(cx + 4).toFixed(1)} 22 L${(cx + 12).toFixed(1)} 28 Z"/>
      </g>`
    case 'cutoff-curve':
      return `<path d="M6 28 L${(w * 0.4).toFixed(1)} 14 H${(w * 0.6).toFixed(1)} L${(w - 6).toFixed(1)} 28" fill="none" stroke="${a}" stroke-width="1.1" opacity=".6"/>`
    case 'snow':
      return `<g opacity=".5" fill="${a}">${[0, 1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<circle cx="${(6 + i * ((w - 12) / 5)).toFixed(1)}" cy="${18 + (i % 3) * 3}" r="1.2"/>`,
        )
        .join('')}</g>`
    case 'lfo-orb':
      return `<circle cx="${cx.toFixed(1)}" cy="22" r="7" fill="${a}" fill-opacity=".35" stroke="${a2}" stroke-width=".8"/>`
    case 'div-mark':
      return `<text x="${cx.toFixed(1)}" y="26" text-anchor="middle" font-family='${FONT_EMENAY}' font-size="8" font-weight="900" fill="${a}" opacity=".45">÷</text>`
    case 'mult-mark':
      return `<text x="${cx.toFixed(1)}" y="26" text-anchor="middle" font-family='${FONT_EMENAY}' font-size="8" font-weight="900" fill="${a}" opacity=".45">×</text>`
    case 'mult-tree':
      return `<g fill="none" stroke="${a}" stroke-width=".9" opacity=".55"><path d="M${cx.toFixed(1)} 14 V22 M${cx.toFixed(1)} 22 L${(cx - 8).toFixed(1)} 28 M${cx.toFixed(1)} 22 L${(cx + 8).toFixed(1)} 28"/></g>`
    case 'sh-step':
      return `<path d="M6 28 V18 H${(cx).toFixed(1)} V28 H${(w - 6).toFixed(1)}" fill="none" stroke="${a}" stroke-width="1.1" opacity=".55"/>`
    case 'switch-arm':
      return `<g fill="none" stroke="${a}" stroke-width="1" opacity=".55">
        <circle cx="${(cx - 8).toFixed(1)}" cy="22" r="2.5"/><circle cx="${(cx + 8).toFixed(1)}" cy="22" r="2.5"/>
        <path d="M${(cx - 6).toFixed(1)} 22 L${(cx + 6).toFixed(1)} 18"/>
      </g>`
    case 'ar-shape':
      return `<path d="M6 28 L16 14 L28 28" fill="none" stroke="${a}" stroke-width="1.2" opacity=".55"/>`
    case 'adsr-line':
      return `<path d="M4 28 L12 14 L18 18 L28 18 L36 28" fill="none" stroke="${a}" stroke-width="1.2" opacity=".55"/>`
    case 'seq-rail':
      return `<g opacity=".5">${[0, 1, 2, 3, 4, 5, 6, 7]
        .map(
          (i) =>
            `<rect x="${(4 + i * ((w - 8) / 8)).toFixed(2)}" y="17" width="${((w - 8) / 8 - 1).toFixed(2)}" height="8" rx=".3" fill="${i % 2 ? a : a2}"/>`,
        )
        .join('')}</g>`
    default:
      return ''
  }
}

function titleBlock(theme, w) {
  const font = titleFace(theme)
  const style = theme.titleStyle || 'block'
  // mm units — big enough to read on a ~220–400px-tall module face
  const size = w < 22 ? 3.4 : w < 35 ? 4.0 : w < 55 ? 4.4 : 4.8
  const subSize = w < 22 ? 1.55 : 1.85
  const cx = (w / 2).toFixed(2)
  const tracking =
    theme.family === 'erica'
      ? 1.0
      : style === 'neon'
        ? 0.55
        : style === 'pixel'
          ? 0.15
          : 0.35
  const subY = style === 'badge' ? 17.2 : 13.6

  if (theme.family === 'erica') {
    return `
      <text x="${cx}" y="10" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="700" letter-spacing="${tracking}" fill="none" stroke="${theme.ink}" stroke-width="0.35">${esc(theme.title)}</text>
      <text x="${cx}" y="10" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="700" letter-spacing="${tracking}" fill="${theme.ink}">${esc(theme.title)}</text>
      <text x="${cx}" y="14.2" text-anchor="middle" font-family='${font}' font-size="${subSize}" font-weight="700" letter-spacing="1.4" fill="${theme.mute}">${esc(theme.sub)}</text>`
  }

  if (style === 'badge') {
    const bw = Math.min(w - 4, theme.title.length * 3.1 + 10)
    return `
      <rect x="${(w / 2 - bw / 2).toFixed(2)}" y="3.8" width="${bw.toFixed(2)}" height="11.2" rx="1.8" fill="${theme.accent}" opacity=".92"/>
      <text x="${cx}" y="12" text-anchor="middle" font-family='${font}' font-size="${(size * 0.92).toFixed(2)}" font-weight="900" letter-spacing="${tracking}" fill="${theme.ink}">${esc(theme.title)}</text>
      <text x="${cx}" y="${subY}" text-anchor="middle" font-family='${font}' font-size="${subSize}" font-weight="600" fill="${theme.mute}">${esc(theme.sub)}</text>`
  }
  if (style === 'neon') {
    return `
      <text x="${cx}" y="10.4" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="900" letter-spacing="${tracking}" fill="${theme.accent}" opacity=".5">${esc(theme.title)}</text>
      <text x="${cx}" y="10" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="900" letter-spacing="${tracking}" fill="${theme.ink}" stroke="${theme.bot}" stroke-width="0.5" paint-order="stroke fill">${esc(theme.title)}</text>
      <text x="${cx}" y="${subY}" text-anchor="middle" font-family='${font}' font-size="${subSize}" font-weight="600" fill="${theme.mute}">${esc(theme.sub)}</text>`
  }
  if (style === 'split') {
    const mid = Math.ceil(theme.title.length / 2)
    return `
      <text x="${(w * 0.3).toFixed(2)}" y="10.2" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="900" fill="${theme.accent}" stroke="${theme.bot}" stroke-width="0.45" paint-order="stroke fill">${esc(theme.title.slice(0, mid))}</text>
      <text x="${(w * 0.7).toFixed(2)}" y="10.2" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="900" fill="${theme.accent2}" stroke="${theme.bot}" stroke-width="0.45" paint-order="stroke fill">${esc(theme.title.slice(mid))}</text>
      <text x="${cx}" y="${subY}" text-anchor="middle" font-family='${font}' font-size="${subSize}" font-weight="600" fill="${theme.mute}">${esc(theme.sub)}</text>`
  }
  if (style === 'skew') {
    return `
      <text x="${cx}" y="10" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="900" letter-spacing="0.7" fill="${theme.ink}" stroke="${theme.bot}" stroke-width="0.45" paint-order="stroke fill" transform="skewX(-8) translate(${(w * 0.04).toFixed(1)},0)">${esc(theme.title)}</text>
      <text x="${cx}" y="${subY}" text-anchor="middle" font-family='${font}' font-size="${subSize}" font-weight="600" fill="${theme.mute}">${esc(theme.sub)}</text>`
  }
  if (style === 'glitch') {
    return `
      <text x="${(w / 2 - 0.5).toFixed(2)}" y="9.8" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="900" fill="${theme.accent}" opacity=".75">${esc(theme.title)}</text>
      <text x="${(w / 2 + 0.5).toFixed(2)}" y="10.3" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="900" fill="${theme.accent2}" opacity=".75">${esc(theme.title)}</text>
      <text x="${cx}" y="10" text-anchor="middle" font-family='${font}' font-size="${size}" font-weight="900" fill="${theme.ink}">${esc(theme.title)}</text>
      <text x="${cx}" y="${subY}" text-anchor="middle" font-family='${font}' font-size="${subSize}" font-weight="600" fill="${theme.mute}">${esc(theme.sub)}</text>`
  }

  return `
    <text x="${cx}" y="10" text-anchor="middle" font-family='${font}' font-size="${size}" letter-spacing="${tracking}" ${inkAttrs(theme, 900)}>${esc(theme.title)}</text>
    <text x="${cx}" y="${subY}" text-anchor="middle" font-family='${font}' font-size="${subSize}" font-weight="600" fill="${theme.mute}">${esc(theme.sub)}</text>`
}

function renderPlate(typeId, theme) {
  const art = PANEL_ART[typeId]
  const layout = PANEL_LAYOUTS[typeId]
  if (!art || !layout) throw new Error(`missing art/layout for ${typeId}`)
  const w = (art.hp ?? 8) * HP_MM
  const uid = typeId.replace(/[^a-z0-9]/g, '')
  const erica = theme.family === 'erica'

  const screwX = +Math.min(7.5, w * 0.12).toFixed(2)
  const screws = [
    [screwX, 3],
    [+(w - screwX).toFixed(2), 3],
    [screwX, H - 3],
    [+(w - screwX).toFixed(2), H - 3],
  ]

  const wells = []
  const seenParam = new Set()
  for (const h of layout.hits) {
    if (h.kind !== 'param' && h.kind !== 'toggle') continue
    const key = `${h.kind}:${h.id}:${h.x}:${h.y}`
    if (seenParam.has(key)) continue
    seenParam.add(key)
    wells.push(h)
  }
  const jacks = layout.hits.filter((h) => h.kind === 'in' || h.kind === 'out')
  const leds = layout.hits.filter((h) => h.kind === 'led')
  const digits = layout.hits.filter((h) => h.kind === 'digit')

  const jackLight = erica ? '#6a6a66' : '#c8c4b8'
  const jackDark = erica ? '#1a1a1a' : '#2a2820'

  let body = ''
  body += `<rect width="${w}" height="${H}" fill="url(#${uid}alu)"/>\n`
  if (theme.bgImage) {
    const op = theme.bgOpacity ?? 0.7
    // Embed locally — <img src="plate.svg"> cannot fetch external hrefs.
    const href = embedLocalImage(theme.bgImage)
    body += `<image href="${href}" x="0" y="0" width="${w}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity="${op}"/>\n`
  }
  {
    const skin = skinSvg(theme.skin, w, theme)
    const op = theme.skinOpacity
    body +=
      skin && op != null && op < 1
        ? `<g opacity="${op}">${skin}</g>\n`
        : skin + '\n'
  }
  body += motifSvg(theme.motif, w, theme) + '\n'

  // Soft scrim behind controls (skip MI — vignette skin already handles it)
  if (!erica && theme.family !== 'mi') {
    body += `<rect x="1.5" y="28" width="${(w - 3).toFixed(2)}" height="88" rx="2" fill="${theme.bot}" opacity=".22"/>\n`
  }

  for (const [sx, sy] of screws) {
    body += `<circle cx="${sx}" cy="${sy}" r="1.55" fill="#1a1a1c"/><circle cx="${sx}" cy="${sy}" r=".55" fill="${erica ? '#888' : '#555'}"/>\n`
  }
  body += titleBlock(theme, w)

  for (const h of wells) {
    const cx = (h.x / 100) * w
    const cy = (h.y / 100) * H
    const r = WELL[h.size ?? 'md'] ?? WELL.md
    if (h.kind === 'toggle') {
      // Gate / mute pads — small rings, not full knob wells (avoids looking like overlap).
      if (h.shape === 'rect') {
        const rw = r * 1.35
        const rh = r * 0.85
        body += `<rect x="${(cx - rw).toFixed(2)}" y="${(cy - rh).toFixed(2)}" width="${(rw * 2).toFixed(2)}" height="${(rh * 2).toFixed(2)}" rx="0.5" fill="#0a0a0c" stroke="${theme.ink}" stroke-width=".35"/>\n`
      } else {
        const pr = Math.min(r * 0.55, 2.35)
        body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${pr.toFixed(2)}" fill="#121214" stroke="${theme.ink}" stroke-width=".4" opacity=".85"/>\n`
        body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(pr * 0.45).toFixed(2)}" fill="${theme.accent}" opacity=".35"/>\n`
      }
    } else {
      body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(r + 1).toFixed(2)}" fill="#000" opacity=".25"/>\n`
      body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="url(#${uid}well)" stroke="${erica ? '#0a0a0a' : theme.ink}" stroke-width=".4"/>\n`
      if (!erica && h.color && h.color !== '#1a1a1c') {
        body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(r * 0.4).toFixed(2)}" fill="${h.color}" opacity=".9"/>\n`
      }
    }
    if (shouldLabel(h, wells.length)) {
      const label = h.label ?? h.id.replace(/_/g, ' ').toUpperCase()
      const lf = labelFace(theme)
      const ls = erica ? 2.05 : w < 30 ? 1.85 : 2.05
      const labelR = h.kind === 'toggle' ? Math.min(r * 0.55, 2.35) : r
      body += `<text x="${cx.toFixed(2)}" y="${(cy + labelR + 3.9).toFixed(2)}" text-anchor="middle" font-family='${lf}' font-size="${ls}" letter-spacing="${erica ? 0.45 : 0.08}" ${inkAttrs(theme)}>${esc(label)}</text>\n`
    }
  }

  for (const h of digits) {
    const cx = (h.x / 100) * w
    const cy = (h.y / 100) * H
    const dw = h.w ? (h.w / 100) * w : 7
    const dh = h.h ? (h.h / 100) * H : 4.5
    body += `<rect x="${(cx - dw / 2).toFixed(2)}" y="${(cy - dh / 2).toFixed(2)}" width="${dw.toFixed(2)}" height="${dh.toFixed(2)}" rx="0.5" fill="#0a0a0c" stroke="${theme.accent}" stroke-width=".4"/>\n`
  }

  for (const h of leds) {
    const cx = (h.x / 100) * w
    const cy = (h.y / 100) * H
    const col = erica ? '#0a0a0a' : (h.color ?? theme.accent)
    body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="1.4" fill="#0a0a0c" stroke="${col}" stroke-width=".45"/><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="0.75" fill="${col}" opacity=".4"/>\n`
  }

  for (const h of jacks) {
    const cx = (h.x / 100) * w
    const cy = (h.y / 100) * H
    const r = h.size === 'lg' ? 3.2 : h.size === 'sm' ? 2.45 : 2.85
    body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="url(#${uid}jack)"/><circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(r * 0.45).toFixed(2)}" fill="#111"/>\n`
    if (shouldLabel(h, jacks.length)) {
      const label = h.label ?? h.id.replace(/_/g, ' ').toUpperCase()
      const lf = labelFace(theme)
      const ls = erica ? 1.85 : w < 30 ? 1.7 : 1.9
      body += `<text x="${cx.toFixed(2)}" y="${(cy + r + 3.5).toFixed(2)}" text-anchor="middle" font-family='${lf}' font-size="${ls}" letter-spacing="${erica ? 0.35 : 0.06}" ${inkAttrs(theme)}>${esc(label)}</text>\n`
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}mm" height="${H}mm" viewBox="0 0 ${w} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <defs>
    <linearGradient id="${uid}alu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${theme.top}"/>
      <stop offset="1" stop-color="${theme.bot}"/>
    </linearGradient>
    <radialGradient id="${uid}well" cx="38%" cy="32%" r="70%">
      <stop offset="0" stop-color="${erica ? '#f0f0ec' : '#3a3a42'}"/>
      <stop offset=".55" stop-color="${erica ? '#b0b0aa' : '#141418'}"/>
      <stop offset="1" stop-color="${erica ? '#50504c' : '#050506'}"/>
    </radialGradient>
    <radialGradient id="${uid}jack" cx="40%" cy="35%" r="65%">
      <stop offset="0" stop-color="${jackLight}"/>
      <stop offset="1" stop-color="${jackDark}"/>
    </radialGradient>
  </defs>
  ${body}
</svg>
`
}

const want = process.argv.slice(2)
const targets = want.length ? want : Object.keys(THEMES)
let n = 0
for (const typeId of targets) {
  const theme = THEMES[typeId]
  if (!theme) {
    console.warn(`skip ${typeId}: no theme`)
    continue
  }
  const art = PANEL_ART[typeId]
  if (!art?.src) {
    console.warn(`skip ${typeId}: no PANEL_ART.src`)
    continue
  }
  fs.writeFileSync(path.join(web, 'public', art.src.replace(/^\//, '')), renderPlate(typeId, theme))
  console.log(`wrote ${art.src}  [${theme.family}/${theme.skin || 'plain'}]`)
  n++
}

await esbuild.build({
  entryPoints: [path.join(web, 'scripts/faceplate-audit-entry.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: path.join(web, 'public/faceplate-audit-data.js'),
  logLevel: 'silent',
})
fs.unlinkSync(outBundle)
console.log(`done — ${n} faceplates (pedal-shop mode)`)
