// Election night: share your map. One image per part (the map on screen): your calls coloured by the
// result, how many you got right and missed, in numbers and in percent. Drawn as an SVG so the
// preview is the image itself; the download draws that same SVG onto a canvas, with the font and
// the wordmark carried inside it so the picture matches the preview.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/500-italic.css';
import us from '../data/usmap-hub.json';
import logoRaw from '../data/logo.svg?raw';
import f400 from '@fontsource/libre-franklin/files/libre-franklin-latin-400-normal.woff2?url';
import f600 from '@fontsource/libre-franklin/files/libre-franklin-latin-600-normal.woff2?url';
import n500 from '@fontsource/newsreader/files/newsreader-latin-500-normal.woff2?url';
import n500i from '@fontsource/newsreader/files/newsreader-latin-500-italic.woff2?url';
import { RACES, RESULTS, TAB_LABEL, T_MAX, statusAt, type Tab } from '../data/races';
import { useStore } from '../lib/store';
import { Icon } from './ui';

const SHAPES = us.states as Record<string, string>;
const ORDER = Object.keys(SHAPES);
const [VX, VY, VW, VH] = (us.frame as number[]);
const NOUN: Record<Tab, string> = { senate: 'Senate', gov: 'governor', house: 'House' };
const SANS = "'Libre Franklin', Helvetica, Arial, sans-serif";
const SERIF = "'Newsreader', Georgia, 'Times New Roman', serif";
// the wordmark in either ink, inline, so the picture carries it without a fetch
const mark = (ink: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent((logoRaw as string).replace(/#FAFAFA/gi, ink));

function useShareData(tab: Tab) {
  const picks = useStore((s) => s.picks);
  const t = useStore((s) => s.t);
  const own = Object.fromEntries(RACES[tab].map((r) => [r.state, r]));
  let right = 0, missed = 0, open = 0;
  const look: Record<string, 'no' | 'open' | 'R' | 'D' | 'mR' | 'mD'> = {};
  for (const st of ORDER) {
    const r = own[st];
    if (!r) { look[st] = 'no'; continue; }
    const p = picks[r.id];
    const called = statusAt(r.id, t).status === 'called';
    if (!called || !p) { look[st] = 'open'; if (!called) open++; continue; }
    const w = RESULTS[r.id].winner;
    if (p === w) { right++; look[st] = w; } else { missed++; look[st] = w === 'R' ? 'mR' : 'mD'; }
  }
  const scored = right + missed;
  const pr = scored ? Math.round((right / scored) * 100) : 0;
  return { look, right, missed, open, scored, pr, pm: scored ? 100 - pr : 0, final: t >= T_MAX };
}

type Paper = 'light' | 'dark';
/** Two papers: a light editorial page, and the site's own dark. */
const INK: Record<Paper, { bg: string; ink: string; soft: string; rule: string; no: string; open: string; mR: string; mD: string; hatch: string; hatchO: number }> = {
  light: { bg: '#f3efe6', ink: '#151515', soft: '#6f695e', rule: 'rgba(21,21,21,.16)', no: '#e8e3d8', open: '#d9d2c4', mR: '#f1b3bb', mD: '#b4c3ef', hatch: '#151515', hatchO: 0.42 },
  dark: { bg: '#121212', ink: '#fafafa', soft: '#8f8f8f', rule: 'rgba(250,250,250,.16)', no: '#1b1b1b', open: '#2c2c2c', mR: '#7a1020', mD: '#142c74', hatch: '#fafafa', hatchO: 0.4 },
};

/** The image: 1200 × 630, laid out like a page. A masthead line, a headline in a serif, the score as
 *  two figures, and the map as the picture. */
function ShareCard({ tab, paper, svgRef }: { tab: Tab; paper: Paper; svgRef?: React.Ref<SVGSVGElement> }) {
  const d = useShareData(tab);
  const c = INK[paper];
  const label = TAB_LABEL[tab];
  const noun = NOUN[tab];
  const lines = d.final ? [`I called ${d.right} of ${d.scored}`, `${noun} races right.`] : ['So far I’ve called', `${d.right} of ${d.scored} ${noun}`, 'races right.'];
  // the map fills the right of the page
  const BX = 596, BY = 128, BW = 532, BH = 372;
  const k = Math.min(BW / VW, BH / VH);
  const mx = BX + (BW - VW * k) / 2 - VX * k, my = BY + (BH - VH * k) / 2 - VY * k;
  const fill = { no: c.no, open: c.open, R: '#fc002c', D: '#0f45db', mR: c.mR, mD: c.mD };
  return (
    <svg ref={svgRef} className="sh-card" viewBox="0 0 1200 630" width="1200" height="630" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`My ${label} map: ${d.right} of ${d.scored} right, ${d.pr}% right, ${d.pm}% missed`}>
      <defs>
        <pattern id={'sh-x-' + paper} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V6M0 0H6" stroke={c.hatch} strokeOpacity={c.hatchO} strokeWidth="1.2" fill="none" />
        </pattern>
      </defs>
      <rect width="1200" height="630" fill={c.bg} />

      {/* masthead */}
      <g fontFamily={SANS} fontSize="13" fontWeight="600" letterSpacing="2.6" fill={c.ink}>
        <text x="72" y="66">THE MIDTERMS PICK EM</text>
        <text x="1128" y="66" textAnchor="end" fill={c.soft}>{label.toUpperCase()} · {d.final ? 'FINAL RESULTS' : 'ELECTION NIGHT'} · NOV. 3, 2026</text>
      </g>
      <rect x="72" y="86" width="1056" height="1" fill={c.rule} />

      {/* headline */}
      <text fontFamily={SERIF} fontSize="52" fontWeight="500" letterSpacing="-1.2" fill={c.ink}>
        {lines.map((l, i) => <tspan key={i} x="70" y={176 + i * 58}>{l}</tspan>)}
      </text>

      {/* the score, as two figures */}
      <g fontFamily={SERIF} fontWeight="500" letterSpacing="-3">
        <text x="68" y="470" fontSize="104" fill={c.ink}>{d.pr}<tspan fontSize="52" dx="4" letterSpacing="0">%</tspan></text>
        <text x="330" y="470" fontSize="104" fill={c.soft}>{d.pm}<tspan fontSize="52" dx="4" letterSpacing="0">%</tspan></text>
      </g>
      <rect x="306" y="392" width="1" height="112" fill={c.rule} />
      <g fontFamily={SANS} fontSize="13" fontWeight="600" letterSpacing="2.2">
        <text x="72" y="500" fill={c.ink}>RIGHT · {d.right}</text>
        <text x="334" y="500" fill={c.soft}>MISSED · {d.missed}</text>
      </g>

      {/* the map */}
      <g transform={`translate(${mx} ${my}) scale(${k})`}>
        {ORDER.map((st) => <path key={st} d={SHAPES[st]} fill={fill[d.look[st]]} stroke={c.bg} strokeWidth={1.6 / k} strokeLinejoin="round" />)}
        {ORDER.filter((st) => d.look[st] === 'mR' || d.look[st] === 'mD').map((st) => <path key={'x' + st} d={SHAPES[st]} fill={`url(#sh-x-${paper})`} />)}
      </g>
      <g fontFamily={SANS} fontSize="13" fill={c.soft}>
        <rect x="604" y="510" width="6" height="12" fill="#fc002c" /><rect x="610" y="510" width="6" height="12" fill="#0f45db" />
        <text x="626" y="521">Right</text>
        <rect x="682" y="510" width="12" height="12" fill={c.mR} /><rect x="682" y="510" width="12" height="12" fill={`url(#sh-x-${paper})`} />
        <text x="702" y="521">Missed</text>
        <rect x="766" y="510" width="12" height="12" fill={c.open} />
        <text x="786" y="521">{d.open ? `Not called yet · ${d.open}` : 'No pick'}</text>
      </g>

      {/* foot */}
      <rect x="72" y="552" width="1056" height="1" fill={c.rule} />
      <image href={mark(c.ink)} x="72" y="574" width="139" height="13" />
      <text x="1128" y="586" textAnchor="end" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={c.soft}>Make your picks at dailywire.com</text>
    </svg>
  );
}

const toB64 = (buf: ArrayBuffer) => {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const dataUrl = async (url: string, type: string) => 'data:' + type + ';base64,' + toB64(await (await fetch(url)).arrayBuffer());

/** The preview turned into a PNG, at twice the size, with its fonts inside it. */
async function toPng(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  const face = async (fam: string, w: number, st: string, url: string) => `@font-face{font-family:'${fam}';font-weight:${w};font-style:${st};src:url(${await dataUrl(url, 'font/woff2')}) format('woff2')}`;
  style.textContent = (await Promise.all([
    face('Libre Franklin', 400, 'normal', f400), face('Libre Franklin', 600, 'normal', f600),
    face('Newsreader', 500, 'normal', n500), face('Newsreader', 500, 'italic', n500i),
  ])).join('\n');
  clone.insertBefore(style, clone.firstChild);
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = new Image();
  await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error('image')); img.src = src; });
  // let the embedded fonts settle before the picture is taken
  await new Promise((r) => setTimeout(r, 60));
  const c = document.createElement('canvas');
  c.width = 2400; c.height = 1260;
  c.getContext('2d')!.drawImage(img, 0, 0, 2400, 1260);
  return new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/png'));
}

