// P6 · the two Figma frames ("Pick Em · P1 (web build)", the column one and the centred one) and
// three variations of each. Same pieces everywhere: the title, the three parts as tabs, the score
// with one dot per race, the race, the actions, the map. The map is never under anything.
import { useEffect, useRef, useState, type KeyboardEvent as RKE, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ALL, RACES, RESULTS, T_MAX, TAB_LABEL, TABS, clock, statusAt, type Tab } from '../data/races';
import { LOCK_AT, catSaved, isLocked, liveScore, useStore } from '../lib/store';
import DotMap from './DotMap';
import DotGrid from './DotGrid';
import { FocusBody, usePanelRace } from './Palette';
import { Icon } from './ui';
import { Actions, AutofillButton, Legend, Timeline } from '../App';
import { ResetButton } from './Common';
import LockLine, { useCountdown } from './LockLine';
import { Wordmark } from './Nav';
import us from '../data/usmap-hub.json';
import polymarket from '../data/polymarket.svg';
import { STUDY } from '../lib/variants';

const spring = { type: 'spring' as const, stiffness: 500, damping: 40 };
const useLive = () => useStore((s) => s.live);

// ---- pieces ------------------------------------------------------------------------------------
function MapBox() {
  const kind = useStore((s) => s.mapKind);
  return <div className="v-map">{kind === 'dots' ? <DotGrid /> : <DotMap fit />}</div>;
}

/** Picking: reset, Autofill, Save. Election night: the clock. */
function Foot() {
  const live = useLive();
  return live ? (STUDY ? null : <Timeline />) : <Actions />;
}

/** `line`: the name and the deadline on one 48px line. `eyebrow`: "The Midterms" over a big "Pick Em". */
function Title({ center, line, eyebrow }: { center?: boolean; line?: boolean; eyebrow?: boolean }) {
  const live = useLive();
  const sub = live ? <p className="sub"><i className="sd live-dot" />Live results</p> : <LockLine />;
  return (
    <header className={'v-title' + (center ? ' center' : '') + (line ? ' line' : '') + (eyebrow ? ' eyebrow' : '')}>
      {eyebrow ? <><span className="v-eyebrow">The Midterms</span><h1>Pick Em</h1></> : <h1>The Midterms Pick Em</h1>}
      {sub}
    </header>
  );
}

function useCat(k: Tab) {
  const picks = useStore((s) => s.picks);
  const live = useLive();
  const t = useStore((s) => s.t);
  const n = RACES[k].length;
  const picked = RACES[k].filter((r) => picks[r.id]).length;
  const sc = live ? liveScore(picks, t, k) : null;
  return { n, v: sc ? sc.correct : picked, of: sc ? sc.called : n, done: !live && picked === n };
}

/** Senate, Governor, House with their counts: the tabs of the game. `rows` stacks them with a bar. */
function Tabs({ rows, fill, counts = true }: { rows?: boolean; fill?: boolean; counts?: boolean }) {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  return (
    <div className={'v-tabs' + (rows ? ' rows' : '') + (fill ? ' fill' : '')} role="tablist">
      {TABS.map((k) => <TabBtn key={k} k={k} on={tab === k} rows={rows} counts={counts} onClick={() => setTab(k)} />)}
    </div>
  );
}
function TabBtn({ k, on, rows, counts, onClick }: { k: Tab; on: boolean; rows?: boolean; counts?: boolean; onClick: () => void }) {
  const { n, v, of, done } = useCat(k);
  return (
    <button role="tab" aria-selected={on} className={'v-tab' + (on ? ' on' : '') + (done ? ' done' : '')} onClick={onClick}>
      {on && <motion.span layoutId={rows ? 'vt-hl-r' : 'vt-hl'} className="v-tab-hl" transition={spring} />}
      <span className="v-tab-name">{TAB_LABEL[k]}</span>
      {counts && <span className="v-tab-n num">{done && <Icon name="check" size={12} stroke={2.8} />}{v}/{of}</span>}
      {rows && <span className="v-bar"><b style={{ width: (v / n) * 100 + '%' }} /></span>}
    </button>
  );
}

/** One dot per race in the part on screen, coloured by your pick (or, on the night, by the call). */
function Dots() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const cursor = useStore((s) => s.cursor[s.tab]);
  const live = useLive();
  const t = useStore((s) => s.t);
  const tap = useStore((s) => s.tap);
  const setHover = useStore((s) => s.setHover);
  return (
    <div className="v-dots">
      {RACES[tab].map((r) => {
        const p = picks[r.id];
        let cls: string = p ?? '';
        if (live) {
          const called = statusAt(r.id, t).status === 'called';
          const w = RESULTS[r.id].winner;
          cls = !called ? 'wait' : p === w ? w : 'miss';
        }
        return (
          <button key={r.id} className={'v-dot ' + cls + (r.id === cursor ? ' cur' : '')} aria-label={r.stateName}
            onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={() => tap(r.id)} />
        );
      })}
    </div>
  );
}

/** The score. `all`: the whole map (Perfect Map). Otherwise the part on screen ("Senate picks"). */
function Score({ all, dots = true, label = true, inline }: { all?: boolean; dots?: boolean; label?: boolean; inline?: boolean }) {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const live = useLive();
  const t = useStore((s) => s.t);
  const cat = useCat(tab);
  const total = live ? liveScore(picks, t) : null;
  const v = all ? (total ? total.correct : ALL.filter((r) => picks[r.id]).length) : cat.v;
  const of = all ? (total ? total.called : ALL.length) : cat.of;
  const n = all ? ALL.length : cat.n;
  const name = all ? (live ? 'Called right' : 'Perfect Map') : live ? `${TAB_LABEL[tab]} called right` : `${TAB_LABEL[tab]} picks`;
  return (
    <div className={'v-score' + (inline ? ' inline' : '')}>
      {label && <span className="v-score-l">{name}</span>}
      <span className="v-score-n num"><b>{v}</b>/{of}</span>
      <span className="v-bar"><b style={{ width: (v / n) * 100 + '%' }} /></span>
      {dots && <Dots />}
    </div>
  );
}

/** When a part is finished, say so and point at what is left. */
function CatDone() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const live = useLive();
  const setTab = useStore((s) => s.setTab);
  if (live || RACES[tab].some((r) => !picks[r.id])) return null;
  const rest = TABS.filter((k) => k !== tab).map((k) => ({ k, left: RACES[k].filter((r) => !picks[r.id]).length })).filter((x) => x.left);
  return (
    <div className="catdone">
      <p><Icon name="check" size={14} stroke={2.8} /> {TAB_LABEL[tab]} complete</p>
      {rest.length ? (
        <button onClick={() => setTab(rest[0].k)}>{rest[0].left} {TAB_LABEL[rest[0].k]} races left <Icon name="arrowRight" size={14} stroke={2} /></button>
      ) : <small>Every race is picked. Your Perfect Map is done.</small>}
    </div>
  );
}

