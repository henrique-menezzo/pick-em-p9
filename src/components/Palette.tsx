import { AnimatePresence, motion } from 'motion/react';
import { BY_ID, RACES, RESULTS, clock, type Race } from '../data/races';
import { useStore } from '../lib/store';
import { CandidateRow, Flag, Icon, liveLine } from './ui';
import Tip from './Tip';
import us from '../data/usmap-hub.json';

/** The race on the panel: the one under the pointer in the matrix, else the selected one. */
export function usePanelRace() {
  return useStore((s) => {
    const peek = s.hoverId && BY_ID[s.hoverId]?.type === s.tab ? s.hoverId : null;
    return BY_ID[peek ?? s.cursor[s.tab]];
  });
}

/** The Figma "palette": always open, one race at a time. */
export default function Palette() {
  // hovering a dot in the wall of races down below brings that race up here, so the two halves of
  // the screen are always talking about the same thing. Let go and it falls back to your selection.
  const race = useStore((s) => {
    const peek = s.hoverId && BY_ID[s.hoverId]?.type === s.tab ? s.hoverId : null;
    return BY_ID[peek ?? s.cursor[s.tab]];
  });
  const min = useStore((s) => s.panelMin);
  const setMin = useStore((s) => s.setPanelMin);
  return (
    <div className="pal-anchor">
      <AnimatePresence initial={false} mode="popLayout">
        {min ? (
          // out of the way, so the whole map is visible; any pick on the map brings it back
          <motion.button
            key="handle"
            className="pal-handle"
            onClick={() => setMin(false)}
            aria-label="Show the race panel"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <Flag st={race.state} />
            <span>{race.stateName}</span>
            <Icon name="chevDown" size={15} stroke={2} />
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            className="pal"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{ transformOrigin: 'top right' }}
          >
            <FocusBody race={race} />
            {/* one quiet arrow along the panel's bottom edge: tuck it away, any pick brings it back */}
            <Tip text="Hide the panel — picking a state brings it back">
              <button className="pal-collapse" onClick={() => setMin(true)} aria-label="Hide panel">
                <Icon name="chevUp" size={16} stroke={2} />
              </button>
            </Tip>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The state itself, drawn from the map's own geometry, in the colour of your pick. */
function StateShape({ st, pick }: { st: string; pick?: string }) {
  const d = (us.states as Record<string, string>)[st];
  const b = (us.box as Record<string, number[]>)[st];
  if (!d || !b) return null;
  const pad = Math.max(b[2] - b[0], b[3] - b[1]) * 0.06;
  return (
    <svg className={'fb-shape' + (pick ? ' ' + pick : '')} viewBox={`${b[0] - pad} ${b[1] - pad} ${b[2] - b[0] + pad * 2} ${b[3] - b[1] + pad * 2}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <path d={d} />
    </svg>
  );
}

// ---- one race at a time --------------------------------------------------------------------------
export function FocusBody({ race }: { race: Race }) {
  const pick = useStore((s) => s.picks[race.id]);
  const step = useStore((s) => s.step);
  const live = useStore((s) => s.live);
  const t = useStore((s) => s.t);
  const line = live ? liveLine(race, t, pick) : null;

  return (
    <div>
      <div className="fb-head">
        <div className="fb-title">
          {/* keyed CSS entrance, no exit: rapid clicks across the map used to strand the exiting
              copies of an AnimatePresence and leave the card blank */}
          <div key={race.id} className="fb-name fb-in">
            <Flag st={race.state} />
            <StateShape st={race.state} pick={pick} />
            <h3>{race.stateName}</h3>
          </div>
          <div className="fb-nav">
            <button aria-label="Previous race" onClick={() => step(-1)}><Icon name="chevLeft" size={20} stroke={2} /></button>
            <button aria-label="Next race" onClick={() => step(1)}><Icon name="chevRight" size={20} stroke={2} /></button>
          </div>
        </div>
      </div>

      <div key={race.id} className="fb-cands fb-in x">
        <CandidateRow race={race} side="R" advance />
        <CandidateRow race={race} side="D" advance />
      </div>

      {line && (
        <div className={'fb-hint' + (line.tone ? ' ' + line.tone : '')}>
          {line.tone && <span className="vd-i" aria-hidden><Icon name={line.tone === 'ok' ? 'check' : 'x'} size={12} stroke={3} /></span>}
          {line.text}
        </div>
      )}
      {live && <JustCalled />}
    </div>
  );
}

function JustCalled() {
  const t = useStore((s) => s.t);
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const select = useStore((s) => s.select);
  const setHover = useStore((s) => s.setHover);
  const called = RACES[tab].filter((r) => RESULTS[r.id].call <= t).sort((a, b) => RESULTS[b.id].call - RESULTS[a.id].call).slice(0, 4);
  return (
    <div className="next">
      <h6>{called.length ? 'Just called' : 'Waiting for the first call'}</h6>
      {called.map((r) => {
        const w = RESULTS[r.id].winner, p = picks[r.id];
        return (
          <button key={r.id} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => { setHover(null); select(r.id); }}>
            <span className={'sdot ' + w} />
            {r.stateName}
            <span className="r">
              {clock(RESULTS[r.id].call)}
              <span style={{ color: !p ? 'var(--dim)' : p === w ? 'var(--fg)' : 'var(--R)', fontWeight: 600 }}>{!p ? '–' : p === w ? '✓' : '✕'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
