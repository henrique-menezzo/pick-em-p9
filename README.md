# Pick Em · P9

Interactive prototype of the Daily Wire midterms prediction map ("The Midterms Pick Em"), built to match the
Figma frame *Pick Em · P8 version 23* (file DW WIP Q4 2026, page Game Map) at 1440 x 900.

Live: https://henrique-menezzo.github.io/pick-em-p9/

- Three maps (Senate, Governor, House) as folder tabs joined to one card
- The map, the race on screen, "Your map" with its percentage and "Every race" with one square per race
- One "Save maps" for all three; Autofill per map from polling data or Polymarket
- Election night preview from the switch at the bottom

Run locally: `npm install`, then `npm run dev`. Useful links: `?intro=0` skips the intro, `?fill=1` fills the
map, `?night=1&t=220` opens election night.
