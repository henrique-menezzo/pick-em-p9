// P7 · ten dashboards on top of P6's version 5 (the folder tabs with a small map, joined to the map
// card). The game stays where it was: the map, the race, the actions. What each version adds is a way to
// see, at a glance, what is filled in and what is not, the way a good product dashboard does (Linear's
// lists and sidebar, Brex's summary tiles and setup checklist).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ALL, BY_ID, RACES, RESULTS, TAB_LABEL, TABS, type Race, type Tab } from '../data/races';
import { AUTO_NAME, catSaved, liveScore, useStore } from '../lib/store';
import { useCountdown } from './LockLine';
import { CandidateRow, Face, Flag, Icon } from './ui';
import { CatActions, Foot, LiveVideo, MapBox, MapTabs, MiniMap, Presented, Race as RaceCard } from './Layouts';
import { Legend } from '../App';

const useLive = () => useStore((s) => s.live);
const NOUN: Record<Tab, string> = { senate: 'Senate', gov: 'governor', house: 'House' };
const REGIONS = ['Northeast', 'South', 'Midwest', 'West'] as const;

// ---- numbers ----------------------------------------------------------------------------------------
type Part = { k: Tab; n: number; R: number; D: number; done: number; open: number; saved: boolean; right: number; missed: number; called: number };
function usePart(k: Tab): Part {
  const picks = useStore((s) => s.picks);
  const savedPicks = useStore((s) => s.savedPicks);
  const t = useStore((s) => s.t);
  const list = RACES[k];
  const R = list.filter((r) => picks[r.id] === 'R').length;
  const D = list.filter((r) => picks[r.id] === 'D').length;
  const sc = liveScore(picks, t, k);
  return { k, n: list.length, R, D, done: R + D, open: list.length - R - D, saved: catSaved(picks, savedPicks, k), right: sc.correct, missed: sc.missed, called: sc.called };
}
function useTotal() {
  const picks = useStore((s) => s.picks);
  const t = useStore((s) => s.t);
  const R = ALL.filter((r) => picks[r.id] === 'R').length;
  const D = ALL.filter((r) => picks[r.id] === 'D').length;
  const sc = liveScore(picks, t);
  return { n: ALL.length, R, D, done: R + D, open: ALL.length - R - D, right: sc.correct, missed: sc.missed, called: sc.called };
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** A race's state in words and in a mark. On the night: called right, missed, or still out. */
function useRowState(r: Race) {
  const pick = useStore((s) => s.picks[r.id]);
  const live = useLive();
  const t = useStore((s) => s.t);
  if (live) {
    const called = t >= RESULTS[r.id].call;
    const w = RESULTS[r.id].winner;
    if (!called) return { mark: 'wait', word: pick ? `Your pick: ${pick === 'R' ? 'Rep.' : 'Dem.'}` : 'No pick', pick };
    if (!pick) return { mark: 'none', word: `${w === 'R' ? 'Rep.' : 'Dem.'} won`, pick };
    return pick === w ? { mark: 'right', word: 'Called right', pick } : { mark: 'miss', word: 'Missed', pick };
  }
  return { mark: pick ?? 'open', word: pick ? (pick === 'R' ? 'Republican' : 'Democrat') : 'Open', pick };
}

// ---- small parts --------------------------------------------------------------------------------------
/** Republican, Democrat and open as one bar, with the numbers said out loud for screen readers. */
function Split({ R, D, n, thin }: { R: number; D: number; n: number; thin?: boolean }) {
  return (
    <span className={'dx-split' + (thin ? ' thin' : '')} role="img" aria-label={`${R} Republican, ${D} Democrat, ${n - R - D} open`}>
      <i className="r" style={{ width: (R / n) * 100 + '%' }} />
      <i className="d" style={{ width: (D / n) * 100 + '%' }} />
    </span>
  );
}
/** Night: right, missed, still out. */
function NightSplit({ right, missed, n }: { right: number; missed: number; n: number }) {
  return (
    <span className="dx-split" role="img" aria-label={`${right} right, ${missed} missed, ${n - right - missed} to call`}>
      <i className="ok" style={{ width: (right / n) * 100 + '%' }} />
      <i className="no" style={{ width: (missed / n) * 100 + '%' }} />
    </span>
  );
}
function PartBar({ p }: { p: Part }) {
  return useLive() ? <NightSplit right={p.right} missed={p.missed} n={p.n} /> : <Split R={p.R} D={p.D} n={p.n} />;
}

/** Where a part stands, in one or two words, always with a mark so it never rests on colour. */
function Status({ p }: { p: Part }) {
  if (useLive()) return <span className="dx-status"><span className="num">{p.right} of {p.called}</span> right</span>;
  if (p.done === p.n && p.saved) return <span className="dx-status ok"><Icon name="check" size={12} stroke={2.6} />Saved</span>;
  if (p.done === p.n) return <span className="dx-status todo"><i />Not saved</span>;
  if (p.saved) return <span className="dx-status ok"><Icon name="check" size={12} stroke={2.6} />Saved, {p.open} open</span>;
  if (p.done) return <span className="dx-status"><i className="half" />In progress</span>;
  return <span className="dx-status"><i className="ring" />Not started</span>;
}

/** The mark at the head of a race row. */
function Mark({ m }: { m: string }) {
  if (m === 'R' || m === 'D') return <span className={'dx-mark ' + m} aria-hidden>{m}</span>;
  if (m === 'right') return <span className="dx-mark ok" aria-hidden><Icon name="check" size={11} stroke={3} /></span>;
  if (m === 'miss') return <span className="dx-mark no" aria-hidden><Icon name="x" size={11} stroke={3} /></span>;
  return <span className={'dx-mark ' + (m === 'wait' ? 'wait' : 'open')} aria-hidden />;
}

/** One race as a row: the mark, the state, the two names, what you picked. Click it to open it. */
function Row({ r, dense }: { r: Race; dense?: boolean }) {
  const select = useStore((s) => s.select);
  const cur = useStore((s) => s.cursor[s.tab]);
  const { mark, word } = useRowState(r);
  return (
    <button className={'dx-row' + (r.id === cur ? ' on' : '') + (dense ? ' dense' : '')} onClick={() => select(r.id)} aria-current={r.id === cur ? 'true' : undefined}>
      <Mark m={mark} />
      <span className="dx-row-st">{r.stateName}</span>
      {!dense && <span className="dx-row-who">{r.R.split(' ').pop()} v {r.D.split(' ').pop()}</span>}
      <span className={'dx-row-pick' + (mark === 'open' ? ' open' : '')}>{word}</span>
    </button>
  );
}

type Filter = 'open' | 'picked' | 'all';
/** The races of the part on screen as a list you can filter: open first, like a to-do list. */
function RaceList({ title, start = 'open', dense }: { title?: string; start?: Filter; dense?: boolean }) {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const live = useLive();
  const [f, setF] = useState<Filter>(start);
  const list = RACES[tab];
  const open = list.filter((r) => !picks[r.id]);
  const picked = list.filter((r) => picks[r.id]);
  const rows = live ? list : f === 'open' ? open : f === 'picked' ? picked : list;
  return (
    <section className="dx-list" aria-label={title ?? `${TAB_LABEL[tab]} races`}>
      <div className="dx-list-head">
        {title && <h2 className="dx-h">{title}</h2>}
        {!live && (
          <div className="dx-seg" role="group" aria-label="Show">
            {([['open', 'Open', open.length], ['picked', 'Picked', picked.length], ['all', 'All', list.length]] as const).map(([k, l, c]) => (
              <button key={k} aria-pressed={f === k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l} <span className="num">{c}</span></button>
            ))}
          </div>
        )}
      </div>
      <div className="dx-scroll">
        {rows.length ? rows.map((r) => <Row key={r.id} r={r} dense={dense} />) : <p className="dx-empty"><Icon name="check" size={14} stroke={2.6} /> Every {NOUN[tab]} race is picked.</p>}
      </div>
    </section>
  );
}

/** The map side of the one card (Figma, Oct 9): the name with how to play beside it and the deadline
 *  under it, the actions on the right, the map, Polymarket and the legend at the foot. */
function DxMap({ noSave }: { noSave?: boolean }) {
  const live = useLive();
  const t = useStore((s) => s.t);
  const picks = useStore((s) => s.picks);
  const setTour = useStore((s) => s.setTour);
  const { left, locked } = useCountdown();
  const sc = live ? liveScore(picks, t) : null;
  return (
    <section className="e-map dx-map">
      <header className="dx-mhead">
        <div className="dx-mname"><h1>The Midterms Pick Em</h1><button className="dx-help" aria-label="How to play" onClick={() => setTour(0)}><Icon name="help" size={20} stroke={1.44} /></button></div>
        <p className="dx-mlock num">{sc ? <><i className="sd live-dot" />Live · {sc.called} of {ALL.length} called</> : locked ? 'Picks are locked' : <>Lock in <b>{left}</b></>}</p>
      </header>
      <div className="dx-mact">{live ? <Foot /> : <CatActions noSave={noSave} />}</div>
      <MapBox />
      <div className="dx-mfoot"><Presented /><Legend /></div>
    </section>
  );
}

/** A count on its own card: the part on screen, or the whole map. */
function CountCard({ all }: { all?: boolean }) {
  const tab = useStore((s) => s.tab);
  const p = usePart(tab);
  const s = useTotal();
  const live = useLive();
  const v = all ? (live ? s.right : s.done) : live ? p.right : p.done;
  const of = all ? (live ? s.called : s.n) : live ? p.called : p.n;
  const n = all ? s.n : p.n;
  const label = (all ? 'Total' : TAB_LABEL[tab]) + (live ? ' called right' : ' picks');
  return (
    <div className="dx-card dx-count">
      <span className="dx-count-l">{label}</span>
      <span className="dx-count-n num"><b>{v}</b> /{of}</span>
      <span className="dx-count-bar" aria-hidden><i style={{ width: (v / n) * 100 + '%' }} /></span>
    </div>
  );
}

/** The right side of the one card: the race on its own card, then this version's module on another
 *  (or the two counts, as in the Figma). On the night: the show, the score, the race being counted. */
function Side({ children, cls = '', noRace, partOnly, before, after, bare }: { children?: ReactNode; cls?: string; noRace?: boolean; partOnly?: boolean; before?: ReactNode; after?: ReactNode; bare?: boolean }) {
  const live = useLive();
  if (live && !noRace) {
    return (
      <aside className="e-panel dx-side night">
        <div className="dx-card flat"><LiveVideo bare /></div>
        <div className="dx-card grow"><RaceCard className="inner e-nightrace dx-race" /></div>
      </aside>
    );
  }
  return (
    <aside className={'e-panel dx-side ' + cls}>
      {!noRace && <div className="dx-card"><RaceCard className="inner dx-race" noDone /></div>}
      {before}
      {children ? <div className="dx-card grow">{children}</div> : bare ? null : <><CountCard />{!partOnly && <CountCard all />}</>}
      {after}
    </aside>
  );
}

/** P6 version 5: the folder tabs over the map card and the panel. `top` sits above the tabs. */
function Base({ cls, top, side, tabs = true }: { cls: string; top?: ReactNode; side?: ReactNode; tabs?: boolean }) {
  const tab = useStore((s) => s.tab);
  return (
    <div className={'v vE r big rows mtw mtw-folder dx ' + cls + ' sel-' + TABS.indexOf(tab)}>
      {top}
      {tabs && <MapTabs look="folder" />}
      <div className="e-cards tall dx-one"><DxMap />{side ?? <Side />}</div>
    </div>
  );
}

// ---- 1 · summary tiles as the tabs (Brex's account tiles) ----------------------------------------------
function TilesTab({ k }: { k: Tab }) {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const p = usePart(k);
  const on = tab === k;
  return (
    <button role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className={'dx-tile' + (on ? ' on' : '')} onClick={() => setTab(k)}>
      <span className="dx-tile-top"><b>{TAB_LABEL[k]}</b><Status p={p} /></span>
      <span className="dx-tile-n num"><b>{useLive() ? p.right : p.done}</b>/{useLive() ? p.called : p.n}</span>
      <PartBar p={p} />
    </button>
  );
}
function TotalTile() {
  const s = useTotal();
  const live = useLive();
  const { left } = useCountdown();
  return (
    <div className="dx-tile total">
      <span className="dx-tile-top"><b>Your map</b><span className="dx-status">{live ? 'Election night' : <>Locks in <span className="num">{left.split(' ')[0]}</span></>}</span></span>
      <span className="dx-tile-n num"><b>{live ? s.right : s.done}</b>/{live ? s.called : s.n}</span>
      {live ? <NightSplit right={s.right} missed={s.missed} n={s.n} /> : <Split R={s.R} D={s.D} n={s.n} />}
    </div>
  );
}
function TilesRow() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const j = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : -1;
    if (j < 0) return;
    e.preventDefault();
    setTab(TABS[j]);
    (e.currentTarget.querySelectorAll('[role=tab]')[j] as HTMLElement)?.focus();
  };
  return (
    <div className="dx-tiles">
      <TotalTile />
      <div className="dx-tiles-tabs" role="tablist" aria-label="Parts of the game" onKeyDown={onKey}>{TABS.map((k) => <TilesTab key={k} k={k} />)}</div>
    </div>
  );
}
const D1 = () => <Base cls="dx1" tabs={false} top={<TilesRow />} side={<Side partOnly />} />;

