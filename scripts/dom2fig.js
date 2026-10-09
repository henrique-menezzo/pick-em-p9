// Runs in the page: turns the rendered app into a compact tree (boxes, text, icons, images, the dot map)
// that scripts/fig-build.js rebuilds in Figma. Adapted from pick-em-gamemode/perfect/_fig.js.
(function () {
  const R = (v) => Math.round(v * 10) / 10;
  const col = (s) => {
    // color-mix() and friends compute to color(srgb r g b / a), channels 0..1
    const c = s && s.match(/color\(srgb ([^)]+)\)/);
    if (c) s = 'rgba(' + c[1].split(/[ /]+/).filter(Boolean).map((v, i) => (i < 3 ? +v * 255 : +v)).join(',') + ')';
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    if (a === 0) return null;
    return '#' + p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') + (a < 1 ? ':' + Math.round(a * 100) / 100 : '');
  };
  const vis = (e, cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01;
  const name = (e) => (typeof e.className === 'string' && e.className.split(' ').filter(Boolean)[0]) || e.tagName.toLowerCase();
  // edge spaces become non-breaking: Figma's metrics differ slightly and would swallow them inside a row
  const txt = (s, cs) => {
    s = s.replace(/\s+/g, ' ').replace(/^ /, '\u00A0').replace(/ $/, '\u00A0');
    return cs.textTransform === 'uppercase' ? s.toUpperCase() : s;
  };

  function textStyle(cs) {
    const lh = cs.lineHeight === 'normal' ? null : R(parseFloat(cs.lineHeight));
    return { fs: R(parseFloat(cs.fontSize)), fw: +cs.fontWeight, it: cs.fontStyle === 'italic' ? 1 : undefined, c: col(cs.color) || '#fafafa', ls: cs.letterSpacing === 'normal' ? 0 : R(parseFloat(cs.letterSpacing)), lh, ta: cs.textAlign };
  }
  function shadow(cs) {
    const s = cs.boxShadow;
    if (!s || s === 'none') return {};
    const out = {};
    s.split(/,(?![^(]*\))/).forEach((part) => {
      const c = col(part);
      const nums = (part.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
      // a hairline drawn with a hard shadow (0 1px 0): keep it as a line, not a blur
      if (c && !nums[0] && nums[1] && !nums[2] && !nums[3]) { out.ln = [c, /inset/.test(part) ? (nums[1] > 0 ? 'top' : 'bottom') : (nums[1] > 0 ? 'below' : 'above'), Math.abs(nums[1])]; return; }
      if (/inset/.test(part)) { if (nums[3] > 0 && c) out.ist = [c, nums[3]]; }
      else if (c && (nums[2] > 0 || nums[3] > 0)) out.sh = [c, nums[0] || 0, nums[1] || 0, nums[2] || 0, nums[3] || 0];
    });
    return out;
  }

  // text painted with a gradient (background-clip: text): the gradient belongs to the letters, not to a box
  const clipText = (cs) => (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') && /gradient/.test(cs.backgroundImage);

  function svgNode(el, pr, abs) {
    const r = el.getBoundingClientRect();
    if (el.classList.contains('map') && !el.querySelector('g[data-st] path')) {
      // the dot map: geometry comes from grid.json, here we only record each state's colour
      const st = {};
      el.querySelectorAll('g[data-st]').forEach((g) => {
        const c = g.querySelector('circle');
        if (!c) return;
        st[g.dataset.st] = [col(getComputedStyle(c).fill) || '#515151', R(+getComputedStyle(g).opacity)];
      });
      return { k: 'map', abs, n: 'Dot map', x: R(r.left - pr.left), y: R(r.top - pr.top), w: R(r.width), h: R(r.height), vb: el.getAttribute('viewBox'), st };
    }
    const clone = el.cloneNode(true);
    const all = [el, ...el.querySelectorAll('*')], call = [clone, ...clone.querySelectorAll('*')];
    // a stroke that ignores the viewBox scale (vector-effect) keeps its screen width only if we undo the scale
    const vb = el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal.width ? el.viewBox.baseVal : null;
    const k = vb ? vb.width / r.width : 1;
    const gone = [];
    all.forEach((n, i) => {
      const cs = getComputedStyle(n);
      const c = call[i];
      if (i > 0 && (cs.display === 'none' || cs.visibility === 'hidden')) { gone.push(c); return; }
      ['fill', 'stroke'].forEach((p) => {
        const v = col(cs[p]);
        if (v !== null) { c.setAttribute(p, v.split(':')[0]); if (v.includes(':')) c.setAttribute(p + '-opacity', v.split(':')[1]); }
        else if (cs[p] === 'none' || /^rgba\(.*,\s*0\)$/.test(cs[p])) c.setAttribute(p, 'none');
      });
      if (cs.strokeWidth) c.setAttribute('stroke-width', R(parseFloat(cs.strokeWidth) * (cs.vectorEffect === 'non-scaling-stroke' ? k : 1) * 100) / 100);
      if (i > 0 && +cs.opacity < 1) c.setAttribute('opacity', cs.opacity);
      ['class', 'style', 'filter', 'vector-effect'].forEach((a) => i > 0 && c.removeAttribute(a));
      if (n.tagName === 'text') {
        // Figma's SVG import knows neither the page's font nor dominant-baseline: name the font, and move
        // the anchor to the left edge and the alphabetic baseline the browser actually used
        const fs = parseFloat(cs.fontSize), b = n.getBBox();
        c.setAttribute('font-family', 'Libre Franklin');
        c.setAttribute('font-weight', cs.fontWeight);
        c.setAttribute('font-size', fs);
        if (cs.letterSpacing !== 'normal') c.setAttribute('letter-spacing', parseFloat(cs.letterSpacing));
        c.setAttribute('x', R(b.x * 100) / 100);
        if (cs.dominantBaseline === 'central') c.setAttribute('y', R((+n.getAttribute('y') + fs * 0.36) * 100) / 100);
        c.removeAttribute('text-anchor');
        c.removeAttribute('dominant-baseline');
      }
    });
    gone.forEach((c) => c.remove());
    clone.setAttribute('width', R(r.width));
    clone.setAttribute('height', R(r.height));
    clone.removeAttribute('class');
    clone.removeAttribute('style');
    const ov = getComputedStyle(el).overflow === 'visible' ? 1 : undefined;
    return { k: 'svg', abs, ov, n: name(el) || 'icon', x: R(r.left - pr.left), y: R(r.top - pr.top), w: R(r.width), h: R(r.height), svg: clone.outerHTML };
  }

  function build(el, pr) {
    const cs = getComputedStyle(el);
    if (!vis(el, cs)) return null;
    const isAbs = cs.position === 'absolute' || cs.position === 'fixed' ? 1 : undefined;
    if (el instanceof SVGSVGElement) return svgNode(el, pr, isAbs);
    if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT)$/.test(el.tagName)) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) {
      // a zero-size wrapper (e.g. an anchor for an absolutely positioned panel): hoist its children
      for (const c of el.children) { const k = build(c, pr); if (k) return k; }
      return null;
    }
    const base = { n: name(el), x: R(r.left - pr.left), y: R(r.top - pr.top), w: R(r.width), h: R(r.height) };
    if (el.classList && el.classList.contains('wordmark')) return Object.assign(base, { k: 'img', abs: isAbs, n: 'Daily Wire', src: '/src/data/logo.svg' });
    if (el.tagName === 'IMG') return Object.assign(base, { k: 'img', abs: isAbs, src: new URL(el.getAttribute('src'), location.href).pathname, r: R(parseFloat(cs.borderTopLeftRadius) || 0) });

    const node = Object.assign(base, { k: 'f' });
    const bg = col(cs.backgroundColor);
    if (bg) node.bg = bg;
    if (/gradient/.test(cs.backgroundImage) && !clipText(cs)) node.gr = cs.backgroundImage;
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => Math.min(parseFloat(v) || 0, 999));
    if (rad.some(Boolean)) node.r = rad.every((v) => v === rad[0]) ? rad[0] : rad;
    const bw = parseFloat(cs.borderTopWidth), bc = col(cs.borderTopColor);
    if (bw > 0 && bc && cs.borderTopStyle !== 'none') node.st = [bc, bw];
    Object.assign(node, shadow(cs));
    if (+cs.opacity < 1) node.op = R(+cs.opacity);
    if (cs.overflow !== 'visible') node.clip = 1;
    const pad = ['Top', 'Right', 'Bottom', 'Left'].map((s) => R(parseFloat(cs['padding' + s]) + (parseFloat(cs['border' + s + 'Width']) || 0)));
    if (pad.some(Boolean)) node.p = pad;
    if (isAbs) node.abs = 1;

    const disp = cs.display;
    if (/flex/.test(disp)) {
      node.lay = cs.flexDirection.startsWith('column') ? 'V' : 'H';
      node.gap = R(parseFloat(node.lay === 'V' ? cs.rowGap : cs.columnGap) || 0);
      node.jc = cs.justifyContent;
      node.ai = cs.alignItems;
    } else if (/grid/.test(disp)) {
      const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
      if (cols > 1) {
        node.lay = 'H';
        node.cols = cols;
        node.gap = R(parseFloat(cs.columnGap) || 0);
        node.rgap = R(parseFloat(cs.rowGap) || 0);
        node.wrap = 1;
      } else {
        // a one-column grid stacks
        node.lay = 'V';
        node.gap = R(parseFloat(cs.rowGap) || 0);
      }
      node.ai = cs.alignItems;
    }

    const kids = [];
    const onlyText = [...el.childNodes].every((c) => c.nodeType === 3 || (c.nodeType === 1 && c.tagName === 'BR'));
    const all = el.textContent.trim();
    if (onlyText && all) {
      const t = Object.assign({ k: 't', n: 'text', s: txt(el.innerText || all, cs) }, textStyle(cs));
      if (clipText(cs)) t.gr = cs.backgroundImage;
      const rg = document.createRange(); rg.selectNodeContents(el);
      const tr = rg.getBoundingClientRect();
      Object.assign(t, { x: R(tr.left - r.left), y: R(tr.top - r.top), w: R(tr.width), h: R(tr.height) });
      t.one = tr.height < (t.lh || t.fs * 1.4) * 1.6 ? 1 : 0;
      if (!node.bg && !node.gr && !node.st && !node.p && !node.r && !node.sh && !node.abs) {
        Object.assign(t, { x: R(tr.left - pr.left), y: R(tr.top - pr.top), n: name(el), abs: isAbs });
        if (node.op) t.op = node.op;
        return t;
      }
      kids.push(t);
    } else if (all && !/flex|grid/.test(cs.display) && [...el.children].every((c) => getComputedStyle(c).display === 'inline' && !col(getComputedStyle(c).backgroundColor) && ['fontSize', 'fontWeight', 'color'].every((k) => getComputedStyle(c)[k] === cs[k]) && !c.children.length && !(c instanceof SVGElement)) && r.height > (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2) * 1.6) {
      // a wrapped line with inline pieces in it (an <em>, a <b>): one text box, wrapped at the element's width
      const t = Object.assign({ k: 't', n: 'text', s: txt(el.innerText || all, cs), one: 0 }, textStyle(cs));
      const p = node.p || [0, 0, 0, 0];
      Object.assign(t, { x: p[3], y: p[0], w: R(r.width - p[1] - p[3]), h: R(r.height - p[0] - p[2]) });
      kids.push(t);
    } else {
      for (const c of el.childNodes) {
        if (c.nodeType === 3) {
          const s = c.textContent.replace(/\s+/g, ' ');
          if (!s.trim()) continue;
          const rg = document.createRange(); rg.selectNodeContents(c);
          const tr = rg.getBoundingClientRect();
          if (tr.width < 1) continue;
          kids.push(Object.assign({ k: 't', n: 'text', one: 1, s: txt(s, cs), x: R(tr.left - r.left), y: R(tr.top - r.top), w: R(tr.width), h: R(tr.height) }, textStyle(cs)));
        } else if (c.nodeType === 1) {
          const k = build(c, r);
          if (k) kids.push(k);
        }
      }
      if (!/flex|grid/.test(disp) && kids.length > 1 && [...el.children].every((c) => /inline/.test(getComputedStyle(c).display))) {
        node.lay = 'H'; node.gap = 0; node.ai = 'baseline';
      }
    }
    node.kids = kids;
    // auto layout only where it reproduces what the browser drew: margins, auto margins and
    // space-between grids do not survive it, so those boxes keep absolute positions
    if (node.lay) {
      const flow = kids.filter((k) => !k.abs);
      const V = node.lay === 'V';
      const P = (k) => (V ? k.y : k.x), Q = (k) => (V ? k.x : k.y), S = (k) => (V ? k.h : k.w);
      const p = node.p || [0, 0, 0, 0];
      let ok = true;
      if (node.wrap) {
        for (let i = 1; i < flow.length; i++) {
          const a = flow[i - 1], b = flow[i];
          if (Math.abs(Q(b) - Q(a)) < 1 && Math.abs(P(b) - (P(a) + S(a)) - node.gap) > 1.5) ok = false;
        }
      } else if (!/space-(between|around|evenly)/.test(node.jc || '')) {
        for (let i = 1; i < flow.length; i++) if (Math.abs(P(flow[i]) - (P(flow[i - 1]) + S(flow[i - 1])) - node.gap) > 1.5) ok = false;
      }
      if (ok && flow.length && /^(normal|flex-start|start|left)?$/.test(node.jc || '') && Math.abs(P(flow[0]) - (V ? p[0] : p[3])) > 1.5) ok = false;
      if (!ok) { delete node.lay; delete node.gap; delete node.jc; delete node.ai; delete node.wrap; delete node.rgap; delete node.cols; }
    }
    if (kids.length === 1 && !node.bg && !node.gr && !node.st && !node.sh && !node.r && !node.p && !node.abs && !node.clip && Math.abs(kids[0].w - node.w) < 1 && Math.abs(kids[0].h - node.h) < 1) {
      const k = kids[0];
      k.x += node.x; k.y += node.y;
      if (k.n === 'text' || k.n === 'div') k.n = node.n;
      return k;
    }
    return node;
  }

  const app = document.querySelector('.p6') || document.querySelector('.app') || document.body;
  const rect = app.getBoundingClientRect();
  const tree = build(app, { left: rect.left, top: rect.top });
  tree.n = window.__FIG_NAME || 'Pick Em (from code)';
  tree.x = 0; tree.y = 0;
  tree.bg = '#0a0909';
  return JSON.stringify(tree);
})();
