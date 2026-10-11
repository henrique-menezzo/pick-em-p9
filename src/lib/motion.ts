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