/** The race. `wide` puts the two candidates side by side; `actions` closes the card with them. */
function Race({ className = '', wide, actions, noDone }: { className?: string; wide?: boolean; actions?: boolean; noDone?: boolean }) {
  const race = usePanelRace();
  return (
    <div className={'pal dock v-race' + (wide ? ' wide' : '') + (className ? ' ' + className : '')}>
      <FocusBody race={race} />
      {!noDone && <CatDone />}
      {actions && <div className="v-race-foot"><Foot /></div>}
    </div>
  );
}

/** Election night: the live show. A placeholder until there is a stream to put in it. */
function LiveVideo({ bare }: { bare?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [open, setOpen] = useState(true);
  if (bare && !open) {
    return (
      <button className="v-video-min" onClick={() => setOpen(true)}>
        <i className="sd" /><b>Election Night Live</b><span>Watch</span>
      </button>
    );
  }
  return (
    <div className={'v-video' + (open ? '' : ' min') + (bare ? ' bare' : '')}>
      {open && (
        <div className="vid" ref={ref}>
          <Wordmark className="vid-mark" />
          <span className="vid-live"><i />Live</span>
          <div className="vid-ctl">
            <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}><Icon name={muted ? 'mute' : 'volume'} size={16} /></button>
            <button aria-label="Full screen" onClick={() => ref.current?.requestFullscreen?.()}><Icon name="expand" size={16} /></button>
            {bare && <button aria-label="Hide the video" onClick={() => setOpen(false)}><Icon name="minus" size={16} /></button>}
          </div>
        </div>
      )}
      {!bare && (
        <div className="vid-meta">
          <span><b>Election Night Live</b><small>Daily Wire coverage as the races are called</small></span>
          <button className="vid-tog" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Watch'}</button>
        </div>
      )}
    </div>
  );
}

// ---- The Figma frame, exactly, and a title that fits around it ------------------------------------
// The frame (344:7900): the map card and the panel, 12 apart, 632 tall, 24 inside. The map card holds
// only controls. The title lives outside both cards, and everything outside them is lined up with
// what is inside: the nav's first link, the title and the how-to-play button start on one vertical
// line; the account button, the deadline and Save end on another.

function HelpButton() {
  const setTour = useStore((s) => s.setTour);
  return <button className="btn e-help" aria-label="How to play" onClick={() => setTour(0)}><Icon name="help" size={20} stroke={1.8} /></button>;
}

/** `title`: the name beside how-to-play, on the control line (frames 344:7900 and 352:10368).
 *  `lock`: the deadline as a chip after the name. `lockFoot`: the deadline beside the sponsor, at the foot. */
function MapCard({ title, lock, lockFoot, lockText, perCat, noName, nameText, noSave }: { title?: boolean; lock?: boolean; lockFoot?: boolean; lockText?: 'timer' | 'date'; perCat?: boolean; noName?: boolean; nameText?: ReactNode; noSave?: boolean }) {
  const live = useLive();
  const named = title && !noName;
  return (
    <section className="e-map v-card">
      <div className="e-ctl">
        <div className="e-ctl-l">
          <HelpButton />
          {named && <h1 className="e-name">{nameText ?? 'The Midterms Pick Em'}</h1>}
          {named && lock && <LockChip />}
          {title && lockText && <LockInline calm={lockText === 'date'} />}
          {named && live && !lock && !lockText && <span className="e-livechip"><i className="sd live-dot" />Live</span>}
        </div>
        {perCat && !live ? <CatActions noSave={noSave} /> : <Foot />}
      </div>
      <MapBox />
      {title && <div className="e-foot-l">{lockFoot && <><LockText /><span className="e-dot" /></>}<Presented /></div>}
      <div className="e-legend"><Legend /></div>
    </section>
  );
}

function LockChip() {
  const live = useLive();
  const t = useStore((s) => s.t);
  const { left, locked } = useCountdown();
  return (
    <span className="e-lockchip num">
      {live ? <><i className="sd live-dot" />{t >= T_MAX ? 'Final results' : 'Live'}</> : locked ? 'Picks locked' : <>Locks in <b>{left}</b></>}
    </span>
  );
}
/** The deadline as quiet text after the name. `calm`: the date ("Picks lock Nov 3") until the last 48
 *  hours, when it turns into the countdown. */
function LockInline({ calm }: { calm?: boolean }) {
  const live = useLive();
  const t = useStore((s) => s.t);
  const { left, locked } = useCountdown();
  const soon = LOCK_AT - Date.now() < 48 * 3600e3;
  const date = new Date(LOCK_AT).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <span className={'e-lockin num' + (soon && !locked ? ' soon' : '')}>
      {live ? <><i className="sd live-dot" />{t >= T_MAX ? 'Final results' : 'Live'}</>
        : locked ? 'Picks locked'
        : calm && !soon ? <>Picks lock {date}</>
        : <>Locks in <b>{left}</b></>}
    </span>
  );
}
function LockText() {
  const live = useLive();
  const t = useStore((s) => s.t);
  const { left, locked } = useCountdown();
  return (
    <span className="e-locktext num">
      {live ? <><i className="sd live-dot" />{t >= T_MAX ? 'Final results' : 'Live results'}</> : locked ? 'Picks locked' : <>Picks lock in <b>{left}</b></>}
    </span>
  );
}

/** Election night, first thing in the panel: how your map is doing, in words and marks, not colour. */
function Results() {
  const picks = useStore((s) => s.picks);
  const t = useStore((s) => s.t);
  const sc = liveScore(picks, t);
  const open = ALL.length - sc.called;
  const pct = (n: number) => (n / ALL.length) * 100 + '%';
  return (
    <div className="e-res">
      <span className="e-res-l">Your calls, all races</span>
      <span className="e-res-n num"><b>{sc.correct}</b> right of {sc.called} called</span>
      <span className="e-res-bar" aria-hidden><i className="ok" style={{ width: pct(sc.correct) }} /><i className="no" style={{ width: pct(sc.missed) }} /></span>
      <span className="e-res-k num">
        <span><Icon name="check" size={13} stroke={2.6} />{sc.correct} right</span>
        <span><Icon name="x" size={13} stroke={2.6} />{sc.missed} missed</span>
        <span><i className="ring" />{open} to call</span>
      </span>
    </div>
  );
}

