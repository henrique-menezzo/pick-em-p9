// The opening. A row of capsules — circles at rest — with a wave running through them, the way the
// reference loop behaves: each one stretches into a bar as the wave passes and settles back into a
// circle, while the brand's line surfaces under the row word by word, out of a blur. Painted on a
// canvas so the caps stay perfectly round at any height.
// When it ends, the row calms down, the line dissolves where it is, and the row flies into the page:
// each capsule on a gentle arc, one after another, leaving a short trail, taking the size and colour
// of the capsule of the page's wave it lands on. The page only comes in around it once it has landed.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { REST, intro } from './Brand';
import { useStore } from '../lib/store';
import { bezier } from '../lib/motion';

/** The branding team's row, measured off their frame: diameters as a share of the biggest, and the
    colour each one carries. They touch, so the row's length is just the sum of them. */
const WAVE: { r: number; c: string }[] = [
  { r: 0.13, c: '#16165e' }, { r: 0.17, c: '#1a1e7a' }, { r: 0.41, c: '#2b5ce0' }, { r: 0.84, c: '#55c8f0' },
  { r: 0.38, c: '#ef3b34' }, { r: 0.97, c: '#c3304e' }, { r: 0.22, c: '#8e2340' }, { r: 0.39, c: '#5e1236' },
  { r: 0.37, c: '#3a0a2e' }, { r: 1.00, c: '#1a0f52' }, { r: 0.72, c: '#12277e' }, { r: 0.34, c: '#0f2fa8' },
  { r: 0.17, c: '#2b5ce0' }, { r: 0.38, c: '#55c8f0' }, { r: 0.70, c: '#ef3b34' }, { r: 0.17, c: '#a02440' },
  { r: 0.13, c: '#7a1a38' },
];
const UNIT = 150;                                   // the biggest circle is 150px across
const W = WAVE.reduce((s, d) => s + d.r * UNIT, 0); // the row at its natural size
const H = UNIT * 3.6;                               // headroom for the tallest bar

// the loading, in ms (as it was)
const FADE = 300;   // each capsule fades in
const RISE = 520;   // the wave takes this long to pass through one of them
const STEP = 30;    // and this long to move to the next
const AGAIN = 1100; // and comes round again this often while the line is read
export const INTRO_MS = 1750;
const CALM = 360;   // before it leaves, the row's swell dies down, so it sets off from rest
// the hand-over
const FLY = 1000;      // from the middle of the screen into the page
const SPREAD = 220;    // the capsules leave one after another, left to right, like the wave itself
const ARC = 0.16;      // each path bows by this share of its length
const TRAIL: [number, number][] = [[18, 0.16], [36, 0.08], [54, 0.04]]; // ghosts: how far behind, how strong

// a slow lift-off and a long, soft landing
const EASE = bezier(0.5, 0, 0.1, 1);
const clamp = (x: number) => Math.min(1, Math.max(0, x));