// ---- 2 · the open races as a list under the race (Linear's issue list) --------------------------------
const D2 = () => <Base cls="dx2" side={<Side cls="list"><RaceList dense /></Side>} />;

// ---- 3 · an app shell: a sidebar with the parts and their counts (Linear's sidebar) -------------------
function SideNav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const live = useLive();
  const s = useTotal();
  const { left, locked } = useCountdown();
  return (
    <nav className="dx-nav v-card" aria-label="Parts of the game">
      <p className="dx-nav-kick">Your map</p>
      <p className="dx-nav-big num"><b>{live ? s.right : s.done}</b> of {live ? s.called : s.n}</p>
      {live ? <NightSplit right={s.right} missed={s.missed} n={s.n} /> : <Split R={s.R} D={s.D} n={s.n} thin />}
      <ul>
        {TABS.map((k) => <NavItem key={k} k={k} on={tab === k} onClick={() => setTab(k)} />)}
      </ul>
      {!live && <NavNext />}
      <p className="dx-nav-foot">{live ? 'Results are coming in' : locked ? 'Picks are locked' : <>Picks lock in <b className="num">{left}</b></>}</p>
    </nav>
  );
}
/** Under the parts, the next few open races of the one on screen, like a saved view. */
function NavNext() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const open = RACES[tab].filter((r) => !picks[r.id]);
  if (!open.length) return null;
  return (
    <section className="dx-nav-next" aria-label="Up next">
      <h2 className="dx-h">Up next <span className="num">{open.length} open</span></h2>
      {open.slice(0, 4).map((r) => <Row key={r.id} r={r} dense />)}
    </section>
  );
}
function NavItem({ k, on, onClick }: { k: Tab; on: boolean; onClick: () => void }) {
  const p = usePart(k);
  const live = useLive();
  return (
    <li>
      <button className={'dx-nav-item' + (on ? ' on' : '')} aria-current={on ? 'page' : undefined} onClick={onClick}>
        <MiniMap k={k} />
        <span className="dx-nav-t"><b>{TAB_LABEL[k]}</b><Status p={p} /></span>
        <span className="dx-nav-n num">{live ? p.right : p.done}/{live ? p.called : p.n}</span>
      </button>
    </li>
  );
}
function D3() {
  return (
    <div className="v vE r big dx dx3">
      <SideNav />
      <div className="e-cards tall dx-one"><DxMap /><Side partOnly /></div>
    </div>
  );
}

