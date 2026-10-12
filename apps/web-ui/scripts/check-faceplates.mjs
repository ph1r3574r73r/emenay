#!/usr/bin/env node
/**
 * Fail if any engine module is missing faceplate wiring:
 * PANEL_ART + PANEL_LAYOUTS + SVG file under public/.
 *
 * Skips speaker / test_tone / rc_lpf / MI aliases (plaits→facets, …).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const web = path.join(root, 'apps/web-ui')

const SKIP = new Set([
  'speaker',
  'test_tone',
  'rc_lpf',
  'plaits',
  'marbles',
  'tides',
  'rings',
  'warps',
  'peaks',
])

const lib = fs.readFileSync(path.join(root, 'crates/emenay-modules/src/lib.rs'), 'utf8')
const factories = [
  ...lib.matchAll(/factories\.insert\("([^"]+)"/g),
].map((m) => m[1])

const panelsSrc = fs.readFileSync(path.join(web, 'src/panels.ts'), 'utf8')
const artBody = panelsSrc.slice(panelsSrc.indexOf('export const PANEL_ART'))
const artKeys = new Set(
  [...artBody.matchAll(/^\s{2}([a-z0-9_]+):\s*\{/gm)].map((m) => m[1]),
)

const layoutsSrc = fs.readFileSync(path.join(web, 'src/panelLayouts.ts'), 'utf8')
const layBody = layoutsSrc.slice(layoutsSrc.indexOf('export const PANEL_LAYOUTS'))
const layoutKeys = new Set(
  [...layBody.matchAll(/^\s{2}([a-z0-9_]+):\s*[a-zA-Z0-9_]+,?$/gm)].map((m) => m[1]),
)

function svgSrc(typeId) {
  const m = artBody.match(
    new RegExp(`\\n\\s{2}${typeId}:\\s*\\{[\\s\\S]*?src:\\s*'([^']+)'`),
  )
  return m?.[1] ?? null
}

const errors = []

for (const t of factories) {
  if (SKIP.has(t)) continue
  if (!artKeys.has(t)) errors.push(`${t}: missing PANEL_ART`)
  if (!layoutKeys.has(t)) errors.push(`${t}: missing PANEL_LAYOUTS`)
  const src = svgSrc(t)
  if (!src) {
    errors.push(`${t}: PANEL_ART has no src`)
    continue
  }
  const file = path.join(web, 'public', src.replace(/^\//, ''))
  if (!fs.existsSync(file)) {
    errors.push(`${t}: missing SVG ${src}`)
    continue
  }
  // <img src="*.svg"> refuses malformed XML (e.g. duplicate attributes).
  const xml = fs.readFileSync(file, 'utf8')
  const dup = xml.match(/\s([a-zA-Z_:][\w:.-]*)="[^"]*"\s+(?:[^>]+\s)?\1="/)
  if (dup) errors.push(`${t}: malformed SVG (duplicate attr ${dup[1]}) in ${src}`)
}

// catalog_type_ids should list every non-alias factory (except speaker internals ok)
const catalogIds = [
  ...lib.matchAll(/"([a-z0-9_]+)",?\s*(?:\/\/.*)?$/gm),
]
const inCatalogFn = lib.slice(
  lib.indexOf('pub fn catalog_type_ids'),
  lib.indexOf('}', lib.indexOf('pub fn catalog_type_ids')) + 1,
)
const catalogSet = new Set(
  [...inCatalogFn.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]),
)
for (const t of factories) {
  if (SKIP.has(t) && t !== 'speaker' && t !== 'test_tone' && t !== 'rc_lpf') continue
  if (['plaits', 'marbles', 'tides', 'rings', 'warps', 'peaks'].includes(t)) continue
  if (!catalogSet.has(t)) errors.push(`${t}: missing from catalog_type_ids()`)
}

if (errors.length) {
  console.error('Faceplate check failed:\n' + errors.map((e) => `  • ${e}`).join('\n'))
  process.exit(1)
}

console.log(
  `Faceplate check OK — ${factories.filter((t) => !SKIP.has(t)).length} modules wired (art + layout + svg).`,
)