function PanelCard({ rows, label, line, counts }: { rows?: boolean; label?: boolean; line?: boolean; counts?: boolean }) {
  const live = useLive();
  if (live) {
    return (
      <aside className="e-panel v-card is-night">
        <LiveVideo bare />
        <Results />
        <Tabs />
        <Race className="inner e-nightrace" />
      </aside>
    );
  }
  return (
    <aside className="e-panel v-card">
      <Tabs counts={!!counts} />
      <Race className={'inner ' + (rows ? 'e-rows' : 'tiles')} />
      <div className="e-score">{line ? <Score all dots={false} inline /> : <Score all label={!!label} />}</div>
    </aside>
  );
}

const Cards = () => <div className="e-cards"><MapCard /><PanelCard /></div>;
const TallCards = ({ rows, lock, lockFoot, label }: { rows?: boolean; lock?: boolean; lockFoot?: boolean; label?: boolean }) => (
  <div className="e-cards tall"><MapCard title lock={lock} lockFoot={lockFoot} /><PanelCard rows={rows} label={label} /></div>
);

// ---- frames 344:7900 and 352:10368: the name on the map card's control line, the sponsor at its foot
// N1 · 344:7900 exactly: the race as two tiles
function N1() {
  return <div className="v vE"><TallCards /></div>;
}
// N2 · 352:10368 exactly: the race as two rows
function N2() {
  return <div className="v vE"><TallCards rows /></div>;
}
// N3 · tiles, with the deadline back: a chip after the name, on the same control line
function N3() {
  return <div className="v vE"><TallCards lock /></div>;
}
// N4 · rows, with the deadline beside the sponsor at the foot, and the score named
function N4() {
  return <div className="v vE"><TallCards rows lockFoot label /></div>;
}

const Presented = () => (
  <span className="e-pres"><i>Presented by</i><img src={polymarket} alt="Polymarket" width={100} height={18} /></span>
);

/** The deadline as a figure: the time big, what it means under it. On the night: the clock and the count. */
function Deadline({ inline }: { inline?: boolean }) {
  const live = useLive();
  const t = useStore((s) => s.t);
  const picks = useStore((s) => s.picks);
  const { left, locked } = useCountdown();
  if (live) {
    const sc = liveScore(picks, t);
    return (
      <div className={'e-when' + (inline ? ' inline' : '')}>
        <b className="num"><i className="sd live-dot" />{t >= T_MAX ? 'Final' : clock(t) + ' ET'}</b>
        <span className="num">{sc.called} of {ALL.length} races called</span>
      </div>
    );
  }
  return (
    <div className={'e-when' + (inline ? ' inline' : '')}>
      <b className="num">{locked ? 'Locked' : left}</b>
      <span>{locked ? 'Picks are locked' : 'until picks lock'}</span>
    </div>
  );
}

// 1 · the frame exactly, no title
function E1() {
  return <div className="v vE"><Cards /></div>;
}

// 2 · a page header: a stroke under the site nav, then the title and its sponsor on the left line,
//     the deadline as a figure on the right line, then the cards exactly as drawn
function E2() {
  return (
    <div className="v vE rows e2">
      <header className="e-head">
        <div className="e-title"><h1>The Midterms Pick Em</h1><Presented /></div>
        <Deadline />
      </header>
      <Cards />
    </div>
  );
}

// 3 · a second row of the top bar: the page's name sits in the chrome, one stroke under both rows
function E3() {
  return (
    <div className="v vE rows e3">
      <header className="e-row2">
        <b className="e-row2-t">The Midterms Pick Em</b>
        <Presented />
        <Deadline inline />
      </header>
      <Cards />
    </div>
  );
}

// 4 · the sponsor across from the title: the name and the deadline on the left, Polymarket on the right
function E4() {
  return (
    <div className="v vE rows e2 e4">
      <header className="e-head">
        <div className="e-title"><h1>The Midterms Pick Em</h1><Deadline inline /></div>
        <Presented />
      </header>
      <Cards />
    </div>
  );
}

// ---- each part on its own: progress in the tabs, a save per part, what is left at the foot ----------
/** Reset, Autofill and a Save that saves the part on screen ("Save Senate"), then says so. */
function CatActions({ noSave, map }: { noSave?: boolean; map?: boolean }) {
  return <div className="actions"><ResetButton /><AutofillButton />{!noSave && <SaveCat map={map} />}</div>;
}
/** `map`: the frame's words, "Save Map", for the map on screen. Quiet while you are still picking (it
 *  saves what you have if you press it), lit once that map is complete. */
function SaveCat({ map }: { map?: boolean }) {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const savedPicks = useStore((s) => s.savedPicks);
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const saveCat = useStore((s) => s.saveCat);
  const say = useStore((s) => s.say);
  const n = RACES[tab].length;
  const done = RACES[tab].filter((r) => picks[r.id]).length;
  const saved = catSaved(picks, savedPicks, tab);
  const label = TAB_LABEL[tab];
  const ready = map ? done === n : done > 0;
  return (
    <button
      className={'btn save' + (saved ? ' saved' : ready ? ' ready' : done ? ' some' : '')}
      disabled={isLocked()}
      onClick={() => {
        if (!done) return say(`Pick at least one ${label} race to save it`);
        if (saved) return say(`${label} is saved. Change a pick to save again.`);
        if (!user) return openAuth('save');
        saveCat(tab);
        say(done === n ? `${label} saved · all ${n} races` : `${label} saved · ${done} of ${n} picked, ${n - done} left`);
      }}
    >
      {saved ? <><Icon name="check" size={16} stroke={2.4} />{map ? 'Saved' : `${label} saved`}</> : map ? 'Save Map' : `Save ${label}`}
    </button>
  );
}

/** The parts as tabs, each with its own progress. `line`: a thin bar under the name. `count`: 12/35.
 *  `fill`: three equal tabs, each with its bar. A finished part gets a check; a saved one says so. */
function PTabs({ mode }: { mode: 'line' | 'count' | 'fill' }) {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const picks = useStore((s) => s.picks);
  const savedPicks = useStore((s) => s.savedPicks);
  return (
    <div className={'p-tabs ' + mode} role="tablist">
      {TABS.map((k) => {
        const n = RACES[k].length;
        const done = RACES[k].filter((r) => picks[r.id]).length;
        const full = done === n;
        const saved = catSaved(picks, savedPicks, k);
        const on = tab === k;
        return (
          <button key={k} role="tab" aria-selected={on} className={'p-tab' + (on ? ' on' : '') + (full ? ' full' : '') + (saved ? ' saved' : '')} onClick={() => setTab(k)}
            aria-label={`${TAB_LABEL[k]}, ${done} of ${n} picked${saved ? ', saved' : ''}`}>
            {on && <motion.span layoutId="p-tab-hl" className="p-tab-hl" transition={spring} />}
            <span className="p-tab-name">{full && <Icon name="check" size={13} stroke={2.6} />}{TAB_LABEL[k]}</span>
            {mode === 'count' && <span className="p-tab-n num">{done}/{n}</span>}
            {mode !== 'count' && <span className="p-tab-bar"><b style={{ width: (done / n) * 100 + '%' }} /></span>}
          </button>
        );
      })}
    </div>
  );
}

