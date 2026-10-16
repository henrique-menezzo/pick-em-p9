// The opening. A row of capsules — circles at rest — with a wave running through them, the way the
// reference loop behaves: each one stretches into a bar as the wave passes and settles back into a
// circle, while the brand's line surfaces under the row word by word, out of a blur. Painted on a
// canvas so the caps stay perfectly round at any height.
// When it ends, the row calms down and the whole opening fades away; the page then comes in on its own.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { intro } from './Brand';
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
const CALM = 360;   // before it leaves, the row's swell dies down, so it fades from rest
const OUT = 380;    // the fade
/** When the page's own wave wakes, after the opening has gone: the page's entrance starts then (--land
    in brand.css) */
const LAND = 450;

const EASE = bezier(0.5, 0, 0.1, 1);
const clamp = (x: number) => Math.min(1, Math.max(0, x));

/** The line, word by word: [word, in bold]. */
const WORDS: [string, boolean][] = [...'The nation speaks.'.split(' ').map((w): [string, boolean] => [w, true]), ...'Can you predict their voices?'.split(' ').map((w): [string, boolean] => [w, false])];
export default function Intro({ onDone }: { onDone: () => void }) {
  // the parent hands a new function on every render; the opening must not restart for it
  const finish = useRef(onDone);
  useEffect(() => { finish.current = onDone; }, [onDone]);
  const root = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);

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

    // the page stays at its top while the opening is up: it opens on the hero
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
    const unsub = useStore.subscribe((st) => { if (st.phase !== 'intro') release(); });

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
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // the end: the row has come to rest; the opening fades away from the top of the page and the page
    // comes in once it has gone, its own wave first
    const done = setTimeout(() => {
      window.scrollTo(0, 0);
      root.current?.classList.add('leaving');
      root.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      // the page's wave stays at rest until the page is in, then a ripple runs through it and it swells
      intro.hold = performance.now() + LAND;
      release();
      finish.current();
    }, INTRO_MS);

    return () => { cancelAnimationFrame(raf); clearTimeout(done); release(); unsub(); };
  }, []);

  // on the body, not inside the page: the page waits at opacity 0 under it, and would take it along
  return createPortal(
    <motion.div ref={root} className="intro" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: OUT / 1000 } }}>
      <div className="intro-bg" />
      <div className="intro-mark">
        <canvas ref={cvs} style={{ aspectRatio: `${W} / ${H}` }} aria-hidden />
        <p className="intro-line" aria-label="The nation speaks. Can you predict their voices?">
          {WORDS.map(([w, strong], i) => (
            <motion.span key={i} className={strong ? 'iw b' : 'iw'} aria-hidden
              initial={{ opacity: 0, filter: 'blur(12px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ delay: 0.42 + i * 0.07, duration: 0.6, ease: [0.2, 0, 0, 1] }}>{w}</motion.span>
          ))}
        </p>
      </div>
    </motion.div>,
    document.body,
  );
}
