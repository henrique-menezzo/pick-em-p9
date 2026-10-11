// The opening. A row of capsules — circles at rest — with a wave running through them, the way the
// reference loop behaves: each one stretches into a bar as the wave passes and settles back into a
// circle. Painted on a canvas so the caps stay perfectly round at any height, and so the whole
// thing costs one draw call per frame.
// P10: the brand's line surfaces under the row word by word, out of a blur. When the opening ends the
// line dissolves where it is, and each capsule of the row flies to a capsule of the wave on the page,
// taking its size and colour, while the page comes in around it.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { REST, intro } from './Brand';

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

const FADE = 300;   // each capsule fades in
const RISE = 520;   // the wave takes this long to pass through one of them
const STEP = 30;    // and this long to move to the next
const AGAIN = 1100; // and comes round again this often while the line is read
export const INTRO_MS = 1750;
const FLY = 1000;   // the hand-over to the page
// in and out gently, so the row lifts off and settles rather than snapping across
const EASE = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

type Cap = { cx: number; cy: number; w: number; h: number; c: string };
/** The line, word by word: each one surfaces out of a blur a beat after the one before. */
const WORDS: [string, boolean][] = [...'The nation speaks.'.split(' ').map((w): [string, boolean] => [w, true]), ...'Can you predict their voices?'.split(' ').map((w): [string, boolean] => [w, false])];
const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
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

    let raf = 0, flying = false;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = now - t0;
      g.clearRect(0, 0, el.width, el.height);
      for (const b of bars) {
        const a = still ? 1 : Math.min(1, Math.max(0, (t - b.in) / FADE));
        if (a <= 0) continue;
        const since = t - b.up;
        b.h = still ? b.w : b.w * (1 + (b.amp - 1) * swell(since < 0 ? 0 : (since % AGAIN) / RISE));
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
      const to = landing();
      const lineEl = line.current, sky = air.current, box = root.current;
      if (still || !to.length || !sky || !box) {
        // nothing to land on (the options without a hero) or reduced motion: the opening just fades
        box?.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: still ? 'none' : 'scale(1.04)' }], { duration: 280, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
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
      const pairs = to.map((b, j) => { const i = Math.round((j * (from.length - 1)) / Math.max(1, to.length - 1)); used.add(i); return { a: from[i], b, d: (j / Math.max(1, to.length - 1)) * 120 }; });
      from.forEach((a, i) => { if (!used.has(i)) pairs.push({ a, b: { ...a, w: 0, h: 0 }, d: 0 }); });

      const dpr2 = Math.min(2, window.devicePixelRatio || 1);
      sky.width = innerWidth * dpr2;
      sky.height = innerHeight * dpr2;
      const q = sky.getContext('2d')!;
      q.scale(dpr2, dpr2);
      el.style.opacity = '0';
      document.documentElement.classList.add('fly');
      intro.hold = performance.now() + FLY;
      box.classList.add('leaving');

      // the line stays where it is and dissolves back into the blur it came out of
      lineEl?.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(10px)' }], { duration: 380, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });

      const s0 = performance.now();
      const fly = (now: number) => {
        const t = now - s0;
        q.clearRect(0, 0, innerWidth, innerHeight);
        for (const { a, b, d } of pairs) {
          const e = EASE(Math.min(1, Math.max(0, (t - d) / (FLY - 120))));
          const w = a.w + (b.w - a.w) * e, h = a.h + (b.h - a.h) * e;
          if (w < 0.5 || h < 0.5) continue;
          const cx = a.cx + (b.cx - a.cx) * e, cy2 = a.cy + (b.cy - a.cy) * e;
          q.fillStyle = mix(a.c, b.c, e);
          q.beginPath();
          q.roundRect(cx - w / 2, cy2 - h / 2, w, h, Math.min(w, h) / 2);
          q.fill();
        }
        if (t < FLY) requestAnimationFrame(fly);
        else { document.documentElement.classList.remove('fly'); sky.style.opacity = '0'; }
      };
      requestAnimationFrame(fly);
      finish.current();
    }, INTRO_MS);

    return () => { cancelAnimationFrame(raf); clearTimeout(done); document.documentElement.classList.remove('fly'); };
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