/** In the map's head on the night, where Autofill sits while you pick. */
export function ShareButton() {
  const tab = useStore((s) => s.tab);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn sh-btn" onClick={() => setOpen(true)} aria-label={`Share your ${TAB_LABEL[tab]} map`}>
        <Icon name="share" size={18} stroke={1.9} />Share
      </button>
      <ShareModal tab={open ? tab : null} onClose={() => setOpen(false)} />
    </>
  );
}

function ShareModal({ tab, onClose }: { tab: Tab | null; onClose: () => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const say = useStore((s) => s.say);
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState<Paper>('light');
  useEffect(() => {
    if (!tab) return;
    const back = document.activeElement as HTMLElement | null;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); back?.focus?.(); };
  }, [tab, onClose]);

  const download = async () => {
    if (!svg.current || !tab) return;
    setBusy(true);
    try {
      const blob = await toPng(svg.current);
      const name = `pick-em-${tab}-map.png`;
      const file = new File([blob], name, { type: 'image/png' });
      // a phone shares the picture straight to an app; a computer saves it
      if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ files: [file], title: `My ${TAB_LABEL[tab]} map` });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        say('Image saved');
      }
    } catch { say('Could not make the image, try again'); }
    setBusy(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(location.origin + location.pathname); say('Link copied'); } catch { say('Could not copy the link'); }
  };

  return createPortal(
    <AnimatePresence>
      {tab && (
        <motion.div key="sh" className="pd-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div className="pd sh" role="dialog" aria-modal="true" aria-labelledby="sh-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
            <button className="pd-x" aria-label="Close" onClick={onClose}><Icon name="x" size={18} stroke={1.9} /></button>
            <h2 id="sh-title">Share your {NOUN[tab]} map</h2>
            <p>Your calls so far, right and missed, ready to post.</p>
            <div className="sh-prev"><ShareCard tab={tab} paper={paper} svgRef={svg} /></div>
            <div className="pd-acts">
              <div className="sh-paper" role="group" aria-label="Image style">
                {(['light', 'dark'] as const).map((k) => (
                  <button key={k} className={paper === k ? 'on' : ''} aria-pressed={paper === k} onClick={() => setPaper(k)}>{k === 'light' ? 'Light' : 'Dark'}</button>
                ))}
              </div>
              <button className="pd-quiet" onClick={copy}><Icon name="link" size={16} stroke={2} />Copy link</button>
              <button ref={first} className="pd-go" onClick={download} disabled={busy}><Icon name="download" size={16} stroke={2.2} />{busy ? 'Making the image' : 'Download image'}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