type Cap = { cx: number; cy: number; w: number; h: number; c: string };
/** The line, word by word: [word, in bold]. */
const WORDS: [string, boolean][] = [...'The nation speaks.'.split(' ').map((w): [string, boolean] => [w, true]), ...'Can you predict their voices?'.split(' ').map((w): [string, boolean] => [w, false])];
const rgb = (c: string) => (c.startsWith('rgb') ? c.slice(4, -1).split(',').map(Number) : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
const mix = (a: string, b: string, t: number) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
const seen = (r: DOMRect) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

/** Where every capsule of the page's waves sits at rest, on screen: the hero's if there is one. */
function landing(): Cap[] {
  const scope = document.querySelector('.hero') ?? document;
  const out: Cap[] = [];
  scope.querySelectorAll<HTMLCanvasElement>('canvas.bw').forEach((c) => {
    const R = REST.get(c), r = c.getBoundingClientRect();
    if (!R || !seen(r)) return;
    const s = r.width / c.width;
    for (const b of R.bars) {
      const len = b.round ? b.h : Math.max(b.w, b.h);
      const cap = R.vertical
        ? { cx: r.left + R.mid * s, cy: r.top + b.p * s, w: len * s, h: b.w * s, c: b.c }
        : { cx: r.left + b.p * s, cy: r.top + R.mid * s, w: b.w * s, h: len * s, c: b.c };
      if (cap.cx >= r.left - 1 && cap.cx <= r.right + 1 && cap.cy >= r.top - 1 && cap.cy <= r.bottom + 1) out.push(cap);
    }
  });
  return out.sort((a, b) => a.cx - b.cx || a.cy - b.cy);
}

export default function Intro({ onDone }: { onDone: () => void }) {
  // the parent hands a new function on every render; the opening must not restart for it
  const finish = useRef(onDone);
  useEffect(() => { finish.current = onDone; }, [onDone]);
  const root = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const air = useRef<HTMLCanvasElement>(null);
  const line = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = (el.getBoundingClientRect().width / W) * dpr;
    el.width = Math.round(W * k);
    el.height = Math.round(H * k);
    const g = el.getContext('2d')!;
    const mid = (WAVE.length - 1) / 2;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // the page stays at its top while the opening is up: it is about to land on the hero
    // (a reload from halfway down the page: a phone's browser can put the old position back after the
    // page has loaded, so the top is held for as long as the opening is up, not just at the start)
    const hold = (e: Event) => e.preventDefault();
    const top = () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); };
    top();
    window.addEventListener('wheel', hold, { passive: false });
    window.addEventListener('touchmove', hold, { passive: false });
    window.addEventListener('scroll', top);
    const release = () => { window.removeEventListener('wheel', hold); window.removeEventListener('touchmove', hold); window.removeEventListener('scroll', top); };
    // skipped (?intro=0, a tour link): the opening is only on its way out, so it lets go of the page now
    let flying = false;
    const unsub = useStore.subscribe((st) => { if (st.phase !== 'intro' && !flying) release(); });

    // lay the row out once: touching capsules, centred
    let x = 0;
    const bars = WAVE.map((d, i) => {
      const w = d.r * UNIT;
      const b = { x: (x + w / 2) * k, w: w * k, c: d.c, amp: 2.5 + (1 - d.r) * 1.4, in: Math.abs(i - mid) * 22, up: 120 + i * STEP, h: w * k };
      x += w;
      return b;
    });
    const cy = (H / 2) * k;
    // there and back on a sine, so a bar leaves as gently as it arrives
    const swell = (p: number) => (p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI) ** 2);

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = now - t0;
      g.clearRect(0, 0, el.width, el.height);
      for (const b of bars) {
        const a = still ? 1 : clamp((t - b.in) / FADE);
        if (a <= 0) continue;
        const since = t - b.up;
        // how much of the swell is left: all of it, until the row calms down before it leaves
        const calm = 1 - EASE(clamp((t - (INTRO_MS - CALM)) / CALM));
        b.h = still ? b.w : b.w * (1 + (b.amp - 1) * calm * swell(since < 0 ? 0 : (since % AGAIN) / RISE));
        g.globalAlpha = a;
        g.fillStyle = b.c;
        g.beginPath();
        g.roundRect(b.x - b.w / 2, cy - b.h / 2, b.w, b.h, b.w / 2);
        g.fill();
      }
      if (!flying) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // the hand-over
    const done = setTimeout(() => {
      // the page is put back at its top before the row looks for where to land
      window.scrollTo(0, 0);
      const to = landing();
      const lineEl = line.current, sky = air.current, box = root.current;
      if (still || !to.length || !sky || !box) {
        // nothing to land on, or reduced motion: the opening just fades
        box?.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: still ? 'none' : 'scale(1.04)' }], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
        release();
        finish.current();
        return;
      }
      flying = true;
      cancelAnimationFrame(raf);
      // where the opening's capsules are now, on screen
      const r = el.getBoundingClientRect(), s = r.width / el.width;
      const from: Cap[] = bars.map((b) => ({ cx: r.left + b.x * s, cy: r.top + cy * s, w: b.w * s, h: b.h * s, c: b.c }));
      // each landing spot takes the opening's capsule at the same place along the row; capsules
      // nobody takes shrink away where they are
      const used = new Set<number>();
      const T = to.length;
      const pairs = to.map((b, j) => {
        const i = Math.round((j * (from.length - 1)) / Math.max(1, T - 1));
        used.add(i);
        const a = from[i];
        // the arc: bowed off the straight line, a little more for the later ones; when the trip is
        // mostly up (a phone), the left half bows left and the right half right, like a fountain
        const dx = b.cx - a.cx, dy = b.cy - a.cy, len = Math.hypot(dx, dy) || 1;
        let nx = dy / len, ny = -dx / len;
        if (Math.abs(dx) < Math.abs(dy) * 0.5 && j > (T - 1) / 2) { nx = -nx; ny = -ny; }
        const bow = ARC * len * (0.85 + (0.3 * j) / Math.max(1, T - 1));
        return { a, b, d: (j / Math.max(1, T - 1)) * SPREAD, ctl: { x: (a.cx + b.cx) / 2 + nx * bow, y: (a.cy + b.cy) / 2 + ny * bow } };
      });
      from.forEach((a, i) => { if (!used.has(i)) pairs.push({ a, b: { ...a, w: 0, h: 0 }, d: 0, ctl: { x: a.cx, y: a.cy } }); });

      const dpr2 = Math.min(2, window.devicePixelRatio || 1);
      sky.width = innerWidth * dpr2;
      sky.height = innerHeight * dpr2;
      const q = sky.getContext('2d')!;
      q.scale(dpr2, dpr2);
      el.style.opacity = '0';
      document.documentElement.classList.add('fly');
      // the page's wave stays at rest until the row has landed in it, then a ripple runs through it
      intro.hold = performance.now() + FLY;
      box.classList.add('leaving');

      // the line stays where it is and dissolves back into the blur it came out of
      lineEl?.animate([{ opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' }, { opacity: 0, filter: 'blur(10px)', transform: 'scale(.98)' }], { duration: 420, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });

      // one capsule at progress e: along its arc, its size and colour on their way to the landing's
      const at = (pr: (typeof pairs)[number], e: number) => {
        const u = 1 - e;
        return {
          x: u * u * pr.a.cx + 2 * u * e * pr.ctl.x + e * e * pr.b.cx,
          y: u * u * pr.a.cy + 2 * u * e * pr.ctl.y + e * e * pr.b.cy,
          w: pr.a.w + (pr.b.w - pr.a.w) * e,
          h: pr.a.h + (pr.b.h - pr.a.h) * e,
        };
      };
      const paint = (x: number, y: number, w: number, h: number) => {
        if (w < 0.5 || h < 0.5) return;
        q.beginPath();
        q.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2);
        q.fill();
      };
      const s0 = performance.now();
      const fly = (now: number) => {
        const t = now - s0;
        q.clearRect(0, 0, innerWidth, innerHeight);
        for (const pr of pairs) {
          const prog = (lag: number) => EASE(clamp((t - lag - pr.d) / (FLY - SPREAD)));
          const e = prog(0);
          q.fillStyle = mix(pr.a.c, pr.b.c, e);
          // the trail first, under the capsule: where it was a moment ago, fainter the further back
          for (const [lag, k2] of TRAIL) {
            const e2 = prog(lag);
            if (e - e2 < 0.004) continue;
            const c = at(pr, e2);
            q.globalAlpha = k2;
            paint(c.x, c.y, c.w, c.h);
          }
          q.globalAlpha = 1;
          const c = at(pr, e);
          paint(c.x, c.y, c.w, c.h);
        }
        if (t < FLY) requestAnimationFrame(fly);
        else { document.documentElement.classList.remove('fly'); sky.style.opacity = '0'; release(); }
      };
      requestAnimationFrame(fly);
      finish.current();
    }, INTRO_MS);

    return () => { cancelAnimationFrame(raf); clearTimeout(done); release(); unsub(); document.documentElement.classList.remove('fly'); };
  }, []);

  // on the body, not inside the page: the page waits at opacity 0 under it, and would take it along
  return createPortal(
    <motion.div ref={root} className="intro" initial={{ opacity: 1 }} exit={{ opacity: 0.999, transition: { duration: (FLY + 80) / 1000 } }}>
      <div className="intro-bg" />
      <div className="intro-mark">
        <canvas ref={cvs} style={{ aspectRatio: `${W} / ${H}` }} aria-hidden />
        <p ref={line} className="intro-line" aria-label="The nation speaks. Can you predict their voices?">
          {WORDS.map(([w, strong], i) => (
            <motion.span key={i} className={strong ? 'iw b' : 'iw'} aria-hidden
              initial={{ opacity: 0, filter: 'blur(12px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.42 + i * 0.07, duration: 0.6, ease: [0.2, 0, 0, 1] }}>{w}</motion.span>
          ))}
        </p>
      </div>
      <canvas ref={air} className="intro-air" aria-hidden />
    </motion.div>,
    document.body,
  );
}