// ---- 4 · a summary banner across the top: one sentence and one bar for the whole map (Brex overview) ---
function Banner() {
  const s = useTotal();
  const live = useLive();
  const parts = TABS.map((k) => usePart(k));
  const setTab = useStore((s) => s.setTab);
  return (
    <section className="dx-banner" aria-label="Your map so far">
      <div className="dx-banner-l">
        <p className="dx-banner-n num"><b>{live ? s.right : s.done}</b> of {live ? s.called : s.n} {live ? 'called races right' : 'races picked'}</p>
        <p className="dx-banner-sub">{live ? `${s.missed} missed so far` : s.open ? `${s.open} to go across Senate, governor and House` : 'Every race is picked'}</p>
      </div>
      <div className="dx-banner-bars">
        {parts.map((p) => (
          <button key={p.k} className="dx-banner-part" style={{ flexGrow: p.n }} onClick={() => setTab(p.k)} aria-label={`${TAB_LABEL[p.k]}, ${p.done} of ${p.n} picked`}>
            <span className="dx-banner-lbl"><b>{TAB_LABEL[p.k]}</b><span className="num">{live ? p.right : p.done}/{live ? p.called : p.n}</span></span>
            <PartBar p={p} />
          </button>
        ))}
      </div>
    </section>
  );
}
const D4 = () => <Base cls="dx4" top={<Banner />} side={<Side partOnly />} />;

// ---- 5 · by region: where the gaps are on the map ------------------------------------------------------
function Regions() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const select = useStore((s) => s.select);
  const live = useLive();
  return (
    <section className="dx-regions" aria-label="By region">
      <h2 className="dx-h">By region</h2>
      {REGIONS.map((g) => {
        const list = RACES[tab].filter((r) => r.region === g);
        if (!list.length) return null;
        const R = list.filter((r) => picks[r.id] === 'R').length, D = list.filter((r) => picks[r.id] === 'D').length;
        const next = list.find((r) => !picks[r.id]);
        return (
          <button key={g} className="dx-region" onClick={() => next && select(next.id)} disabled={!next || live}
            aria-label={`${g}: ${R + D} of ${list.length} picked${next ? `, go to ${next.stateName}` : ''}`}>
            <span className="dx-region-top"><b>{g}</b><span className="num">{R + D}/{list.length}</span></span>
            <Split R={R} D={D} n={list.length} thin />
            <span className="dx-region-next">{next ? <>Next: {next.stateName}<Icon name="chevRight" size={13} stroke={2.2} /></> : <><Icon name="check" size={12} stroke={2.6} /> Done</>}</span>
          </button>
        );
      })}
    </section>
  );
}
const D5 = () => <Base cls="dx5" side={<Side cls="regions"><Regions /></Side>} />;

// ---- 6 · the folder tabs carry the numbers; an "up next" checklist under the race -----------------------
function FolderStats() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  return (
    <div className="dx-ftabs" role="tablist" aria-label="Parts of the game">
      {TABS.map((k) => <FolderStat key={k} k={k} on={tab === k} onClick={() => setTab(k)} />)}
    </div>
  );
}
function FolderStat({ k, on, onClick }: { k: Tab; on: boolean; onClick: () => void }) {
  const p = usePart(k);
  const live = useLive();
  return (
    <button role="tab" aria-selected={on} className={'mt-tab dx-ftab' + (on ? ' on' : '')} onClick={onClick}>
      <MiniMap k={k} />
      <span className="dx-ftab-t">
        <span className="dx-ftab-top"><b>{TAB_LABEL[k]}</b><span className="num">{live ? p.right : p.done}/{live ? p.called : p.n}</span></span>
        <PartBar p={p} />
        <Status p={p} />
      </span>
    </button>
  );
}
function UpNext() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const open = RACES[tab].filter((r) => !picks[r.id]);
  return (
    <section className="dx-next" aria-label="Up next">
      <h2 className="dx-h">Up next <span className="num">{open.length} open</span></h2>
      {open.length ? open.slice(0, 5).map((r) => <Row key={r.id} r={r} dense />) : <p className="dx-empty"><Icon name="check" size={14} stroke={2.6} /> Every {NOUN[tab]} race is picked.</p>}
    </section>
  );
}
function D6() {
  const tab = useStore((s) => s.tab);
  const live = useLive();
  return (
    <div className={'v vE r big rows mtw mtw-folder dx dx6 sel-' + TABS.indexOf(tab)}>
      <FolderStats />
      <div className="e-cards tall dx-one"><DxMap />{live ? <Side /> : <Side cls="next"><UpNext /></Side>}</div>
    </div>
  );
}

