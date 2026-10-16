// The opening: the brand's wave, animated (the branding team's nation-speaks-wave-animated, drawn by
// WaveAnim.ts), with the line under it surfacing word by word out of a blur. When it ends the whole
// opening fades away and the page comes in on its own, its wave at the same moment of the flow.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { useStore } from '../lib/store';
import { WAVE_H, WAVE_W, drawWave } from './WaveAnim';

export const INTRO_MS = 1750;
const OUT = 380; // the fade

/** The line, word by word: [word, in bold], as the asset sets it. */
const WORDS: [string, boolean][] = [...'The Nation Speaks.'.split(' ').map((w): [string, boolean] => [w, true]), ...'Can you predict their voices?'.split(' ').map((w): [string, boolean] => [w, false])];

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
    const r = el.getBoundingClientRect();
    el.width = Math.round(r.width * dpr);
    el.height = Math.round(r.height * dpr);
    const g = el.getContext('2d')!;
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

    let raf = 0;
    const paint = (now: number | null) => {
      g.clearRect(0, 0, el.width, el.height);
      drawWave(g, now, { x: 0, y: 0, w: el.width, h: el.height });
    };
    const frame = (now: number) => { paint(now); raf = requestAnimationFrame(frame); };
    if (still) paint(null);
    else raf = requestAnimationFrame(frame);

    // the end: the opening fades away from the top of the page and the page comes in once it has gone,
    // its own wave first
    const done = setTimeout(() => {
      window.scrollTo(0, 0);
      root.current?.classList.add('leaving');
      root.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
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
        <motion.canvas ref={cvs} style={{ aspectRatio: `${WAVE_W} / ${WAVE_H}` }} aria-hidden
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }} />
        <p className="intro-line" aria-label="The Nation Speaks. Can you predict their voices?">
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
