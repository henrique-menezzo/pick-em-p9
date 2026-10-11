// The Midterms' own branding on the game (P10, option 42, chosen Oct 11): Presented by, the name and the
// brand's line over the game, the brand's wave (TV - 1) beside them, alive the way the opening is.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import '@fontsource/libre-franklin/400-italic.css';
import './brand.css';

/** The brand's wave, from the branding team's "TV - 1" frame (Figma 461:9950): each capsule's centre,
    width, height and colour, in the frame's own pixels (1280 × 720, the row centred on y 359.5). */
const TV1: [number, number, number, string][] = [
  [-2.7, 60.5, 72.3, '#01CEFB'], [85.2, 60.5, 109.4, '#006EFF'], [173.1, 60.5, 168.0, '#0017A3'], [297.6, 143.6, 206.1, '#001B7E'],
  [413.3, 60.5, 261.7, '#17075D'], [505.8, 97.2, 394.5, '#33003B'], [590.5, 58.6, 469.7, '#65003A'], [661.1, 88.4, 239.7, '#99003B'],
  [740.0, 69.3, 321.3, '#CC003B'], [791.0, 32.7, 562.5, '#FC002C'], [879.6, 144.5, 209.0, '#FC002C'], [1002.2, 100.6, 100.6, '#99003B'],
  [1066.1, 36.1, 36.1, '#01CEFB'], [1123.3, 78.1, 78.1, '#0F45DB'], [1184.3, 55.7, 55.7, '#0017A3'], [1256.6, 46.9, 46.9, '#001B7E'],
];
/** The opening hands its wave over to the page's (Intro.tsx): until `hold` every wave on the page stays
    at rest, the frame exactly as drawn, then its swell eases in. REST keeps each canvas's capsules at
    rest, in its own pixels, so the opening knows where each one has to land. */
export const intro = { hold: 0 };
export type RestBar = { p: number; w: number; h: number; c: string; round: boolean };
export const REST = new WeakMap<HTMLCanvasElement, { bars: RestBar[]; vertical: boolean; mid: number }>();

/** The brand's wave (TV - 1), the whole row in its box, a slow swell running through it (the frame as
 *  drawn with reduced motion, or while the opening still holds it). anchor: where the row sits when the
 *  box is wider than it (0 the start, .5 the middle, 1 the end). */
export function Wave({ className = '', period = 4200, anchor = 0.5 }: { className?: string; period?: number; anchor?: number }) {
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
    // the whole row in the box, as large as it fits, with room above and below for the swell
    const lo = Math.min(...TV1.map(([x, w]) => x - w / 2)), hi = Math.max(...TV1.map(([x, w]) => x + w / 2));
    const len = hi - lo, tall = Math.max(...TV1.map(([, , h]) => h));
    const k = Math.min(el.width / len, el.height / (tall * 1.18));
    const o = (el.width - len * k) * anchor - lo * k;
    // each capsule where it sits (p, along the row), its size, and f, its place in the row for the swell
    const bars = TV1.map(([x, w, h, c]) => ({ p: o + x * k, w: w * k, h: h * k, c, round: h <= w + 0.5, f: (x - lo) / len }));
    const mid = el.height / 2;
    REST.set(el, { bars, vertical: false, mid });
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // amp: how much of the swell shows, 0 while the opening still holds the waves at rest
    const draw = (t: number, amp: number) => {
      g.clearRect(0, 0, el.width, el.height);
      for (const b of bars) {
        const ph = amp * Math.sin(2 * Math.PI * (t / period - b.f));
        const w = b.round ? b.w * (1 + 0.06 * ph) : b.w;
        const h = b.round ? b.h * (1 + 0.06 * ph) : Math.max(w, b.h * (1 + 0.16 * ph));
        const r = Math.min(w, h) / 2;
        g.fillStyle = b.c;
        g.beginPath();
        g.roundRect(b.p - w / 2, mid - h / 2, w, h, r);
        g.fill();
      }
    };
    if (still) { draw(0, 0); return; }
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => { draw(now - t0, Math.min(1, Math.max(0, (now - intro.hold) / 900))); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size, period, anchor]);
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
export function Hero({ presented, meta }: { presented: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <section className="hero">
      <div className="h-head">{presented}<h2 className="h-title">The Midterms Pick Em</h2><Tagline className="h-tag" />{meta}</div>
      <Wave className="h-w" />
    </section>
  );
}
