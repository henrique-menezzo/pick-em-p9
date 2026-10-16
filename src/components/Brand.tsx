// The Midterms' own branding on the game (P10, option 42, chosen Oct 11): Presented by, the name and the
// brand's line over the game, the brand's wave (TV - 1, animated) beside them, the same as the opening's.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import '@fontsource/libre-franklin/400-italic.css';
import './brand.css';
import { drawWave } from './WaveAnim';

/** The brand's wave, animated (WaveAnim.ts), as large as it fits in its box. `anchor`: where it sits
 *  when the box is wider than it (0 the start, .5 the middle, 1 the end). Still, on its first frame,
 *  with reduced motion. */
export function Wave({ className = '', anchor = 0.5 }: { className?: string; anchor?: number }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = cvs.current;
    if (!el) return;
    const m = () => { const b = el.getBoundingClientRect(); if (b.width && b.height) setSize((o) => (o && o.w === b.width && o.h === b.height ? o : { w: b.width, h: b.height })); };
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = cvs.current;
    if (!el || !size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(size.w * dpr);
    el.height = Math.round(size.h * dpr);
    const g = el.getContext('2d')!;
    const paint = (now: number | null) => {
      g.clearRect(0, 0, el.width, el.height);
      drawWave(g, now, { x: 0, y: 0, w: el.width, h: el.height }, anchor);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(null); return; }
    let raf = 0;
    const frame = (now: number) => { paint(now); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, anchor]);
  return <canvas ref={cvs} className={'bw ' + className} aria-hidden />;
}

/** The line that goes with it. */
export function Tagline({ className = '', split }: { className?: string; split?: boolean }) {
  return (
    <p className={'btag ' + className}>
      <b>The nation speaks.</b>{split ? <br /> : ' '}<span>Can you predict their voices?</span>
    </p>
  );
}

/** The hero over the game: the sponsor, the name and the line on the left, the wave on the right (on a
 *  phone, the wave on top and everything centred). `meta`: the deadline, on the phone, where the map
 *  has no card to carry it. */
/** Words as their own boxes, numbered, so the page's entrance can bring each one out of the blur in turn. */
const words = (text: string, from = 0) => text.split(' ').flatMap((w, i) => [i ? ' ' : null, <span key={i} className="hw" style={{ ['--i' as string]: from + i }}>{w}</span>]);

export function Hero({ presented, meta }: { presented: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <section className="hero">
      <div className="h-head">
        {presented}
        <h2 className="h-title">{words('The Midterms Pick’em')}</h2>
        {/* what the game is and what it is for, a sentence to a line where there is room for it */}
        <p className="h-about"><span>Pick the winner in each of the top 100 races.</span> <span>Finish with the top score and win a year of All Access.</span></p>
        {meta}
      </div>
      <Wave className="h-w" />
    </section>
  );
}
