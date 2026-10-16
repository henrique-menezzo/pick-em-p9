// The brand's animated wave (nation-speaks-wave-animated.svg, turned into data by
// scripts/wave-anim.py): a 30 fps flipbook of the TV - 1 capsules flowing right to left, swelling and
// settling as they go. Drawn on a canvas instead of shown as the SVG, which is 7,000 shapes switched on
// and off by CSS. Each capsule is matched to itself in the next frame, so a 60 Hz screen draws the
// frames in between and the flow stays smooth; the file's last frame runs straight into its first.
import data from '../data/wave-anim.json';

/** The wave's own box, in the file's units (its frame is 3072 wide; the capsules fill 1260 of its height). */
export const WAVE_W = data.w;
export const WAVE_H = data.h;

const N = data.frames.length;
const FRAME = 1000 / data.fps;
type Cap = { c: string; x: number; y: number; w: number; h: number };
const CAPS: Cap[][] = data.frames.map((f) => {
  const out: Cap[] = [];
  for (let i = 0; i < f.length; i += 5) out.push({ c: data.colors[f[i]], x: f[i + 1], y: f[i + 2], w: f[i + 3], h: f[i + 4] });
  return out;
});
// each capsule's place in the next frame (-1: it leaves at the edge), and the ones that come in there
const NEXT: number[][] = [];
const ENTER: number[][] = [];
for (let i = 0; i < N; i++) {
  const a = CAPS[i], b = CAPS[(i + 1) % N], used = new Set<number>();
  NEXT.push(a.map((c) => {
    let best = -1, near = 80;
    b.forEach((e, j) => {
      if (e.c !== c.c || used.has(j)) return;
      const d = Math.abs(e.x + e.w / 2 - (c.x + c.w / 2));
      if (d < near) { near = d; best = j; }
    });
    if (best >= 0) used.add(best);
    return best;
  }));
  ENTER.push(b.map((_, j) => j).filter((j) => !used.has(j)));
}
/** How far the flow carries a capsule in one frame (leftwards), for the ones entering and leaving. */
const DRIFT = -17.3;

/** One clock for every wave on the page: the opening and the page's own wave show the same moment. */
const T0 = performance.now();

/** The wave at `now` (null: its first frame, still) in the box, as large as it fits, centred
 *  vertically; `anchor` places it along a box wider than it (0 the start, .5 the middle, 1 the end).
 *  Cut at the sides of its own frame, as the SVG is. */
export function drawWave(g: CanvasRenderingContext2D, now: number | null, box: { x: number; y: number; w: number; h: number }, anchor = 0.5) {
  const k = Math.min(box.w / WAVE_W, box.h / WAVE_H);
  const ox = box.x + (box.w - WAVE_W * k) * anchor, oy = box.y + (box.h - WAVE_H * k) / 2;
  const t = now === null ? 0 : Math.max(0, now - T0) / FRAME;
  const f = Math.floor(t) % N, p = t - Math.floor(t);
  const a = CAPS[f], b = CAPS[(f + 1) % N], next = NEXT[f];
  const cap = (c: string, x: number, y: number, w: number, h: number) => {
    g.fillStyle = c;
    g.beginPath();
    g.roundRect(ox + x * k, oy + y * k, w * k, h * k, (Math.min(w, h) * k) / 2);
    g.fill();
  };
  g.save();
  g.beginPath();
  g.rect(ox, box.y, WAVE_W * k, box.h);
  g.clip();
  a.forEach((c, i) => {
    const j = next[i];
    if (j < 0) return cap(c.c, c.x + DRIFT * p, c.y, c.w, c.h);
    const e = b[j];
    cap(c.c, c.x + (e.x - c.x) * p, c.y + (e.y - c.y) * p, c.w + (e.w - c.w) * p, c.h + (e.h - c.h) * p);
  });
  if (p > 0) for (const j of ENTER[f]) { const e = b[j]; cap(e.c, e.x - DRIFT * (1 - p), e.y, e.w, e.h); }
  g.restore();
}
