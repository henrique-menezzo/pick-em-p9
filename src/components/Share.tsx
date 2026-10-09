// Election night: share your map. One image per part (the map on screen): your calls coloured by the
// result, how many you got right and missed, in numbers and in percent. Drawn as an SVG so the
// preview is the image itself; the download draws that same SVG onto a canvas, with the font and
// the wordmark carried inside it so the picture matches the preview.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import us from '../data/usmap-hub.json';
import logo from '../data/logo.svg';
import f400 from '@fontsource/libre-franklin/files/libre-franklin-latin-400-normal.woff2?url';
import f600 from '@fontsource/libre-franklin/files/libre-franklin-latin-600-normal.woff2?url';
import { RACES, RESULTS, TAB_LABEL, T_MAX, statusAt, type Tab } from '../data/races';
import { useStore } from '../lib/store';
import { Icon } from './ui';

const SHAPES = us.states as Record<string, string>;
const ORDER = Object.keys(SHAPES);
const [VX, VY, VW, VH] = (us.frame as number[]);
const NOUN: Record<Tab, string> = { senate: 'Senate', gov: 'governor', house: 'House' };
const FONT = "'Libre Franklin', Helvetica, Arial, sans-serif";

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

const FILL = { no: '#1b1b1b', open: '#2c2c2c', R: '#fc002c', D: '#0f45db', mR: '#8a1022', mD: '#16307e' } as const;

/** The image: 1200 × 630, the size every network previews well. */
function ShareCard({ tab, svgRef }: { tab: Tab; svgRef?: React.Ref<SVGSVGElement> }) {
  const d = useShareData(tab);
  const label = TAB_LABEL[tab];
  // the map sits in a 620 × 420 box on the right, centred
  const k = Math.min(620 / VW, 400 / VH);
  const mx = 548 + (620 - VW * k) / 2 - VX * k, my = 112 + (400 - VH * k) / 2 - VY * k;
  const barW = 404, rw = d.scored ? (barW * d.right) / d.scored : 0;
  return (
    <svg ref={svgRef} className="sh-card" viewBox="0 0 1200 630" width="1200" height="630" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label={`My ${label} map: ${d.right} right, ${d.missed} missed, ${d.pr}% right`}>
      <defs>
        <radialGradient id="sh-r" cx="0" cy="1" r="0.9"><stop offset="0" stopColor="#fc002c" stopOpacity=".2" /><stop offset="1" stopColor="#fc002c" stopOpacity="0" /></radialGradient>
        <radialGradient id="sh-d" cx="1" cy="0" r="0.9"><stop offset="0" stopColor="#0f45db" stopOpacity=".24" /><stop offset="1" stopColor="#0f45db" stopOpacity="0" /></radialGradient>
        <pattern id="sh-miss" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V7M0 0H7" stroke="#fafafa" strokeOpacity=".38" strokeWidth="1.6" fill="none" />
        </pattern>
        <pattern id="sh-miss-bar" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#3a3a3a" />
          <path d="M0 0V6M0 0H6" stroke="#fafafa" strokeOpacity=".5" strokeWidth="1.4" fill="none" />
        </pattern>
        <clipPath id="sh-bar"><rect x="72" y="372" width={barW} height="12" rx="6" /></clipPath>
      </defs>
      <rect width="1200" height="630" fill="#121212" />
      <rect width="1200" height="630" fill="url(#sh-r)" />
      <rect width="1200" height="630" fill="url(#sh-d)" />

      <image className="sh-logo" href={logo} x="72" y="64" width="160" height="15" />
      <text x="72" y="146" fill="#8f8f8f" fontFamily={FONT} fontSize="17" fontWeight="600" letterSpacing="2.4">THE MIDTERMS PICK EM</text>
      <text x="72" y="194" fill="#fafafa" fontFamily={FONT} fontSize="40" fontWeight="600" letterSpacing="-.6">My {label} map</text>

      <text x="68" y="334" fill="#fafafa" fontFamily={FONT} fontWeight="600" letterSpacing="-5">
        <tspan fontSize="128">{d.pr}</tspan><tspan fontSize="64" dx="2" dy="-48" letterSpacing="0">%</tspan>
      </text>
      {/* "right" on the number's baseline, after the raised % (about 80 a digit at this size) */}
      <text x={72 + 80 * String(d.pr).length + 66} y="334" fill="#8f8f8f" fontFamily={FONT} fontSize="24" fontWeight="400">right</text>

      <g clipPath="url(#sh-bar)">
        <rect x="72" y="372" width={barW} height="12" fill={d.scored ? 'url(#sh-miss-bar)' : '#2c2c2c'} />
        <rect x="72" y="372" width={rw} height="12" fill="#fafafa" />
      </g>

      <g fontFamily={FONT}>
        <text x="72" y="452" fill="#fafafa" fontSize="44" fontWeight="600">{d.right}</text>
        <text x="72" y="484" fill="#8f8f8f" fontSize="18">Right · {d.pr}%</text>
        <text x="236" y="452" fill="#fafafa" fontSize="44" fontWeight="600">{d.missed}</text>
        <text x="236" y="484" fill="#8f8f8f" fontSize="18">Missed · {d.pm}%</text>
        {d.open > 0 && <>
          <text x="400" y="452" fill="#fafafa" fontSize="44" fontWeight="600">{d.open}</text>
          <text x="400" y="484" fill="#8f8f8f" fontSize="18">To call</text>
        </>}
      </g>

      <text x="72" y="566" fill="#8f8f8f" fontFamily={FONT} fontSize="18">{d.final ? 'Final results' : 'Live results so far'} · Make your picks at dailywire.com</text>

      <g transform={`translate(${mx} ${my}) scale(${k})`}>
        {ORDER.map((st) => (
          <path key={st} d={SHAPES[st]} fill={FILL[d.look[st]]} stroke="#121212" strokeWidth={1.4 / k} strokeLinejoin="round" />
        ))}
        {ORDER.filter((st) => d.look[st] === 'mR' || d.look[st] === 'mD').map((st) => (
          <path key={'m' + st} d={SHAPES[st]} fill="url(#sh-miss)" />
        ))}
      </g>

      <g fontFamily={FONT} fontSize="15" fill="#8f8f8f">
        <rect x="560" y="548" width="12" height="12" rx="3" fill="#fc002c" /><rect x="566" y="548" width="6" height="12" fill="#0f45db" />
        <text x="580" y="559">Right</text>
        <rect x="640" y="548" width="12" height="12" rx="3" fill="url(#sh-miss-bar)" />
        <text x="660" y="559">Missed</text>
        <rect x="728" y="548" width="12" height="12" rx="3" fill="#2c2c2c" />
        <text x="748" y="559">Not called</text>
      </g>
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

/** The preview turned into a PNG, at twice the size, with the font and the wordmark inside it. */
async function toPng(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelector('.sh-logo')?.setAttribute('href', await dataUrl(logo, 'image/svg+xml'));
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `@font-face{font-family:'Libre Franklin';font-weight:400;src:url(${await dataUrl(f400, 'font/woff2')}) format('woff2')}
@font-face{font-family:'Libre Franklin';font-weight:600;src:url(${await dataUrl(f600, 'font/woff2')}) format('woff2')}`;
  clone.insertBefore(style, clone.firstChild);
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = new Image();
  await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error('image')); img.src = src; });
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
            <div className="sh-prev"><ShareCard tab={tab} svgRef={svg} /></div>
            <div className="pd-acts">
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
