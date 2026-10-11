// The prototype's motion in one place. What comes in arrives out of a soft blur and settles slowly,
// never bouncing; what leaves goes quicker than it came. Sheets rise from the bottom edge on a
// critically damped spring, so they decelerate into place instead of snapping or wobbling.
import type { MotionProps, Transition } from 'motion/react';

type Moves = Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>;

/** A long, soft settle, for anything arriving. */
export const EASE_OUT = [0.2, 0.7, 0.2, 1] as const;
/** Picking up speed, for anything leaving. */
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** A sheet rising from the bottom edge (damping ratio 1: no overshoot, ~0.45s to rest). */
export const SHEET: Transition = { type: 'spring', stiffness: 210, damping: 29, mass: 1 };
/** A dialog or a card arriving in the middle of the screen. */
export const DIALOG: Transition = { type: 'spring', stiffness: 240, damping: 30, mass: 1 };
/** Small things that open on the spot: popovers, menus. */
export const POP: Transition = { type: 'spring', stiffness: 380, damping: 34, mass: 0.8 };

// opacity and blur always ease (a spring could carry them past their ends)
const soft = { opacity: { duration: 0.32, ease: EASE_OUT }, filter: { duration: 0.4, ease: EASE_OUT } };

/** The dimmed backdrop behind a sheet or a dialog. */
export const backIn: Moves = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.26, ease: EASE_IN } },
  transition: { duration: 0.36, ease: EASE_OUT },
};

/** A dialog: up a little, out of a blur. */
export const dialogIn: Moves = {
  initial: { opacity: 0, y: 28, scale: 0.96, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 12, scale: 0.98, filter: 'blur(6px)', transition: { duration: 0.2, ease: EASE_IN } },
  transition: { ...DIALOG, ...soft },
};

/** A sheet: from below the screen's edge, all the way up. */
export const sheetIn: Moves = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%', transition: { duration: 0.28, ease: [0.4, 0, 0.8, 0.2] as const } },
  transition: SHEET,
};

/** A popover or a menu: from a little smaller, out of a light blur. */
export const popIn: Moves = {
  initial: { opacity: 0, scale: 0.94, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.97, filter: 'blur(3px)', transition: { duration: 0.14, ease: EASE_IN } },
  transition: { ...POP, opacity: { duration: 0.2, ease: EASE_OUT }, filter: { duration: 0.24, ease: EASE_OUT } },
};

/** A CSS cubic-bezier as a function: x (time) to y (progress). */
export const bezier = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
  let t = x;
  for (let i = 0; i < 8; i++) {
    const f = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3 - x;
    const d = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
    if (Math.abs(f) < 1e-5 || Math.abs(d) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - f / d));
  }
  return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
};

// a slow start and a long settle: the page eases off, travels, and comes to rest
const GLIDE = bezier(0.45, 0, 0.15, 1);
let gliding = 0;
/** The page's own scroll, eased. A native smooth scroll is short and quick, and on a phone it jerks
 *  the whole screen at once. A new glide takes over from one in flight, and so does the reader's
 *  own finger, unless the page is being held (the tour owns the scroll while it is up). Under reduced
 *  motion it simply goes there. */
export function glide(top: number, ms = 900, held = false) {
  cancelAnimationFrame(gliding);
  const from = scrollY;
  const to = Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
  if (Math.abs(to - from) < 1) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { scrollTo(0, to); return; }
  const off = () => { removeEventListener('touchstart', stop); removeEventListener('wheel', stop); };
  const stop = () => { cancelAnimationFrame(gliding); off(); };
  if (!held) {
    addEventListener('touchstart', stop, { passive: true });
    addEventListener('wheel', stop, { passive: true });
  }
  const t0 = performance.now();
  const frame = (now: number) => {
    const p = Math.min(1, (now - t0) / ms);
    scrollTo(0, from + (to - from) * GLIDE(p));
    if (p < 1) gliding = requestAnimationFrame(frame);
    else off();
  };
  gliding = requestAnimationFrame(frame);
}
