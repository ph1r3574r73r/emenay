# Panel artwork attribution

## Free Modular (`fm/`)

SVG faceplates from the Free Modular project:

- Site: https://freemodular.org/
- Artifacts: https://github.com/quinnfreedman/fm-artifacts
- Author: Quinn Freedman

Used as display faceplates for mixer, output, envelope, offset/atten, clock, boost, rng, drift.

Interactive knob/jack positions in `src/panelLayouts.ts` are measured from the
SVG through-hole coordinates so hits line up with the printed faceplate.

## emenay plates

Original SVG faceplates for emenay modules. Prefer generating them from layout
hits so wells/jacks cannot drift:

```bash
npm run faceplates:render
npm run check:faceplates
```

Themes live in `apps/web-ui/scripts/render-emenay-faceplates.mjs`. Hit-test at
`/faceplate-audit.html` (refresh data with `npm run faceplates:audit-data`).

MI concept backgrounds (`fm/art/*.jpg`) are generated illustrations keyed to each
module’s name and role (Facets / Lots / Swell / Chimes / Twist / Twin).

## Erica Synths DIY (`erica/`)

Legacy Fab silkscreen rasters (kept for reference, not used as primary panels):

- https://github.com/erica-synths/diy-eurorack
- License: CC-BY-SA-3.0
- Copyright: Erica Synths