// ---- 7 · every race on one board: three rows of squares, one per part (a heatmap overview) -------------
function Board() {
  const picks = useStore((s) => s.picks);
  const tab = useStore((s) => s.tab);
  const cur = useStore((s) => s.cursor[s.tab]);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const live = useLive();
  const t = useStore((s) => s.t);
  return (
    <section className="dx-board" aria-label="Every race">
      <h2 className="dx-h">Every race</h2>
      {TABS.map((k) => (
        <div key={k} className={'dx-board-row' + (tab === k ? ' on' : '')}>
          <span className="dx-board-l">{TAB_LABEL[k]}<span className="num">{live ? `${liveScore(picks, t, k).correct} of ${liveScore(picks, t, k).called} right` : `${RACES[k].filter((r) => picks[r.id]).length} of ${RACES[k].length}`}</span></span>
          <div className="dx-board-cells">
            {RACES[k].map((r) => {
              const p = picks[r.id];
              let c: string = p ?? 'open';
              if (live) { const called = t >= RESULTS[r.id].call; c = !called ? 'wait' : !p ? 'open' : p === RESULTS[r.id].winner ? 'right' : 'miss'; }
              return <button key={r.id} className={'dx-cell ' + c + (r.id === cur ? ' cur' : '')} title={`${r.stateName}: ${p ? (p === 'R' ? r.R : r.D) : 'open'}`}
                aria-label={`${TAB_LABEL[k]}, ${r.stateName}, ${p ? (p === 'R' ? 'Republican' : 'Democrat') : 'open'}`} onClick={() => { setTab(k); select(r.id); }} />;
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
const D7 = () => <Base cls="dx7" side={<Side cls="board"><Board /></Side>} />;

// ---- 8 · columns: open, Republican, Democrat (a board view, like Linear's) -----------------------------
function Columns() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const select = useStore((s) => s.select);
  const cur = useStore((s) => s.cursor[s.tab]);
  const list = RACES[tab];
  const cols = [
    { k: 'open', l: 'Open', rows: list.filter((r) => !picks[r.id]) },
    { k: 'R', l: 'Republican', rows: list.filter((r) => picks[r.id] === 'R') },
    { k: 'D', l: 'Democrat', rows: list.filter((r) => picks[r.id] === 'D') },
  ];
  return (
    <section className="dx-cols" aria-label={`${TAB_LABEL[tab]} races by pick`}>
      {cols.map((c) => (
        <div key={c.k} className={'dx-col ' + c.k}>
          <h2 className="dx-col-h"><Mark m={c.k} />{c.l}<span className="num">{c.rows.length}</span></h2>
          <div className="dx-col-list">
            {c.rows.map((r) => (
              <button key={r.id} className={'dx-chip' + (r.id === cur ? ' on' : '')} onClick={() => select(r.id)} aria-label={`${r.stateName}, ${c.l}`}>{r.state}</button>
            ))}
            {!c.rows.length && <span className="dx-col-empty">None yet</span>}
          </div>
        </div>
      ))}
    </section>
  );
}
function D8() {
  const live = useLive();
  return <Base cls="dx8" side={live ? undefined : <Side cls="cols"><Columns /></Side>} />;
}

// ---- 9 · a setup checklist: three parts and the save, with one ring for the whole (Brex's onboarding) ---
function Ring({ v }: { v: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg className="dx-ring" viewBox="0 0 56 56" aria-hidden>
      <circle cx="28" cy="28" r={r} className="track" />
      <circle cx="28" cy="28" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
    </svg>
  );
}
function Checklist() {
  const s = useTotal();
  const setTab = useStore((s) => s.setTab);
  const tab = useStore((s) => s.tab);
  const parts = TABS.map((k) => usePart(k));
  const allSaved = parts.every((p) => p.done === p.n && p.saved);
  const v = pct(s.done, s.n);
  return (
    <section className="dx-check" aria-label="Finish your map">
      <div className="dx-check-head">
        <span className="dx-ring-wrap"><Ring v={v} /><b className="num">{v}%</b></span>
        <span><h2 className="dx-h">Finish your map</h2><p className="dx-check-sub num">{s.done} of {s.n} races picked</p></span>
      </div>
      <ol>
        {parts.map((p) => (
          <li key={p.k}>
            <button className={'dx-step' + (tab === p.k ? ' on' : '') + (p.done === p.n ? ' done' : '')} onClick={() => setTab(p.k)} aria-current={tab === p.k ? 'step' : undefined}>
              <span className="dx-step-mark" aria-hidden>{p.done === p.n ? <Icon name="check" size={12} stroke={3} /> : null}</span>
              <span className="dx-step-t"><b>Pick every {NOUN[p.k]} race</b><span className="num">{p.done} of {p.n}{p.saved ? ' · saved' : ''}</span></span>
              <Icon name="chevRight" size={14} stroke={2} />
            </button>
          </li>
        ))}
        <li>
          <div className={'dx-step static' + (allSaved ? ' done' : '')}>
            <span className="dx-step-mark" aria-hidden>{allSaved ? <Icon name="check" size={12} stroke={3} /> : null}</span>
            <span className="dx-step-t"><b>Save all three</b><span>{allSaved ? 'Done' : 'Save each part with Save above the map'}</span></span>
          </div>
        </li>
      </ol>
    </section>
  );
}
function D9() {
  const live = useLive();
  return <Base cls="dx9" side={live ? undefined : <Side cls="check"><Checklist /></Side>} />;
}

// ---- 10 · a table you can pick in: every race of the part, both names, pick straight from the row -------
function PickTable() {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const cur = useStore((s) => s.cursor[s.tab]);
  const toggle = useStore((s) => s.toggle);
  const select = useStore((s) => s.select);
  const live = useLive();
  const p = usePart(tab);
  return (
    <section className="dx-table-wrap" aria-label={`${TAB_LABEL[tab]} races`}>
      <div className="dx-table-head">
        <h2 className="dx-h">{TAB_LABEL[tab]} <span className="num">{p.done} of {p.n} picked</span></h2>
        <Split R={p.R} D={p.D} n={p.n} thin />
      </div>
      <div className="dx-scroll">
        <table className="dx-table">
          <thead><tr><th scope="col">State</th><th scope="col">Republican</th><th scope="col">Democrat</th></tr></thead>
          <tbody>
            {RACES[tab].map((r) => {
              const pick = picks[r.id];
              const w = live ? RESULTS[r.id].winner : null;
              return (
                <tr key={r.id} className={r.id === cur ? 'on' : ''}>
                  <th scope="row"><button className="dx-td-st" onClick={() => select(r.id)}>{r.stateName}</button></th>
                  {(['R', 'D'] as const).map((side) => (
                    <td key={side}>
                      <button className={'dx-td-pick ' + side + (pick === side ? ' on' : '') + (w === side ? ' won' : '')} aria-pressed={pick === side} disabled={live}
                        onClick={() => { select(r.id); toggle(r.id, side); }} aria-label={`${r.stateName}: pick ${side === 'R' ? r.R : r.D}`}>
                        {pick === side && <Icon name="check" size={11} stroke={3} />}{(side === 'R' ? r.R : r.D).split(' ').pop()}
                      </button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function D10() {
  return (
    <div className="v vE r big rows mtw mtw-folder dx dx10">
      <MapTabs look="folder" />
      <div className="e-cards tall dx-one"><DxMap /><Side cls="table" noRace><PickTable /></Side></div>
    </div>
  );
}

// ---- P8 · version 7 of P7 and ten ways to say how far along you are -------------------------------
// The board stays: every race as a square, one row per part. What changes is where the percentages live
// (on each row, over the board, on a card of their own) and what a finished part turns into.
type Head = 'none' | 'big' | 'ring' | 'stats' | 'seg';
type RowNum = 'frac' | 'pct' | 'bar' | 'col';
type BO = { head?: Head; row?: RowNum; done?: 'check' | 'collapse'; dot?: boolean; title?: boolean };

function Pct({ v, n, cls = '' }: { v: number; n: number; cls?: string }) {
  return <span className={'p8-pct num ' + cls}>{pct(v, n)}<small>%</small></span>;
}

/** The whole map in one number, over the board. */
function BoardHead({ head }: { head: Head }) {
  const s = useTotal();
  const live = useLive();
  const parts = TABS.map((k) => usePart(k));
  const v = live ? s.right : s.done, of = live ? s.called : s.n;
  const word = live ? `${v} of ${of} called races right` : `${v} of ${of} races picked`;
  if (head === 'big') return (
    <div className="p8-big"><Pct v={v} n={of} cls="xl" /><span className="p8-big-t"><b>{live ? 'Right so far' : 'Your map'}</b><span className="num">{word}</span></span></div>
  );
  if (head === 'ring') return (
    <div className="p8-ringhead"><span className="dx-ring-wrap"><Ring v={pct(v, of)} /><b className="num">{pct(v, of)}%</b></span><span className="p8-big-t"><b>{live ? 'Right so far' : 'Your map'}</b><span className="num">{word}</span></span></div>
  );
  if (head === 'stats') return (
    <div className="p8-stats">
      {parts.map((p) => <span key={p.k} className={'p8-stat' + (p.done === p.n ? ' done' : '')}><small>{TAB_LABEL[p.k]}</small><Pct v={live ? p.right : p.done} n={live ? p.called || 1 : p.n} cls="lg" /></span>)}
      <span className="p8-stat all"><small>All</small><Pct v={v} n={of} cls="lg" /></span>
    </div>
  );
  if (head === 'seg') return (
    <div className="p8-seg">
      <div className="p8-seg-top"><b>{live ? 'Right so far' : 'Your map'}</b><Pct v={v} n={of} /></div>
      <div className="p8-seg-bar" role="img" aria-label={parts.map((p) => `${TAB_LABEL[p.k]} ${p.done} of ${p.n}`).join(', ')}>
        {parts.map((p) => <span key={p.k} style={{ flexGrow: p.n }}><i style={{ width: pct(live ? p.right : p.done, p.n) + '%' }} /></span>)}
      </div>
      <div className="p8-seg-lbl">{parts.map((p) => <span key={p.k} style={{ flexGrow: p.n }}>{TAB_LABEL[p.k]}</span>)}</div>
    </div>
  );
  return null;
}

/** A row's figure: a fraction, a percentage, a bar under the squares, or a column of its own. */
function RowFig({ p, row }: { p: Part; row: RowNum }) {
  const live = useLive();
  const v = live ? p.right : p.done, of = live ? p.called : p.n;
  if (p.done === p.n && !live) return <span className="p8-donetag"><Icon name="check" size={12} stroke={2.8} />Complete</span>;
  if (row === 'pct' || row === 'col') return <Pct v={v} n={of || 1} />;
  return <span className="num p8-frac">{v} of {of}</span>;
}

function Board8({ head = 'none', row = 'frac', done = 'check', dot, title = true }: BO) {
  const picks = useStore((s) => s.picks);
  const tab = useStore((s) => s.tab);
  const cur = useStore((s) => s.cursor[s.tab]);
  const auto = useStore((s) => s.auto);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const tap = useStore((s) => s.tap);
  const live = useLive();
  const t = useStore((s) => s.t);
  const parts = TABS.map((k) => usePart(k));
  const pop = useCellPop();
  return (
    <section className={'dx-board p8-board row-' + row + (dot ? ' dots' : '')} aria-label="Every race">
      {pop.at && <CellPop {...pop.at} onEnter={pop.stay} onLeave={pop.leave} />}
      {title && head === 'none' && <h2 className="dx-h">Every race</h2>}
      <BoardHead head={head} />
      {parts.map((p) => {
        const k = p.k;
        const full = p.done === p.n && !live;
        if (full && done === 'collapse') return (
          <button key={k} className={'p8-collapsed' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>
            <span className="p8-donemark"><Icon name="check" size={14} stroke={3} /></span>
            <span><b>{TAB_LABEL[k]} complete</b><small className="num">All {p.n} races picked{p.saved ? ' · saved' : ' · not saved yet'}</small></span>
            <Split R={p.R} D={p.D} n={p.n} thin />
          </button>
        );
        return (
          <div key={k} className={'dx-board-row p8-row' + (tab === k ? ' on' : '') + (full ? ' full' : '')}>
            {row === 'col' ? (
              <span className="p8-colfig"><small>{TAB_LABEL[k]}</small>{full ? <span className="p8-donemark sm"><Icon name="check" size={12} stroke={3} /></span> : <Pct v={live ? p.right : p.done} n={(live ? p.called : p.n) || 1} cls="lg" />}</span>
            ) : (
              <span className="dx-board-l"><span>{full && <Icon name="check" size={12} stroke={3} />}{TAB_LABEL[k]}</span><RowFig p={p} row={row} /></span>
            )}
            <div className="dx-board-cells">
              {RACES[k].map((r) => {
                const pk = picks[r.id];
                let c: string = pk ?? 'open';
                if (live) { const called = t >= RESULTS[r.id].call; c = !called ? 'wait' : !pk ? 'open' : pk === RESULTS[r.id].winner ? 'right' : 'miss'; }
                // a click works like a click on the map; hovering opens the race in a small card
                return <button key={r.id} className={'dx-cell ' + c + (!live && pk && auto[r.id] ? ' af' : '') + (r.id === cur ? ' cur' : '') + (pop.at?.id === r.id ? ' pop' : '')}
                  aria-label={`${TAB_LABEL[k]}, ${r.stateName}, ${pk ? (pk === 'R' ? 'Republican' : 'Democrat') + (auto[r.id] ? `, autofilled from ${AUTO_NAME[auto[r.id]]}` : '') : 'open'}`}
                  onClick={() => { if (live) { setTab(k); select(r.id); } else tap(r.id); }}
                  onPointerEnter={(e) => { if (e.pointerType !== 'mouse') return; pop.open(r.id, e.currentTarget); }}
                  onPointerLeave={(e) => { if (e.pointerType !== 'mouse') return; pop.leave(); }} />;
              })}
            </div>
            {row === 'bar' && <span className="p8-rowbar" aria-hidden><i style={{ width: pct(live ? p.right : p.done, p.n) + '%' }} /></span>}
          </div>
        );
      })}
    </section>
  );
}

/** Hovering a square: which square, and where it sits on screen. It stays open while the pointer
 *  crosses the gap into the card, so the card can be used. */
function useCellPop() {
  const [at, setAt] = useState<{ id: string; x: number; top: number; bottom: number } | null>(null);
  const timer = useRef(0);
  const open = (id: string, el: HTMLElement) => {
    clearTimeout(timer.current);
    const b = el.getBoundingClientRect();
    setAt({ id, x: b.left + b.width / 2, top: b.top, bottom: b.bottom });
  };
  const leave = () => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setAt(null), 180); };
  const stay = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { at, open, leave, stay };
}

/** The race behind a square, small: the state, and both candidates to pick from right there. Drawn
 *  on the page, not inside the board, so the board's scroll can never cut it. */
function CellPop({ id, x, top, bottom, onEnter, onLeave }: { id: string; x: number; top: number; bottom: number; onEnter: () => void; onLeave: () => void }) {
  const race = BY_ID[id];
  const select = useStore((s) => s.select);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, gap = 10, edge = 16;
    const above = top - gap - h >= edge;
    setPos({
      left: Math.round(Math.min(Math.max(edge, x - w / 2), innerWidth - w - edge)),
      top: Math.round(above ? top - gap - h : bottom + gap),
    });
  }, [id, x, top, bottom]);
  return createPortal(
    <div ref={ref} className="sq-pop" role="group" aria-label={`${race.stateName}, ${TAB_LABEL[race.type]}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
      onPointerEnter={onEnter} onPointerLeave={onLeave} onClickCapture={() => select(id)}>
      <div className="sq-pop-h"><Flag st={race.state} sm /><b>{race.stateName}</b><small>{TAB_LABEL[race.type]}</small></div>
      <div className="sq-pop-c"><CandidateRow race={race} side="R" /><CandidateRow race={race} side="D" /></div>
    </div>,
    document.body,
  );
}

/** The percentages on a card of their own, apart from the squares. */
function PctCard({ compact }: { compact?: boolean }) {
  const s = useTotal();
  const live = useLive();
  const parts = TABS.map((k) => usePart(k));
  const v = live ? s.right : s.done, of = live ? s.called : s.n;
  return (
    <div className={'dx-card p8-pctcard' + (compact ? ' compact' : '')}>
      <div className="p8-pctcard-top"><span className="dx-count-l">{live ? 'Called right' : 'Total picks'}</span><Pct v={v} n={of} cls={compact ? 'lg' : 'xl'} /></div>
      {!compact && <span className="dx-count-bar" aria-hidden><i style={{ width: pct(v, of) + '%' }} /></span>}
      <div className="p8-pctcard-rows">
        {parts.map((p) => (
          <span key={p.k} className={'p8-pctrow' + (p.done === p.n ? ' done' : '')}>
            <span>{p.done === p.n && !live ? <Icon name="check" size={12} stroke={3} /> : null}{TAB_LABEL[p.k]}</span>
            <Pct v={live ? p.right : p.done} n={(live ? p.called : p.n) || 1} />
          </span>
        ))}
      </div>
    </div>
  );
}

const V8 = (o: BO & { before?: ReactNode; after?: ReactNode }) => () => <Base cls={'dx7 p8'} side={<Side cls="board" before={o.before} after={o.after}><Board8 {...o} /></Side>} />;
// 1 · as chosen, each row with its count, a finished part says Complete
const P1 = V8({});
// 2 · each row in percent, the whole map as one big percentage over the board
const P2 = V8({ head: 'big', row: 'pct' });
// 3 · a ring for the whole map over the board, each row in percent
const P3 = V8({ head: 'ring', row: 'pct' });
// 4 · a bar under each row of squares that fills as the part does
const P4 = V8({ row: 'bar' });
// 5 · four figures across the top (Senate, Governor, House, all), the rows only squares
const P5 = V8({ head: 'stats', row: 'frac' });
// 6 · one bar for the whole map, split into the three parts by size, over the board
const P6 = V8({ head: 'seg', row: 'frac' });
// 7 · a finished part folds into one line: Senate complete, saved or not, its split
const P7 = V8({ row: 'pct', done: 'collapse' });
// 8 · apart: the board only shows squares, the percentages live on a card of their own under it
const P8 = () => <Base cls="dx7 p8 p8-withlist" side={<Side cls="board" bare before={<div className="dx-card p8-boardcard"><Board8 row="frac" /></div>} after={<PctCard />} />} />;
// 9 · the percentage as a column of its own beside each row of squares
const P9 = V8({ row: 'col', title: false });
// 10 · round dots instead of squares, the totals on a slim card between the race and the board
const P10 = V8({ row: 'pct', dot: true, before: <PctCard compact /> });

/** The people you picked, in the part on screen: a face, a name, the state. Click one to open the race. */
function PickList({ split }: { split?: boolean }) {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const cur = useStore((s) => s.cursor[s.tab]);
  const select = useStore((s) => s.select);
  const list = RACES[tab].filter((r) => picks[r.id]);
  const person = (r: Race) => {
    const side = picks[r.id] as 'R' | 'D';
    return (
      <button key={r.id} className={'p8-person' + (r.id === cur ? ' on' : '')} onClick={() => select(r.id)} aria-label={`${side === 'R' ? r.R : r.D}, ${side === 'R' ? 'Republican' : 'Democrat'}, ${r.stateName}`}>
        <Face side={side} className={'face ' + side} />
        <span className="p8-person-t"><b>{side === 'R' ? r.R : r.D}</b><small>{r.stateName}</small></span>
        {!split && <span className={'dx-mark ' + side} aria-hidden>{side}</span>}
      </button>
    );
  };
  return (
    <section className="p8-picks" aria-label={`Your ${TAB_LABEL[tab]} picks`}>
      <h2 className="dx-h">Your {NOUN[tab]} picks <span className="num">{list.length}</span></h2>
      {!list.length ? <p className="dx-empty">Nobody yet. Pick a race on the map.</p> : split ? (
        <div className="p8-picks-cols">
          {(['R', 'D'] as const).map((sd) => (
            <div key={sd} className="p8-picks-col">
              <span className="p8-picks-colh"><span className={'dx-mark ' + sd} aria-hidden>{sd}</span>{sd === 'R' ? 'Republican' : 'Democrat'}<span className="num">{list.filter((r) => picks[r.id] === sd).length}</span></span>
              <div className="dx-scroll">{list.filter((r) => picks[r.id] === sd).map(person)}</div>
            </div>
          ))}
        </div>
      ) : <div className="dx-scroll">{list.map(person)}</div>}
    </section>
  );
}
const WithList = (o: BO & { split?: boolean }) => () => (
  <Base cls="dx7 p8 p8-withlist" side={<Side cls="board" before={<div className="dx-card p8-boardcard"><Board8 {...o} /></div>}><PickList split={o.split} /></Side>} />
);
// 11 · under the board, a small card with the people you picked: face, name, state
const P11 = WithList({ row: 'frac' });
// 12 · the same list split into the two parties, the rows in percent
const P12 = WithList({ row: 'pct', split: true });

// ---- 13–14 · the mix: 6's split bar, 9's figures beside each row, 7's folded finish, 11's list --------
/** One part on the board: its figure (percent over "x of y") beside its squares, a bar under them.
 *  Finished, it folds into one line that says so. */
function MixRow({ p, fig = 'fig' }: { p: Part; fig?: 'fig' | 'ring' | 'none' }) {
  const picks = useStore((s) => s.picks);
  const tab = useStore((s) => s.tab);
  const cur = useStore((s) => s.cursor[s.tab]);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const live = useLive();
  const t = useStore((s) => s.t);
  const k = p.k;
  const v = live ? p.right : p.done, of = live ? p.called : p.n;
  if (!live && p.done === p.n) return (
    <button className={'mix-fold' + (tab === k ? ' on' : '')} onClick={() => setTab(k)} aria-label={`${TAB_LABEL[k]} complete, all ${p.n} races picked`}>
      <span className="p8-donemark"><Icon name="check" size={14} stroke={3} /></span>
      <span className="mix-fold-t"><b>{TAB_LABEL[k]} complete</b><small className="num">All {p.n} picked · {p.saved ? 'saved' : 'not saved yet'}</small></span>
      <span className="mix-fold-n num">100<small>%</small></span>
    </button>
  );
  return (
    <div className={'mix-row fig-' + fig + (tab === k ? ' on' : '')}>
      {fig === 'none' ? (
        <button className="mix-fig ln" onClick={() => setTab(k)} aria-label={`${TAB_LABEL[k]}, ${v} of ${of}`}>
          <small>{TAB_LABEL[k]}</small><span className="num mix-fig-n">{v} of {of} · {pct(v, of || 1)}%</span>
        </button>
      ) : fig === 'ring' ? (
        <button className="mix-fig rg" onClick={() => setTab(k)} aria-label={`${TAB_LABEL[k]}, ${v} of ${of}`}>
          <span className="mix-ring"><Ring v={pct(v, of || 1)} /><b className="num">{pct(v, of || 1)}</b></span>
          <span className="mix-ring-t"><small>{TAB_LABEL[k]}</small><span className="num mix-fig-n">{v} of {of}</span></span>
        </button>
      ) : (
        <button className="mix-fig" onClick={() => setTab(k)} aria-label={`${TAB_LABEL[k]}, ${v} of ${of}`}>
          <small>{TAB_LABEL[k]}</small>
          <span className="num mix-fig-p">{pct(v, of || 1)}<i>%</i></span>
          <span className="num mix-fig-n">{v} of {of}</span>
        </button>
      )}
      <div className="mix-cells">
        <div className="dx-board-cells">
          {RACES[k].map((r) => {
            const pk = picks[r.id];
            let c: string = pk ?? 'open';
            if (live) { const called = t >= RESULTS[r.id].call; c = !called ? 'wait' : !pk ? 'open' : pk === RESULTS[r.id].winner ? 'right' : 'miss'; }
            return <button key={r.id} className={'dx-cell ' + c + (r.id === cur ? ' cur' : '')} title={`${r.stateName}: ${pk ? (pk === 'R' ? r.R : r.D) : 'open'}`}
              aria-label={`${TAB_LABEL[k]}, ${r.stateName}, ${pk ? (pk === 'R' ? 'Republican' : 'Democrat') : 'open'}`} onClick={() => { setTab(k); select(r.id); }} />;
          })}
        </div>
        <span className="mix-bar" aria-hidden><i style={{ width: pct(v, p.n) + '%' }} /></span>
      </div>
    </div>
  );
}

/** The whole map over the board: the figure on the left, 6's bar split into the three parts under it. */
function MixHead({ labeled }: { labeled?: boolean }) {
  const s = useTotal();
  const live = useLive();
  const parts = TABS.map((k) => usePart(k));
  const v = live ? s.right : s.done, of = live ? s.called : s.n;
  return (
    <div className="mix-head">
      <div className="mix-head-top">
        <span className="mix-head-l">{live ? 'Called right' : 'Your map'}</span>
        <span className="mix-head-r"><span className="num mix-head-p">{pct(v, of || 1)}<i>%</i></span><span className="num mix-head-n">{v} of {of}</span></span>
      </div>
      <div className="p8-seg-bar" role="img" aria-label={parts.map((p) => `${TAB_LABEL[p.k]} ${p.done} of ${p.n}`).join(', ')}>
        {parts.map((p) => <span key={p.k} style={{ flexGrow: p.n }}><i style={{ width: pct(live ? p.right : p.done, p.n) + '%' }} /></span>)}
      </div>
      {labeled && (
        <div className="mix-seglbl">
          {parts.map((p) => (
            <span key={p.k} style={{ flexGrow: p.n }} className={p.done === p.n ? 'done' : ''}>
              <b>{p.done === p.n && <Icon name="check" size={11} stroke={3} />}{TAB_LABEL[p.k]}</b>
              <span className="num">{pct(live ? p.right : p.done, (live ? p.called : p.n) || 1)}% · {live ? p.right : p.done}/{live ? p.called : p.n}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The races of the part on screen. Open: the state's flag and name. Picked: the person, their photo with
 *  the flag pinned to it, and the state under the name. */
function RaceRoll({ group }: { group?: boolean }) {
  const tab = useStore((s) => s.tab);
  const picks = useStore((s) => s.picks);
  const cur = useStore((s) => s.cursor[s.tab]);
  const select = useStore((s) => s.select);
  const live = useLive();
  const all = RACES[tab];
  const list = group ? [...all.filter((r) => !picks[r.id]), ...all.filter((r) => picks[r.id])] : all;
  const firstPicked = group ? list.findIndex((r) => picks[r.id]) : -1;
  const openN = all.filter((r) => !picks[r.id]).length;
  return (
    <div className="dx-scroll mix-roll">
      {group && openN > 0 && <p className="mix-roll-h">Still open <span className="num">{openN}</span></p>}
      {list.map((r, i) => {
        const pk = picks[r.id] as 'R' | 'D' | undefined;
        const won = live ? RESULTS[r.id].winner : null;
        const head = group && i === firstPicked ? <p key={'h' + r.id} className="mix-roll-h">Picked <span className="num">{all.length - openN}</span></p> : null;
        return [head,
          <button key={r.id} className={'mix-item' + (pk ? ' picked ' + pk : ' open') + (r.id === cur ? ' on' : '')} onClick={() => select(r.id)}
            aria-label={pk ? `${r.stateName}: ${pk === 'R' ? r.R : r.D}, ${pk === 'R' ? 'Republican' : 'Democrat'}` : `${r.stateName}: open`}>
            {pk ? (
              <span className="mix-ava"><Face side={pk} className={'face ' + pk} /><span className="mix-ava-flag"><Flag st={r.state} sm /></span></span>
            ) : (
              <span className="mix-ava empty"><Flag st={r.state} /></span>
            )}
            <span className="mix-item-t">
              {pk ? <><b>{pk === 'R' ? r.R : r.D}</b><small>{r.stateName} · {pk === 'R' ? 'Republican' : 'Democrat'}</small></> : <><b className="st">{r.stateName}</b><small>No pick yet</small></>}
            </span>
            {live && pk ? <span className={'dx-mark ' + (pk === won ? 'ok' : 'no')} aria-hidden><Icon name={pk === won ? 'check' : 'x'} size={11} stroke={3} /></span>
              : pk ? <span className={'dx-mark ' + pk} aria-hidden>{pk}</span> : <span className="mix-pick">Pick<Icon name="chevRight" size={13} stroke={2.2} /></span>}
          </button>];
      })}
    </div>
  );
}

/** One card, two views: how far along (the board) and who you picked (the list). */
type MixO = { start?: 'board' | 'list'; tabs?: 'seg' | 'text'; fig?: 'fig' | 'ring' | 'none'; labeled?: boolean; group?: boolean };
function MixCard({ start = 'board', tabs = 'seg', fig = 'fig', labeled, group }: MixO) {
  const tab = useStore((s) => s.tab);
  const parts = TABS.map((k) => usePart(k));
  const [view, setView] = useState<'board' | 'list'>(start);
  const p = parts[TABS.indexOf(tab)];
  return (
    <section className="mix" aria-label="Your progress">
      <div className="mix-top">
        <div className={tabs === 'seg' ? 'dx-seg' : 'mix-tt'} role="group" aria-label="Show">
          <button aria-pressed={view === 'board'} className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Every race</button>
          <button aria-pressed={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>Your picks <span className="num">{p.done}</span></button>
        </div>
      </div>
      {view === 'board' ? (
        <div className="mix-board"><MixHead labeled={labeled} />{parts.map((q) => <MixRow key={q.k} p={q} fig={fig} />)}</div>
      ) : <RaceRoll group={group} />}
    </section>
  );
}
const MixV = (o: MixO & { cls?: string }) => () => <Base cls={'dx7 p8 p8mx ' + (o.cls ?? '')} side={<Side cls="board"><MixCard {...o} /></Side>} />;
// 13 · the mix, opening on the board
const P13 = MixV({});
// 14 · the mix, opening on the list of picks
const P14 = MixV({ start: 'list' });
// 15 · soft: round dots, bigger figures, the list grouped into open and picked
const P15 = MixV({ cls: 'mix-soft', group: true });
// 16 · rings: each part's figure is a small ring, the finish fills it
const P16 = MixV({ cls: 'mix-rings', fig: 'ring', group: true });
// 17 · the split bar carries the labels and the numbers; the rows are only squares
const P17 = MixV({ cls: 'mix-labeled', fig: 'none', labeled: true, tabs: 'text', group: true });
// 18 · portrait candidates: the two people as tall cards, the face large, the choice unmistakable
const P18 = MixV({ cls: 'mix-portrait', group: true });
// 19 · text tabs and a calmer card: figures beside each row, open races first in the list
const P19 = MixV({ cls: 'mix-calm', tabs: 'text', group: true });
// 20 · everything at once, tuned: portrait candidates, rings, labeled bar, grouped list
const P20 = MixV({ cls: 'mix-portrait mix-rings mix-soft', fig: 'ring', tabs: 'text', group: true });

// 21 · 12, refined: more air everywhere, the two candidates as larger cards, one above the other
const P21 = () => (
  <Base cls="dx7 p8 p8-withlist p21" side={<Side cls="board" before={<div className="dx-card p8-boardcard"><Board8 row="pct" /></div>}><PickList split /></Side>} />
);

// 22–23 · 6 taken apart: "Every race" on its own card, "Your map" with its percentage on another
const MapCard6 = () => <div className="dx-card p22-map"><BoardHead head="seg" /></div>;
// 22 · the squares first, the whole map under them
const P22 = () => <Base cls="dx7 p8 p22" side={<Side cls="board" after={<MapCard6 />}><Board8 row="frac" /></Side>} />;
// 23 · the whole map first, the squares under it
const P23 = () => <Base cls="dx7 p8 p22" side={<Side cls="board" before={<MapCard6 />}><Board8 row="frac" /></Side>} />;

// ---- P9 · the last one: Figma "Pick Em · P8 version 23" as Henrique edited it (Oct 9) -------------------
/** One Save for all three maps, beside the tabs. Lit while any map has picks that are not saved yet. */
/** Saving every map that has picks: the pill at the top and the card that closes a part share it. */
function useSaveMaps() {
  const picks = useStore((s) => s.picks);
  const savedPicks = useStore((s) => s.savedPicks);
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const saveCat = useStore((s) => s.saveCat);
  const say = useStore((s) => s.say);
  const parts = TABS.filter((k) => RACES[k].some((r) => picks[r.id]));
  const unsaved = parts.filter((k) => !catSaved(picks, savedPicks, k));
  const saved = parts.length > 0 && !unsaved.length;
  const run = () => {
    if (!parts.length) return say('Pick at least one race to save your maps');
    if (saved) return say('Your maps are saved. Change a pick to save again.');
    if (!user) return openAuth('save');
    unsaved.forEach((k) => saveCat(k));
    say(unsaved.length === 1 ? `${TAB_LABEL[unsaved[0]]} map saved` : 'Maps saved');
  };
  return { saved, ready: unsaved.length > 0, run };
}

function SaveMaps() {
  const live = useLive();
  const { saved, ready, run } = useSaveMaps();
  if (live) return null;
  return (
    <button className={'btn save p9-save' + (saved ? ' saved' : ready ? ' ready' : '')} onClick={run}>
      {saved ? <><Icon name="check" size={16} stroke={2.4} />Saved</> : 'Save maps'}
    </button>
  );
}

/** A part is finished: a card of its own says so, shows where the three maps stand, and offers the
 *  next one. However it was finished, by hand or by Autofill; once each time a part fills up, and
 *  never during the tour. */
function PartDone() {
  const picks = useStore((s) => s.picks);
  const auto = useStore((s) => s.auto);
  const tour = useStore((s) => s.tour);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const live = useLive();
  const save = useSaveMaps();
  const [open, setOpen] = useState<Tab | null>(null);
  const done = Object.fromEntries(TABS.map((k) => [k, RACES[k].filter((r) => picks[r.id]).length])) as Record<Tab, number>;
  const key = TABS.map((k) => done[k]).join(',');
  const prev = useRef<Record<Tab, number> | null>(null);
  const shown = useRef(new Set<Tab>());
  const back = useRef<HTMLElement | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const timer = useRef(0);
  useEffect(() => {
    const p = prev.current;
    prev.current = done;
    if (!p || live || tour !== null) return;
    // a part that is open again can be finished again
    for (const x of TABS) if (done[x] < RACES[x].length) shown.current.delete(x);
    const k = TABS.find((x) => p[x] < RACES[x].length && done[x] === RACES[x].length && !shown.current.has(x));
    if (!k) return;
    shown.current.add(k);
    // a beat first, so the last state is seen taking its colour before the card comes up
    timer.current = window.setTimeout(() => { back.current = document.activeElement as HTMLElement; setOpen(k); }, 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = () => { setOpen(null); back.current?.focus?.(); };
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const go = (k: Tab) => {
    const firstOpen = RACES[k].find((r) => !picks[r.id]);
    if (firstOpen) select(firstOpen.id); else setTab(k);
    setOpen(null);
  };
  const i = open ? TABS.indexOf(open) : 0;
  const next = open ? [...TABS.slice(i + 1), ...TABS.slice(0, i)].find((k) => done[k] < RACES[k].length) : undefined;
  const n = open ? RACES[open].length : 0;
  const total = TABS.reduce((a, k) => a + RACES[k].length, 0);
  // how much of the part Autofill filled, and from where
  const filled = open ? RACES[open].filter((r) => auto[r.id]) : [];
  const from = filled.length ? AUTO_NAME[auto[filled[0].id]] : '';
  const head = !open ? '' : filled.length === n
    ? `All ${n} ${NOUN[open]} races are filled from ${from}.`
    : filled.length
      ? `All ${n} ${NOUN[open]} races have a pick, ${filled.length} of them from ${from}.`
      : `You called all ${n} ${NOUN[open]} races.`;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="pd" className="pd-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <motion.div className="pd" role="dialog" aria-modal="true" aria-labelledby="pd-title" aria-describedby="pd-text"
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
            <button className="pd-x" aria-label="Close" onClick={close}><Icon name="x" size={18} stroke={1.9} /></button>
            <span className="pd-badge" aria-hidden><Icon name="check" size={20} stroke={2.8} /></span>
            <h2 id="pd-title">{next ? `${TAB_LABEL[open]} complete` : 'Every race is picked'}</h2>
            <p id="pd-text">
              {next
                ? `${head} Keep going with the next map, or stay here to look over your picks.`
                : `All ${total} races are called. Save your maps to keep them, then come back on election night to see how you did.`}
            </p>
            <div className="pd-maps">
              {TABS.map((k) => {
                const full = done[k] === RACES[k].length;
                return (
                  <button key={k} className={'pd-map' + (k === open ? ' pd-this' : '')} onClick={() => go(k)}
                    aria-label={`${TAB_LABEL[k]}, ${full ? 'complete' : `${done[k]} of ${RACES[k].length} picked`}`}>
                    <MiniMap k={k} />
                    <span className="pd-map-t">
                      <b>{TAB_LABEL[k]}</b>
                      <small className="num">{full ? <><Icon name="check" size={12} stroke={3} />Complete</> : done[k] ? `${done[k]} of ${RACES[k].length}` : `${RACES[k].length} races`}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pd-acts">
              {next ? (
                <>
                  <button className="pd-quiet" onClick={close}>Stay on {TAB_LABEL[open]}</button>
                  <button ref={first} className="pd-go" onClick={() => go(next)}>Go to {TAB_LABEL[next]}<Icon name="arrowRight" size={16} stroke={2.2} /></button>
                </>
              ) : (
                <>
                  <button className="pd-quiet" onClick={close}>Close</button>
                  <button ref={first} className="pd-go" onClick={() => { setOpen(null); save.run(); }}>{save.saved ? 'Saved' : 'Save maps'}</button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ThePage() {
  const tab = useStore((s) => s.tab);
  const MapCard6b = () => <div className="dx-card p22-map"><BoardHead head="seg" /></div>;
  return (
    <div className={'v vE r big rows mtw mtw-folder dx dx7 p8 p22 p9 sel-' + TABS.indexOf(tab)}>
      <div className="p9-tabs"><MapTabs look="folder" /><SaveMaps /></div>
      <div className="e-cards tall dx-one"><DxMap noSave /><Side cls="board" before={<MapCard6b />}><Board8 row="frac" /></Side></div>
      <PartDone />
    </div>
  );
}

// P9 is a single page
const ALL_V = [ThePage];
export default function Dash({ n }: { n: number }) {
  const V = ALL_V[n - 1] ?? ThePage;
  const live = useLive();
  return <div className={'v-wrap' + (live ? ' night' : '')}><V /></div>;
}