/** The foot of the panel: the part on screen, how far, its races as dots, and what to do next. */
function CatFoot() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const cursor = useStore((s) => s.cursor[s.tab]);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const savedPicks = useStore((s) => s.savedPicks);
  const list = RACES[tab];
  const n = list.length;
  const done = list.filter((r) => picks[r.id]).length;
  const all = ALL.filter((r) => picks[r.id]).length;
  const i = list.findIndex((r) => r.id === cursor);
  const next = [...list.slice(i + 1), ...list.slice(0, Math.max(0, i + 1))].find((r) => !picks[r.id]);
  const other = TABS.filter((k) => k !== tab).map((k) => ({ k, left: RACES[k].filter((r) => !picks[r.id]).length })).find((x) => x.left);
  const saved = catSaved(picks, savedPicks, tab);
  return (
    <div className="c-foot">
      <div className="c-head">
        <span className="c-name">{TAB_LABEL[tab]}</span>
        <span className="c-n num"><b>{done}</b>/{n}</span>
      </div>
      <span className="c-bar"><b style={{ width: (done / n) * 100 + '%' }} /></span>
      <Dots />
      <div className="c-next">
        {done < n ? (
          <>
            <span className="num">{n - done} left</span>
            {next && <button onClick={() => select(next.id)}>Next open: {next.stateName}<Icon name="chevRight" size={14} stroke={2} /></button>}
          </>
        ) : (
          <>
            <span className="c-done"><Icon name="check" size={13} stroke={2.6} />{TAB_LABEL[tab]} complete{saved ? ' · saved' : ''}</span>
            {other ? <button onClick={() => setTab(other.k)}>{TAB_LABEL[other.k]} next<Icon name="chevRight" size={14} stroke={2} /></button> : <span>Every race picked</span>}
          </>
        )}
      </div>
      <div className="c-all num">All races <b>{all}</b>/{ALL.length}</div>
    </div>
  );
}

function CatPanel({ mode }: { mode: 'line' | 'count' | 'fill' }) {
  const live = useLive();
  if (live) return <PanelCard />;
  return (
    <aside className="e-panel v-card">
      <PTabs mode={mode} />
      <Race className="inner tiles" noDone />
      <CatFoot />
    </aside>
  );
}
function Parts({ mode }: { mode: 'line' | 'count' | 'fill' }) {
  return (
    <div className="v vE r big">
      <div className="e-cards tall"><MapCard title lock perCat /><CatPanel mode={mode} /></div>
    </div>
  );
}
const P1 = () => <Parts mode="line" />;
const P2 = () => <Parts mode="count" />;
const P3 = () => <Parts mode="fill" />;
const N3big = () => <div className="v vE big"><TallCards lock /></div>;

// ---- the parts above everything: the choice of Senate, Governor or House sits over both cards -------
// In the look of version 11: the tabs never carry progress (a check once a part is complete, at most),
// and the number, bar and dots at the foot of the panel count only the part on screen. Six tab styles.
type TopMode = 'pill' | 'segment' | 'type' | 'strip' | 'meta' | 'subnav';

function TopTabs({ mode }: { mode: TopMode }) {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const picks = useStore((s) => s.picks);
  const live = useLive();
  // a tablist moves with the arrow keys, Home and End
  const onKey = (e: RKE) => {
    const i = TABS.indexOf(tab);
    const j = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : -1;
    if (j < 0) return;
    e.preventDefault();
    setTab(TABS[j]);
    (e.currentTarget.querySelectorAll('[role=tab]')[j] as HTMLElement)?.focus();
  };
  return (
    <div className={'tt tt-' + mode} role="tablist" aria-label="Parts of the game" onKeyDown={onKey}>
      {TABS.map((k) => {
        const n = RACES[k].length;
        const done = RACES[k].filter((r) => picks[r.id]).length;
        const full = !live && done === n;
        const on = tab === k;
        return (
          <button key={k} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} aria-label={`${TAB_LABEL[k]}, ${done} of ${n} picked`} onClick={() => setTab(k)}
            className={'tt-tab' + (on ? ' on' : '') + (full ? ' full' : '')}>
            {on && mode !== 'type' && <motion.span layoutId={'tt-hl-' + mode} className="tt-hl" transition={spring} />}
            <span className="tt-name">{full && <Icon name="check" size={mode === 'type' ? 16 : 13} stroke={2.6} />}{TAB_LABEL[k]}</span>
            {mode === 'meta' && <span className="tt-meta num">{n} races</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The panel when the parts live above: the race, then the part on screen counted at the foot. */
function RacePanel2({ label = true, className = '' }: { label?: boolean; className?: string }) {
  const live = useLive();
  if (live) {
    return (
      <aside className={'e-panel v-card is-night ' + className}>
        <LiveVideo bare />
        <Results />
        <Race className="inner e-nightrace" />
      </aside>
    );
  }
  return (
    <aside className={'e-panel v-card ' + className}>
      <Race className="inner tiles" noDone />
      <div className="e-score part"><Score label={label} /></div>
    </aside>
  );
}

function Top({ mode }: { mode: TopMode }) {
  return (
    <div className={'v vE r big rows tt-wrap tw-' + mode}>
      {mode === 'subnav' ? <div className="tt-sub"><TopTabs mode={mode} /><LockInline /></div> : <TopTabs mode={mode} />}
      <div className="e-cards tall"><MapCard title lock={mode !== 'subnav'} perCat /><RacePanel2 /></div>
    </div>
  );
}
const T1 = () => <Top mode="pill" />;
const T2 = () => <Top mode="segment" />;
const T3 = () => <Top mode="type" />;
const T4 = () => <Top mode="strip" />;
const T5 = () => <Top mode="meta" />;
const T6 = () => <Top mode="subnav" />;

// ---- the parts fixed in place: a bar at the foot of the window, or a bar across the top ----------
/** Three pills in a floating bar (Figma 363:10879). */
function PartPills({ className = '', vertical }: { className?: string; vertical?: boolean }) {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const picks = useStore((s) => s.picks);
  const live = useLive();
  const onKey = (e: RKE) => {
    const i = TABS.indexOf(tab);
    const fwd = vertical ? 'ArrowDown' : 'ArrowRight', back = vertical ? 'ArrowUp' : 'ArrowLeft';
    const j = e.key === fwd ? (i + 1) % 3 : e.key === back ? (i + 2) % 3 : -1;
    if (j < 0) return;
    e.preventDefault();
    setTab(TABS[j]);
    (e.currentTarget.querySelectorAll('[role=tab]')[j] as HTMLElement)?.focus();
  };
  return (
    <div className={'pp ' + className} role="tablist" aria-orientation={vertical ? 'vertical' : 'horizontal'} aria-label="Parts of the game" onKeyDown={onKey}>
      {TABS.map((k) => {
        const full = !live && RACES[k].every((r) => picks[r.id]);
        const on = tab === k;
        return (
          <button key={k} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className={'pp-tab' + (on ? ' on' : '')} onClick={() => setTab(k)}>
            {on && <motion.span layoutId={'pp-hl-' + className} className="pp-hl" transition={spring} />}
            <span className="pp-name">{full && <Icon name="check" size={12} stroke={2.8} />}{TAB_LABEL[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The part on screen as a number and a bar, for the bottom dock. */
function PartCount() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const n = RACES[tab].length;
  const done = RACES[tab].filter((r) => picks[r.id]).length;
  return (
    <div className="dk-count num">
      <span><b>{done}</b>/{n} {TAB_LABEL[tab]} races picked</span>
      <span className="dk-bar"><b style={{ width: (done / n) * 100 + '%' }} /></span>
    </div>
  );
}

// F1 · Figma 363:10879: the parts float at the foot of the window; the title names the part on screen
function F1() {
  const tab = useStore((s) => s.tab);
  return (
    <div className="v vE r big">
      <div className="e-cards tall"><MapCard title lock perCat nameText={`The ${TAB_LABEL[tab]} Pick Em`} /><RacePanel2 label={false} /></div>
      <PartPills className="float" />
    </div>
  );
}

// F2 · a dock at the foot of the window: the parts, how far the part on screen is, and its save
function F2() {
  const live = useLive();
  return (
    <div className="v vE r big has-dock">
      <div className="e-cards tall"><MapCard title lock perCat noSave /><RacePanel2 label={false} /></div>
      <div className="dock-bar"><PartPills className="dk" />{!live && <><PartCount /><SaveCat /></>}</div>
    </div>
  );
}

// F3 · Figma 369:11423: a bar under the site bar holds the name and the parts; the map is on the page,
//      the panel sits behind a hairline
function F3() {
  return (
    <div className="v vE r big rows fx">
      <div className="fx-head"><div className="fx-title"><h1>The Midterms Pick Em</h1><LockChip /></div><PartPills className="fx" /></div>
      <div className="e-cards tall"><MapCard title perCat noName /><RacePanel2 label={false} /></div>
    </div>
  );
}

// F4 · the same bar across the top, with the two cards of version 11 under it
function F4() {
  return (
    <div className="v vE r big rows fx fx-cards">
      <div className="fx-head"><div className="fx-title"><h1>The Midterms Pick Em</h1><LockChip /></div><PartPills className="fx" /></div>
      <div className="e-cards tall"><MapCard title perCat noName /><RacePanel2 label={false} /></div>
    </div>
  );
}

// F5 · Figma 369:12323: one card holds everything; its first line is the name and the parts
function F5() {
  return (
    <div className="v vE r big rows gx">
      <section className="gx-card">
        <div className="gx-head"><div className="fx-title"><h1>The Midterms Pick Em</h1><LockChip /></div><PartPills className="gx" /></div>
        <div className="e-cards tall"><MapCard title perCat noName /><RacePanel2 label={false} /></div>
      </section>
    </div>
  );
}

// ---- ways to move between the parts, in the look of version 6 ------------------------------------
/** The title is the switch: "The [Senate ▾] Pick Em". */
function TitleSwitch() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const picks = useStore((s) => s.picks);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', off);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', off); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span className="ts" ref={ref}>
      The
      <button className={'ts-btn' + (open ? ' open' : '')} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {TAB_LABEL[tab]}<Icon name="chevDown" size={16} stroke={2.2} />
      </button>
      Pick Em
      {open && (
        <span className="ts-menu" role="listbox" aria-label="Parts of the game">
          {TABS.map((k) => {
            const n = RACES[k].length, done = RACES[k].filter((r) => picks[r.id]).length;
            return (
              <button key={k} role="option" aria-selected={tab === k} className={'ts-opt' + (tab === k ? ' on' : '')} onClick={() => { setTab(k); setOpen(false); }}>
                <b>{TAB_LABEL[k]}</b><span className="num">{done === n ? 'Complete' : `${done} of ${n}`}</span>
                {tab === k && <Icon name="check" size={14} stroke={2.6} />}
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}

// 1 · version 6: pills above the cards
const W1 = () => <Top mode="pill" />;
// 2 · a floating bar at the foot of the window (from Figma 363:10879), the name says the part
const W2 = F1;
// 3 · a segmented control above the cards
const W3 = () => <Top mode="segment" />;
// 4 · the names as big type above the cards
const W4 = () => <Top mode="type" />;
// 5 · a dock under the cards: the parts, how far the part on screen is, and its save
const W5 = F2;
// 6 · the title is the switch: "The Senate Pick Em", Senate opens the other two
function W6() {
  return (
    <div className="v vE r big">
      <div className="e-cards tall"><MapCard title lock perCat nameText={<TitleSwitch />} /><RacePanel2 label={false} /></div>
    </div>
  );
}
// 7 · a rail on the left: the parts stacked beside the cards
function W7() {
  return (
    <div className="v vE r big w-rail">
      <PartPills className="rail" vertical />
      <div className="e-cards tall"><MapCard title lock perCat /><RacePanel2 label={false} /></div>
    </div>
  );
}

// ---- navigation that shows what each part is: a small map per part --------------------------------
const US = us.states as Record<string, string>;
const STATES = Object.keys(US);
const PART_STATES: Record<Tab, Record<string, string>> = Object.fromEntries(TABS.map((k) => [k, Object.fromEntries(RACES[k].map((r) => [r.state, r.id]))])) as Record<Tab, Record<string, string>>;

/** The part as a little map: its states lit, the ones you picked in your colours, the rest of the
 *  country in shadow. It reads "this is the Senate board" and "this much of it is filled" at once. */
/** `labels`: the big map's initials too, at the same scale, as in the frame. */
function MiniMap({ k, className = '', labels }: { k: Tab; className?: string; labels?: boolean }) {
  const picks = useStore((s) => s.picks);
  const auto = useStore((s) => s.auto);
  const live = useLive();
  const t = useStore((s) => s.t);
  const own = PART_STATES[k];
  const look = (st: string) => {
    const id = own[st];
    if (!id) return 'no';
    const p = picks[id];
    if (!live) return p ? p + (auto[id] ? ' af' : '') : 'open';
    return statusAt(id, t).status === 'called' ? (p === RESULTS[id].winner ? RESULTS[id].winner : 'miss') : 'open';
  };
  const cls = Object.fromEntries(STATES.map((st) => [st, look(st)]));
  return (
    <svg className={'mm ' + className} viewBox={us.viewBox} aria-hidden preserveAspectRatio="xMidYMid meet">
      {STATES.map((st) => <path key={st} d={US[st]} className={cls[st]} />)}
      {labels && (
        <g className="mm-lb">
          {LABELED.map(([st, x, y]) => (
            <text key={st} x={x} y={y} fontSize={us.labelSize} textAnchor="middle" dominantBaseline="central" className={/^[RD]/.test(cls[st]) ? 'on' : undefined}>{st}</text>
          ))}
        </g>
      )}
    </svg>
  );
}
const LABELED = Object.entries(us.labels as Record<string, number[]>).map(([st, [x, y]]) => [st, x, y] as const);

function usePartStatus(k: Tab) {
  const picks = useStore((s) => s.picks);
  const savedPicks = useStore((s) => s.savedPicks);
  const live = useLive();
  const t = useStore((s) => s.t);
  const n = RACES[k].length;
  const done = RACES[k].filter((r) => picks[r.id]).length;
  if (live) { const sc = liveScore(picks, t, k); return { n, done, word: `${sc.correct} of ${sc.called} right` }; }
  const saved = catSaved(picks, savedPicks, k);
  return { n, done, word: done === n ? (saved ? 'Complete · saved' : 'Complete') : saved ? 'Saved' : done ? 'In progress' : `${n} races` };
}

function MapTabs({ look, named, labels }: { look: 'tiles' | 'chips' | 'folder' | 'rail'; named?: boolean; labels?: boolean }) {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const onKey = (e: RKE) => {
    const i = TABS.indexOf(tab);
    const v = look === 'rail';
    const j = e.key === (v ? 'ArrowDown' : 'ArrowRight') ? (i + 1) % 3 : e.key === (v ? 'ArrowUp' : 'ArrowLeft') ? (i + 2) % 3 : -1;
    if (j < 0) return;
    e.preventDefault();
    setTab(TABS[j]);
    (e.currentTarget.querySelectorAll('[role=tab]')[j] as HTMLElement)?.focus();
  };
  return (
    <div className={'mt mt-' + look} role="tablist" aria-orientation={look === 'rail' ? 'vertical' : 'horizontal'} aria-label="Parts of the game" onKeyDown={onKey}>
      {TABS.map((k) => <MapTab key={k} k={k} on={tab === k} look={look} named={named} labels={labels} onClick={() => setTab(k)} />)}
    </div>
  );
}
function MapTab({ k, on, look, named, labels, onClick }: { k: Tab; on: boolean; look: string; named?: boolean; labels?: boolean; onClick: () => void }) {
  const { n, done, word } = usePartStatus(k);
  return (
    <button role="tab" aria-selected={on} tabIndex={on ? 0 : -1} aria-label={`${TAB_LABEL[k]}, ${done} of ${n} picked`} onClick={onClick}
      className={'mt-tab' + (on ? ' on' : '') + (done === n ? ' full' : '')}>
      {on && look !== 'folder' && <motion.span layoutId={'mt-hl-' + look} className="mt-hl" transition={spring} />}
      <MiniMap k={k} labels={labels} />
      <span className="mt-t">
        <b>{TAB_LABEL[k]}{named && on ? ' Pick Em' : ''}</b>
        {look !== 'chips' && <small>{word}</small>}
        {named && on && <ZzLock />}
      </span>
    </button>
  );
}

function Boards({ look }: { look: 'tiles' | 'chips' | 'folder' }) {
  const tab = useStore((s) => s.tab);
  return (
    <div className={'v vE r big rows mtw mtw-' + look + ' sel-' + TABS.indexOf(tab)}>
      <MapTabs look={look} />
      <div className="e-cards tall"><MapCard title lock perCat /><RacePanel2 label={false} /></div>
    </div>
  );
}
// 1 · three boards across the top: each part's map in small, its name, and one word on where it stands
const M1 = () => <Boards look="tiles" />;
// 2 · the same idea, compact: a small map beside each name
const M2 = () => <Boards look="chips" />;
// 3 · folder tabs: the chosen part is the same surface as the map card, so the board below is visibly its
const M3 = () => <Boards look="folder" />;

// ---- Figma 375:13018, completed: one card, the three boards down the left, the name of the part on
// screen centred over the map, the race and its count on the right. Added what the frame left out:
// how to play, the deadline, and the name and state of each board.
/** Under the centred name: the deadline, or on the night the clock and the count. */
function ZzLock() {
  const live = useLive();
  const t = useStore((s) => s.t);
  const picks = useStore((s) => s.picks);
  const { left, locked } = useCountdown();
  if (live) {
    const sc = liveScore(picks, t);
    return <p className="zz-lock num"><i className="sd live-dot" />{t >= T_MAX ? 'Final results' : `Live · ${clock(t)} ET · ${sc.called} of ${ALL.length} called`}</p>;
  }
  return <p className="zz-lock num">{locked ? 'Picks are locked' : <>Picks lock in <b>{left}</b></>}</p>;
}
function OneCard() {
  const tab = useStore((s) => s.tab);
  const live = useLive();
  return (
    <div className="v vE r big zz-wrap">
      <section className="zz">
        <MapTabs look="rail" />
        <div className="zz-help"><HelpButton /></div>
        <header className="zz-title">
          <h1>{TAB_LABEL[tab]} Pick Em</h1>
          <ZzLock />
        </header>
        <div className="zz-act">{live ? <Foot /> : <CatActions />}</div>
        <MapBox />
        <div className="zz-pres"><Presented /></div>
        <aside className="zz-side">
          {live ? (
            <>
              <LiveVideo bare />
              <Results />
              <Race className="inner e-nightrace zz-race" />
            </>
          ) : (
            <>
              <Race className="zz-race" noDone />
              <div className="e-score part"><Score label={false} /></div>
            </>
          )}
        </aside>
        <div className="zz-legend"><Legend /></div>
      </section>
    </div>
  );
}

// ---- ten placements for the title, the help and the sponsor around the one-card layout -------------
// The board stays the same: the three small maps down the left, the map, the race and its count on the
// right. What moves is where the page says its name, how to play, the deadline and who presents it.
type Slot = ReactNode;
type ZCfg = {
  cls?: string; railTop?: Slot; railFoot?: Slot; tl?: Slot; tc?: Slot; trBefore?: Slot; trAfter?: Slot;
  bc?: Slot; bl?: Slot; sideTop?: Slot; sideFoot?: Slot; head?: Slot; foot?: Slot; named?: boolean; legendInFoot?: boolean;
};
const ZTitle = ({ size }: { size?: 'big' | 'small' }) => { const tab = useStore((s) => s.tab); return <h1 className={'zt' + (size ? ' ' + size : '')}>{TAB_LABEL[tab]} Pick Em</h1>; };
const ZEyebrow = () => { const tab = useStore((s) => s.tab); return <div className="zeb"><span>The Midterms Pick Em</span><h1>{TAB_LABEL[tab]}</h1></div>; };
function HelpLink() {
  const setTour = useStore((s) => s.setTour);
  return <button className="zhelp" onClick={() => setTour(0)}><Icon name="help" size={16} stroke={1.8} />How to play</button>;
}
function LockMini() {
  const live = useLive();
  const { left, locked } = useCountdown();
  if (live) return null;
  return <span className="zlockmini num">{locked ? 'Locked' : <><b>{left}</b> left</>}</span>;
}

function ZV(c: ZCfg) {
  const live = useLive();
  return (
    <div className={'v vE r big zz-wrap'}>
      <section className={'zz zz2 ' + (c.cls ?? '')}>
        {c.head && <div className="z-head">{c.head}</div>}
        <div className="z-rail">
          {c.railTop && <div className="z-railtop">{c.railTop}</div>}
          <MapTabs look="rail" named={c.named} />
          {c.railFoot && <div className="z-railfoot">{c.railFoot}</div>}
        </div>
        {c.tl && <div className="z-tl">{c.tl}</div>}
        {c.tc && <div className="z-tc">{c.tc}</div>}
        <div className="z-tr">{c.trBefore}{live ? <Foot /> : <CatActions />}{c.trAfter}</div>
        <MapBox />
        {c.bc && <div className="z-bc">{c.bc}</div>}
        {c.bl && <div className="z-bl">{c.bl}</div>}
        <aside className="zz-side z-side">
          {c.sideTop && <div className="z-sidetop">{c.sideTop}</div>}
          {live ? (
            <><LiveVideo bare /><Results /><Race className="inner e-nightrace zz-race" /></>
          ) : (
            <><Race className="zz-race" noDone /><div className="e-score part"><Score label={false} /></div></>
          )}
          {c.sideFoot && <div className="z-sidefoot">{c.sideFoot}</div>}
        </aside>
        {c.foot ? <div className="z-foot">{c.foot}{c.legendInFoot && <Legend />}</div> : null}
        {!c.legendInFoot && <div className="zz-legend"><Legend /></div>}
      </section>
    </div>
  );
}

// 6 · the left column is the game: its name and deadline on top, the boards, how to play and the sponsor at the foot
const Z1 = () => <ZV cls="z-a" railTop={<><ZTitle size="small" /><ZzLock /></>} railFoot={<><HelpLink /><Presented /></>} />;
// 7 · the board on screen is the headline: "The Midterms Pick Em" small over a big "Senate"
const Z2 = () => <ZV cls="z-b" tl={<><HelpButton /><ZEyebrow /></>} bc={<Presented />} sideTop={<ZzLock />} />;
// 8 · a header line across the card: the name and the deadline on the left, how to play and the actions on the right
const Z3 = () => <ZV cls="z-c hdr" head={<><div className="z-hl"><ZTitle /><ZzLock /></div></>} trBefore={<HelpButton />} railFoot={<Presented />} />;
// 9 · the right column opens with the name, the deadline and the sponsor; the map keeps only its controls
const Z4 = () => <ZV cls="z-d" sideTop={<><ZTitle size="small" /><ZzLock /><Presented /></>} tl={<HelpButton />} />;
// 10 · a foot line across the card: how to play on the left, the sponsor in the middle, the legend on the right
const Z5 = () => <ZV cls="z-e ftr" tc={<><ZTitle /><ZzLock /></>} foot={<><HelpLink /><Presented /></>} legendInFoot />;
// 11 · the name on the left over the map, the deadline and "How to play" on one line under it
const Z6 = () => <ZV cls="z-f" tl={<div className="z-stack"><ZTitle /><div className="z-sub"><ZzLock /><span className="z-sep" /><HelpLink /></div></div>} bl={<Presented />} />;
// 12 · the sponsor sits under the name, as a title block; how to play joins the actions
const Z7 = () => <ZV cls="z-g" tc={<><ZTitle /><Presented /><ZzLock /></>} trBefore={<HelpButton />} />;
// 13 · the name tops the boards, the sponsor closes the right column, how to play stays by the map
const Z8 = () => <ZV cls="z-h" railTop={<><ZTitle size="small" /><ZzLock /></>} tl={<HelpButton />} sideFoot={<Presented />} />;
// 14 · the deadline goes where it matters, beside Save; the name centred alone
const Z9 = () => <ZV cls="z-i" tc={<ZTitle />} tl={<HelpButton />} bc={<Presented />} trAfter={null} trBefore={<LockMini />} />;
// 15 · the chosen board carries the name and the deadline; how to play and the sponsor close the left column
const Z10 = () => <ZV cls="z-j" named railFoot={<><HelpLink /><Presented /></>} />;

// ---- the one -----------------------------------------------------------------------------------
// Everything the rounds taught, in one screen. One card. The three boards down the left, each a small
// map of its races with your picks in it. The map in the middle, never under anything. The race and the
// count of the board on screen on the right. Over the map, instead of a name, a line that says what to
// do now and changes as you play; how to play sits inside it. Polymarket at the foot, on the same axis.
const NOUN: Record<Tab, string> = { senate: 'Senate', gov: 'governor', house: 'House' };

/** The guiding line: what to do now, how much is left, the deadline, and how to play. */
function Guide() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const savedPicks = useStore((s) => s.savedPicks);
  const setTab = useStore((s) => s.setTab);
  const setTour = useStore((s) => s.setTour);
  const live = useLive();
  const t = useStore((s) => s.t);
  const { left: until, locked } = useCountdown();
  const soon = LOCK_AT - Date.now() < 48 * 3600e3;
  const label = TAB_LABEL[tab];
  const n = RACES[tab].length;
  const done = RACES[tab].filter((r) => picks[r.id]).length;
  const saved = catSaved(picks, savedPicks, tab);
  const others = TABS.filter((k) => k !== tab).map((k) => ({ k, open: RACES[k].filter((r) => !picks[r.id]).length, saved: catSaved(picks, savedPicks, k) }));
  const next = others.find((x) => x.open);
  const unsaved = others.find((x) => !x.saved);
  const allSaved = TABS.every((k) => RACES[k].every((r) => picks[r.id]) && catSaved(picks, savedPicks, k));

  let head: string;
  let state: ReactNode;
  if (live) {
    const sc = liveScore(picks, t, tab);
    head = `Your ${NOUN[tab]} calls`;
    state = <><i className="sd live-dot" />{t >= T_MAX ? 'Final results' : `Live · ${clock(t)} ET`} · {sc.correct} of {sc.called} right so far</>;
  } else if (allSaved) {
    head = 'Your map is done';
    state = 'Come back on election night to see how you did';
  } else if (done === n && saved) {
    head = `${label} is saved`;
    state = next
      ? <button className="g-next" onClick={() => setTab(next.k)}>{TAB_LABEL[next.k]} is next, {next.open} {next.open === 1 ? 'race' : 'races'} left<Icon name="chevRight" size={14} stroke={2.2} /></button>
      : unsaved
        ? <button className="g-next" onClick={() => setTab(unsaved.k)}>{TAB_LABEL[unsaved.k]} still needs saving<Icon name="chevRight" size={14} stroke={2.2} /></button>
        : 'Every race is picked';
  } else if (done === n) {
    head = `${label} is complete`;
    state = 'Save it to keep your picks';
  } else {
    head = `Call every ${NOUN[tab]} race`;
    state = done ? <><b className="num">{n - done}</b> left</> : <>Pick a winner in each of the <span className="num">{n}</span> races</>;
  }
  return (
    <header className="g">
      <h1>{head}</h1>
      <p className="g-sub">
        <span className="g-state">{state}</span>
        {!live && !allSaved && <><i className="g-dot" /><span className={'g-lock num' + (soon && !locked ? ' soon' : '')}>{locked ? 'Picks are locked' : <>Picks lock in <b>{until}</b></>}</span></>}
        <i className="g-dot" />
        <button className="g-help" onClick={() => setTour(0)}><Icon name="help" size={15} stroke={1.9} />How to play</button>
      </p>
    </header>
  );
}

function Best() {
  const live = useLive();
  return (
    <div className="v vE r big zz-wrap bx-wrap">
      <section className="zz bx">
        <div className="z-rail"><MapTabs look="rail" /></div>
        <Guide />
        <div className="bx-act">{live ? <Foot /> : <CatActions />}</div>
        <MapBox />
        <aside className="zz-side bx-side">
          {live ? (
            <><LiveVideo bare /><Results /><Race className="inner e-nightrace zz-race" /></>
          ) : (
            <><Race className="zz-race" noDone /><div className="e-score part"><Score label={false} /></div></>
          )}
        </aside>
        <div className="bx-pres"><Presented /></div>
        <div className="zz-legend"><Legend /></div>
      </section>
    </div>
  );
}

// ---- ten refinements of N3 (tiles, the deadline after the name) ------------------------------------
// Same layout every time. Each one takes noise out of one place; the last puts the quietest together.
type R = { cls: string; lock?: 'timer' | 'date'; line?: boolean; counts?: boolean };
function Refined({ cls, lock = 'timer', line, counts }: R) {
  return (
    <div className={'v vE r ' + cls}>
      <div className="e-cards tall"><MapCard title lockText={lock} /><PanelCard line={line} counts={counts} /></div>
    </div>
  );
}
const R1 = () => <Refined cls="" />;
const R2 = () => <Refined cls="r-ghost" />;
const R3 = () => <Refined cls="r-flat" />;
const R4 = () => <Refined cls="r-quiet" />;
const R5 = () => <Refined cls="r-lined" line />;
const R6 = () => <Refined cls="r-lined" line counts />;
const R7 = () => <Refined cls="" lock="date" />;
const R8 = () => <Refined cls="r-ghost r-flat" />;
const R9 = () => <Refined cls="r-air" />;
const R10 = () => <Refined cls="r-ghost r-flat r-quiet r-lined" line lock="date" />;

// ---- Figma 375:13018 as drawn on Oct 8 ------------------------------------------------------------
// One card. The three maps down the left. Over the big map, on the card's centre line (the page's and
// the logo's), the name with how to play beside it and the deadline under it. The actions top right.
// Down the right, two surfaces: the race, then the count of the map on screen with the legend inside
// it. Polymarket at the foot, on the centre line again.

/** The name, how to play beside it, the deadline under it. On the night: the clock and the count. */
function FzHead() {
  const live = useLive();
  const t = useStore((s) => s.t);
  const picks = useStore((s) => s.picks);
  const setTour = useStore((s) => s.setTour);
  const { left, locked } = useCountdown();
  const sc = live ? liveScore(picks, t) : null;
  return (
    <header className="fz-head">
      <div className="fz-name">
        <h1>The Midterms Pick Em</h1>
        <button className="fz-help" aria-label="How to play" onClick={() => setTour(0)}><Icon name="help" size={20} stroke={1.44} /></button>
      </div>
      <p className="fz-lock num">
        {sc ? <><i className="sd live-dot" />{t >= T_MAX ? 'Final results' : <>Live · <b>{clock(t)} ET</b> · {sc.called} of {ALL.length} called</>}</>
          : locked ? 'Picks are locked' : <>Lock in <b>{left}</b></>}
      </p>
    </header>
  );
}

function Fz() {
  const live = useLive();
  return (
    <div className="v vE big zz-wrap fz-wrap">
      <section className="zz fz">
        <MapTabs look="rail" labels />
        <FzHead />
        {/* on the night the picks are locked, so the show takes the actions' corner */}
        <div className="fz-act">{live ? <LiveVideo bare /> : <CatActions map />}</div>
        <MapBox />
        <aside className="fz-side">
          <Race className="fz-race" noDone />
          <div className="fz-score"><Score dots={!live} /><Legend /></div>
        </aside>
        {live && <div className="fz-tl"><Foot /></div>}
        <div className="fz-pres"><Presented /></div>
      </section>
    </div>
  );
}

// The frame takes 1; every other version keeps the number it had, and the guiding line moves to the end.
const ALL_V = [Fz, OneCard, M1, M2, M3, W1, Z1, Z2, Z3, Z4, Z5, Z6, Z7, Z8, Z9, Z10, Best];
export default function Layout({ n }: { n: number }) {
  const V = ALL_V[n - 1] ?? Fz;
  const live = useLive();
  return <div className={'v-wrap' + (live ? ' night' : '')}><V /></div>;
}

// P7 builds its dashboards out of the same pieces.
export { MapTabs, MapCard, RacePanel2, Race, Score, Dots, MiniMap, usePartStatus, CatActions, SaveCat, Presented, LiveVideo, Results, HelpButton, LockChip, MapBox, Foot };
