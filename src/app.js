/* VectorDrop – Hauptprogramm. Stellt für text.js und wizard.js die Schnittstelle window.VD bereit. */
(() => {
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const STORE = 'vectordrop.v1';
const CUT_COLOR = '#ff0000';      // Farbe für „Umriss (Schnitt)“
const CUT_WIDTH = 0.1;            // Linienstärke im Export (mm)

/* ---------- Standard-Bibliothek ---------- */
const poly = (n, rot = -90) => Array.from({ length: n }, (_, k) => { const a = (rot + 360 * k / n) * Math.PI / 180; return (50 + 48 * Math.cos(a)).toFixed(1) + ',' + (50 + 48 * Math.sin(a)).toFixed(1); }).join(' ');
const B = '#000';
const DEFAULT_LIB = [
  { key: 'kreis',     name: 'Kreis',                vb: [0,0,100,100], inner: `<circle cx="50" cy="50" r="48" fill="${B}"/>` },
  { key: 'ellipse',   name: 'Ellipse',              vb: [0,0,160,100], inner: `<ellipse cx="80" cy="50" rx="78" ry="48" fill="${B}"/>` },
  { key: 'quadrat',   name: 'Quadrat',              vb: [0,0,100,100], inner: `<rect x="2" y="2" width="96" height="96" fill="${B}"/>` },
  { key: 'rechteck',  name: 'Rechteck',             vb: [0,0,160,100], inner: `<rect x="2" y="2" width="156" height="96" fill="${B}"/>` },
  { key: 'rundrect',  name: 'Rechteck abgerundet',  vb: [0,0,160,100], inner: `<rect x="2" y="2" width="156" height="96" rx="16" fill="${B}"/>` },
  { key: 'ring',      name: 'Ring',                 vb: [0,0,100,100], inner: `<path fill="${B}" fill-rule="evenodd" d="M50 2 A48 48 0 1 1 49.99 2 Z M50 22 A28 28 0 1 0 50.01 22 Z"/>` },
  { key: 'halbkreis', name: 'Halbkreis',            vb: [0,0,100,50],  inner: `<path d="M2 50 A48 48 0 0 1 98 50 Z" fill="${B}"/>` },
  { key: 'viertel',   name: 'Viertelkreis',         vb: [0,0,100,100], inner: `<path d="M2 98 L2 2 A96 96 0 0 1 98 98 Z" fill="${B}"/>` },
  { key: 'dreieck',   name: 'Dreieck',              vb: [0,0,100,100], inner: `<polygon points="50,3 98,97 2,97" fill="${B}"/>` },
  { key: 'rwdreieck', name: 'Rechtwinkliges Dreieck', vb: [0,0,100,100], inner: `<polygon points="2,98 98,98 2,2" fill="${B}"/>` },
  { key: 'raute',     name: 'Raute',                vb: [0,0,100,100], inner: `<polygon points="50,2 98,50 50,98 2,50" fill="${B}"/>` },
  { key: 'trapez',    name: 'Trapez',               vb: [0,0,160,100], inner: `<polygon points="32,2 128,2 158,98 2,98" fill="${B}"/>` },
  { key: 'fuenfeck',  name: 'Fünfeck',              vb: [0,0,100,100], inner: `<polygon points="${poly(5)}" fill="${B}"/>` },
  { key: 'sechseck',  name: 'Sechseck',             vb: [0,0,100,100], inner: `<polygon points="${poly(6, 0)}" fill="${B}"/>` },
  { key: 'achteck',   name: 'Achteck',              vb: [0,0,100,100], inner: `<polygon points="${poly(8, -67.5)}" fill="${B}"/>` },
  { key: 'pfeil',     name: 'Pfeil',                vb: [0,0,160,100], inner: `<polygon points="2,32 100,32 100,4 158,50 100,96 100,68 2,68" fill="${B}"/>` },
  { key: 'kreuz',     name: 'Kreuz (Plus)',         vb: [0,0,100,100], inner: `<polygon points="35,2 65,2 65,35 98,35 98,65 65,65 65,98 35,98 35,65 2,65 2,35 35,35" fill="${B}"/>` },
  { key: 'stern',     name: 'Stern',                vb: [0,0,100,100], inner: `<polygon points="50,3 62,36 97,38 70,60 80,95 50,75 20,95 30,60 3,38 38,36" fill="${B}"/>` },
  { key: 'herz',      name: 'Herz',                 vb: [0,0,100,100], inner: `<path d="M50 92 C8 60 2 34 20 18 C35 6 48 16 50 28 C52 16 65 6 80 18 C98 34 92 60 50 92Z" fill="${B}"/>` },
  { key: 'haus',      name: 'Haus',                 vb: [0,0,100,100], inner: `<path fill="${B}" fill-rule="evenodd" d="M50 4 L97 46 L84 46 L84 96 L16 96 L16 46 L3 46 Z M42 96 L42 66 L58 66 L58 96 Z"/>` },
];

/* ---------- Zustand ---------- */
const S = {
  maxW: 300, maxH: 300,     // aus den Einstellungen (mm)
  W: 200, H: 150,           // aktuelle Arbeitsfläche (mm)
  lib: [],                  // {id,name,vb,inner,cat}
  items: [],                // {id,libId,x,y,w,h,rot,fx,fy,mode,gid}
  sel: [],
  zoom: 3,                  // Pixel pro mm
  grid: false, snap: true, gridSize: 5, exportColors: false,
  folders: [], hiddenKeys: [],
  filterCat: '', search: '',
};
let undoStack = [];
let uid = 1;
const newId = (p) => p + Date.now().toString(36) + (uid++);
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const round = (v) => Math.round(v * 100) / 100;
const rad = (d) => d * Math.PI / 180;
const numf = (n) => +n.toFixed(5);

const normItem = (i) => ({ rot: 0, fx: false, fy: false, mode: 'fill', gid: null, color: null, off: 0, offN: 1, offKeep: true, ...i });

function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ maxW: S.maxW, maxH: S.maxH, W: S.W, H: S.H, lib: S.lib, items: S.items, grid: S.grid, snap: S.snap, gridSize: S.gridSize, exportColors: S.exportColors, folders: S.folders, hiddenKeys: S.hiddenKeys })); } catch (e) {}
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (d && Array.isArray(d.lib)) {
      Object.assign(S, { maxW: d.maxW || 300, maxH: d.maxH || 300, W: d.W || 200, H: d.H || 150, lib: d.lib, items: (d.items || []).map(normItem) });
      if (typeof d.grid === 'boolean') S.grid = d.grid;
      if (typeof d.snap === 'boolean') S.snap = d.snap;
      if (d.gridSize > 0) S.gridSize = d.gridSize;
      if (typeof d.exportColors === 'boolean') S.exportColors = d.exportColors;
      if (Array.isArray(d.folders)) S.folders = d.folders;
      if (Array.isArray(d.hiddenKeys)) S.hiddenKeys = d.hiddenKeys;
      const builtin = new Set(DEFAULT_LIB.map((l) => l.name));
      S.lib.forEach((l) => { if (!l.cat) l.cat = builtin.has(l.name) && l.inner.includes('#') ? 'Formen' : 'Eigene'; });
      mergeDefaults();
      return;
    }
  } catch (e) {}
  S.lib = DEFAULT_LIB.map((l) => ({ ...l, id: newId('l'), cat: 'Formen' }));
}
/* Neue Standardformen auch in bestehende Bibliotheken aufnehmen (außer vom Nutzer entfernte) */
function mergeDefaults() {
  const hidden = new Set(S.hiddenKeys);
  DEFAULT_LIB.forEach((d) => {
    const ex = S.lib.find((l) => l.key === d.key) || S.lib.find((l) => !l.key && l.cat === 'Formen' && l.name === d.name);
    if (ex) { ex.key = d.key; return; }
    if (!hidden.has(d.key)) S.lib.push({ ...d, id: newId('l'), cat: 'Formen' });
  });
}

/* ---------- Hilfsfunktionen ---------- */
const libOf = (it) => S.lib.find((l) => l.id === it.libId);
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
function snapshot() { undoStack.push(JSON.stringify({ items: S.items, W: S.W, H: S.H })); if (undoStack.length > 100) undoStack.shift(); }
function undo() {
  const s = undoStack.pop(); if (!s) return;
  const d = JSON.parse(s); S.items = d.items; S.W = d.W; S.H = d.H;
  S.sel = S.sel.filter((id) => S.items.some((i) => i.id === id));
  render(); save();
}
function categories() { return [...new Set([...S.folders, ...S.lib.map((l) => l.cat).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'de')); }

/* IDs innerhalb eines Teils eindeutig machen (Verläufe etc.), damit Kopien sich nicht stören */
function uniq(inner, prefix) {
  if (!inner.includes('id="')) return inner;
  const ids = [...inner.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  let out = inner;
  ids.forEach((id) => {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('id="' + esc + '"', 'g'), 'id="' + prefix + id + '"')
             .replace(new RegExp('url\\(#' + esc + '\\)', 'g'), 'url(#' + prefix + id + ')')
             .replace(new RegExp('href="#' + esc + '"', 'g'), 'href="#' + prefix + id + '"');
  });
  return out;
}

/* ---------- Geometrie (Drehung, Spiegelung) ---------- */
const center = (it) => ({ x: it.x + it.w / 2, y: it.y + it.h / 2 });
function corners(it) {
  const c = center(it), a = rad(it.rot || 0), co = Math.cos(a), si = Math.sin(a);
  return [[-it.w/2, -it.h/2], [it.w/2, -it.h/2], [it.w/2, it.h/2], [-it.w/2, it.h/2]].map(([x, y]) => ({ x: c.x + x * co - y * si, y: c.y + x * si + y * co }));
}
function box(it) {
  const cs = corners(it), xs = cs.map((p) => p.x), ys = cs.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
function bounds(items) {
  const bs = items.map(box);
  const x1 = Math.min(...bs.map((b) => b.x)), y1 = Math.min(...bs.map((b) => b.y));
  const x2 = Math.max(...bs.map((b) => b.x + b.w)), y2 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
const selItems = () => S.items.filter((i) => S.sel.includes(i.id));
const normRot = (r) => { r = ((r % 360) + 360) % 360; return r > 180 ? r - 360 : r; };
const mul = (m, n) => [m[0]*n[0] + m[2]*n[1], m[1]*n[0] + m[3]*n[1], m[0]*n[2] + m[2]*n[3], m[1]*n[2] + m[3]*n[3], m[0]*n[4] + m[2]*n[5] + m[4], m[1]*n[4] + m[3]*n[5] + m[5]];
function itemMatrix(it, l) {
  const sx = it.w / l.vb[2], sy = it.h / l.vb[3], c = center(it), a = rad(it.rot || 0);
  const base = [sx, 0, 0, sy, it.x - l.vb[0] * sx, it.y - l.vb[1] * sy];
  const T = [1, 0, 0, 1, c.x, c.y], R = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
  const F = [it.fx ? -1 : 1, 0, 0, it.fy ? -1 : 1, 0, 0], Ti = [1, 0, 0, 1, -c.x, -c.y];
  return mul(mul(mul(mul(T, R), F), Ti), base);
}
const matStr = (m) => 'matrix(' + m.map(numf).join(' ') + ')';

/* Inhalt eines Teils: Original, eingefärbt, oder (Modus „Umriss“) nur dünne Konturen (Schnittlinie) */
const styleCache = new Map();
const SHAPES = 'path,rect,circle,ellipse,polygon,polyline,line';
function stripPaint(el) {
  const st = el.getAttribute('style');
  if (!st) return;
  const n = st.replace(/(^|;)\s*(fill|stroke)[a-z-]*\s*:[^;]*/gi, '$1').trim();
  if (n) el.setAttribute('style', n); else el.removeAttribute('style');
}
function restyle(l, kind, color) {
  const key = l.id + '|' + kind + '|' + color;
  if (styleCache.has(key)) return styleCache.get(key);
  let out = l.inner;
  try {
    const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${l.inner}</svg>`, 'image/svg+xml');
    if (!doc.querySelector('parsererror')) {
      doc.documentElement.querySelectorAll(SHAPES).forEach((el) => {
        if (el.closest('defs,clipPath,mask,pattern,symbol,marker')) return;
        if (kind === 'outline') {
          el.setAttribute('fill', 'none'); el.setAttribute('stroke', color); el.setAttribute('stroke-width', '__SW__');
          el.setAttribute('stroke-linejoin', 'round'); el.removeAttribute('stroke-dasharray'); el.removeAttribute('stroke-opacity'); el.removeAttribute('fill-opacity');
          stripPaint(el);
        } else {   // einfärben: sichtbare Füllung und sichtbare Kontur erhalten die Farbe
          const fillNone = /^none$/i.test(el.getAttribute('fill') || '') || /fill\s*:\s*none/i.test(el.getAttribute('style') || '');
          const strokeOn = (el.getAttribute('stroke') && !/^none$/i.test(el.getAttribute('stroke'))) || /stroke\s*:\s*(?!none)/i.test(el.getAttribute('style') || '');
          stripPaint(el);
          if (!fillNone) el.setAttribute('fill', color);
          if (strokeOn) el.setAttribute('stroke', color);
        }
      });
      out = [...doc.documentElement.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join('');
    }
  } catch (e) {}
  if (styleCache.size > 400) styleCache.clear();
  styleCache.set(key, out);
  return out;
}
function itemInner(it, l, forExport) {
  const col = it.color && (!forExport || S.exportColors) ? it.color : null;
  let inner;
  if (it.mode === 'outline') {
    const cc = col || CUT_COLOR;
    inner = restyle(l, 'outline', cc);
    if (needsOffset(it)) {
      const d = offEntry(it, l).d;
      if (d) inner = (it.offKeep === false ? '' : inner) + `<path d="${d}" fill="none" stroke="${cc}" stroke-width="__SW__" stroke-linejoin="round"/>`;
    }
    const s = Math.sqrt(Math.abs((it.w / l.vb[2]) * (it.h / l.vb[3]))) || 1;
    const sw = forExport ? CUT_WIDTH : Math.max(CUT_WIDTH, 1.3 / S.zoom);
    inner = inner.split('__SW__').join(numf(sw / s));
  } else inner = col ? restyle(l, 'tint', col) : l.inner;
  return uniq(inner, it.id + '_');
}

/* Konturversatz (Offset) für „Umriss“: Ringe um oder in einem Teil */
const offCache = new Map();
const needsOffset = (it) => it.mode === 'outline' && Math.abs(it.off || 0) >= 0.05 && window.VDOffset;
function offEntry(it, l) {
  const n = Math.max(1, Math.min(20, Math.round(it.offN || 1)));
  const k = [l.id, it.w.toFixed(2), it.h.toFixed(2), it.off, n].join('|');
  let e = offCache.get(k);
  if (!e) {
    if (offCache.size > 150) offCache.clear();
    e = { d: null };
    e.p = window.VDOffset.compute(l, it.w, it.h, it.off, n).then((d) => d || '').catch(() => '').then((d) => { e.d = d; return d; });
    e.p.then(() => { if (offCache.get(k) === e) requestAnimationFrame(() => render()); });
    offCache.set(k, e);
  }
  return e;
}
async function ensureOffsets() { await Promise.all(S.items.filter(needsOffset).map((it) => { const l = libOf(it); return l ? offEntry(it, l).p : null; })); }

/* ---------- Prüfungen: außerhalb, Überlappung ---------- */
function polyOverlap(A, B, eps) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      let nx = -(q.y - p.y), ny = q.x - p.x; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      const pr = (Q) => { let mn = 1e12, mx = -1e12; Q.forEach((v) => { const d = v.x * nx + v.y * ny; if (d < mn) mn = d; if (d > mx) mx = d; }); return [mn, mx]; };
      const [a0, a1] = pr(A), [b0, b1] = pr(B);
      if (a1 <= b0 + eps || b1 <= a0 + eps) return false;
    }
  }
  return true;
}
function computeIssues() {
  const out = [], over = new Set(), pairs = [];
  S.items.forEach((it) => { const b = box(it); const pad = needsOffset(it) && it.off > 0 ? it.off * Math.max(1, it.offN || 1) : 0; b.x -= pad; b.y -= pad; b.w += 2 * pad; b.h += 2 * pad; if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > S.W + 0.01 || b.y + b.h > S.H + 0.01) out.push(it.id); });
  const cut = S.items.filter((i) => i.mode === 'outline');
  for (let a = 0; a < cut.length; a++) for (let b = a + 1; b < cut.length; b++) {
    if (cut[a].gid && cut[a].gid === cut[b].gid) continue;
    if (polyOverlap(corners(cut[a]), corners(cut[b]), 0.05)) { over.add(cut[a].id); over.add(cut[b].id); pairs.push([cut[a].id, cut[b].id]); }
  }
  return { out, over: [...over], pairs: pairs.length };
}

/* ---------- SVG importieren ---------- */
function parseSvgText(text, fileName) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
  root.querySelectorAll('script,foreignObject').forEach((n) => n.remove());
  root.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(a.name);
      else if ((n === 'href' || n === 'xlink:href') && !(v.startsWith('#') || v.startsWith('data:image/'))) el.removeAttribute(a.name);
    });
  });
  let vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
    const w = parseFloat(root.getAttribute('width')) || 100, h = parseFloat(root.getAttribute('height')) || 100;
    vb = [0, 0, w, h];
  }
  const inner = [...root.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join('');
  return { id: newId('l'), name: fileName.replace(/\.svg$/i, ''), vb, inner, cat: 'Eigene' };
}
let pendingFiles = [];
function importFiles(files) {
  files = files.filter((f) => /\.svg$/i.test(f.name) || f.type === 'image/svg+xml');
  if (!files.length) { toast('Keine SVG-Dateien gefunden.'); return; }
  pendingFiles = files;
  $('impInfo').textContent = files.length === 1 ? '1 SVG-Datei: ' + files[0].name : files.length + ' SVG-Dateien ausgewählt';
  $('impCat').value = S.filterCat || 'Eigene';
  $('importDlg').showModal(); $('impCat').select();
}
$('impCancel').onclick = () => { pendingFiles = []; $('importDlg').close(); };
$('impOk').onclick = async () => {
  const cat = $('impCat').value.trim() || 'Eigene';
  $('importDlg').close();
  let ok = 0;
  for (const f of pendingFiles) {
    const lib = parseSvgText(await f.text(), f.name);
    if (lib) { lib.cat = cat; S.lib.push(lib); ok++; } else toast('„' + f.name + '“ ist keine gültige SVG-Datei.');
  }
  pendingFiles = [];
  if (ok) { S.filterCat = cat; renderLibrary(); save(); toast(ok + ' Teil(e) in den Ordner „' + cat + '“ geladen.'); }
};
function addLibEntry({ name, vb, inner, cat }) {
  const lib = { id: newId('l'), name: name || 'Teil', vb, inner, cat: cat || S.filterCat || 'Eigene' };
  S.lib.push(lib); renderLibrary(); save(); return lib;
}

/* ---------- Bibliothek anzeigen ---------- */
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function renderLibrary() {
  const cats = categories();
  if (S.filterCat && !cats.includes(S.filterCat)) S.filterCat = '';
  $('catList').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
  const fl = $('folderList'); fl.innerHTML = '';
  const mk = (label, cat, count) => {
    const b = document.createElement('button'); b.className = 'fold' + (S.filterCat === cat ? ' on' : '');
    b.innerHTML = `<span class="ic">${cat ? (S.filterCat === cat ? '📂' : '📁') : '🗂'}</span><span class="fn">${esc(label)}</span><span class="cnt">${count}</span>`;
    b.onclick = () => { S.filterCat = cat; renderLibrary(); };
    if (cat && count === 0) { const x = document.createElement('span'); x.className = 'fx'; x.textContent = '×'; x.title = 'Leeren Ordner löschen'; x.onclick = (e) => { e.stopPropagation(); S.folders = S.folders.filter((f) => f !== cat); if (S.filterCat === cat) S.filterCat = ''; renderLibrary(); save(); }; b.append(x); }
    fl.append(b);
  };
  mk('Alle Ordner', '', S.lib.length);
  cats.forEach((c) => mk(c, c, S.lib.filter((l) => l.cat === c).length));
  $('renFolderBtn').disabled = !S.filterCat;
  $('activeInfo').innerHTML = S.filterCat
    ? `<b>Du arbeitest in:</b> 📂 ${esc(S.filterCat)}<br><span>Neue Teile (SVG-Import, Text, Bild) landen hier.</span>`
    : `<b>Alle Ordner</b> werden angezeigt.<br><span>Neue Teile landen im Ordner „Eigene“. Wähle einen Ordner, um darin zu arbeiten.</span>`;
  const q = S.search.trim().toLowerCase();
  const box = $('library'); box.innerHTML = '';
  const list = S.lib.filter((l) => (!S.filterCat || l.cat === S.filterCat) && (!q || l.name.toLowerCase().includes(q) || (l.cat || '').toLowerCase().includes(q)));
  $('libHead').textContent = (S.filterCat ? S.filterCat : 'Alle Ordner') + ' · ' + list.length + ' Teil' + (list.length === 1 ? '' : 'e');
  if (!list.length) box.innerHTML = '<div class="hint" style="grid-column:1/-1">' + (S.lib.length ? 'Nichts gefunden.' : 'Die Bibliothek ist leer.') + '</div>';
  list.forEach((l) => {
    const c = document.createElement('div'); c.className = 'card'; c.draggable = true; c.title = l.name + (l.cat ? ' · ' + l.cat : '');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', l.vb.join(' ')); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = uniq(l.inner, 'th' + l.id + '_');
    const n = document.createElement('div'); n.className = 'name'; n.textContent = l.name;
    const k = document.createElement('div'); k.className = 'cat'; k.textContent = S.filterCat ? '' : (l.cat || '');
    const d = document.createElement('button'); d.className = 'del'; d.textContent = '×'; d.title = 'Aus Bibliothek entfernen';
    d.onclick = (e) => {
      e.stopPropagation();
      if (!confirm('„' + l.name + '“ aus der Bibliothek entfernen?\nBereits platzierte Exemplare auf der Arbeitsfläche werden ebenfalls entfernt.')) return;
      if (l.key && !S.hiddenKeys.includes(l.key)) S.hiddenKeys.push(l.key);
      S.lib = S.lib.filter((x) => x.id !== l.id); S.items = S.items.filter((i) => i.libId !== l.id); S.sel = []; undoStack = [];
      renderLibrary(); render(); save();
    };
    const ed = document.createElement('button'); ed.className = 'ed'; ed.textContent = '✎'; ed.title = 'Name und Ordner ändern';
    ed.onclick = (e) => { e.stopPropagation(); editLib(l); };
    c.append(svg, n, k, d, ed);
    c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-vectordrop', l.id); e.dataTransfer.effectAllowed = 'copy'; });
    c.addEventListener('dblclick', () => addItem(l.id, S.W / 2, S.H / 2));
    box.append(c);
  });
}
function editLib(l) {
  $('leName').value = l.name; $('leCat').value = l.cat || '';
  $('leSave').onclick = () => { l.name = $('leName').value.trim() || l.name; l.cat = $('leCat').value.trim() || 'Eigene'; $('libDlg').close(); renderLibrary(); save(); };
  $('libDlg').showModal();
}
$('leCancel').onclick = () => $('libDlg').close();
$('libSearch').addEventListener('input', (e) => { S.search = e.target.value; renderLibrary(); });

/* Ordner anlegen / umbenennen */
let folderMode = 'new';
function openFolderDlg(mode) {
  folderMode = mode;
  $('fdTitle').textContent = mode === 'new' ? 'Neuer Ordner' : 'Ordner umbenennen';
  $('fdName').value = mode === 'new' ? '' : S.filterCat;
  $('folderDlg').showModal(); $('fdName').focus();
}
$('newFolderBtn').onclick = () => openFolderDlg('new');
$('renFolderBtn').onclick = () => { if (S.filterCat) openFolderDlg('rename'); };
$('fdCancel').onclick = () => $('folderDlg').close();
$('fdSave').onclick = () => {
  const name = $('fdName').value.trim().slice(0, 30); if (!name) return;
  if (folderMode === 'new') { if (!S.folders.includes(name)) S.folders.push(name); S.filterCat = name; }
  else {
    const old = S.filterCat;
    S.lib.forEach((l) => { if (l.cat === old) l.cat = name; });
    S.folders = S.folders.map((f) => (f === old ? name : f)); S.filterCat = name;
  }
  $('folderDlg').close(); renderLibrary(); save();
};
$('fdName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('fdSave').click(); });

/* ---------- Arbeitsfläche zeichnen ---------- */
const cv = $('canvas');
let drag = null;

function render() {
  const z = S.zoom;
  cv.setAttribute('viewBox', `0 0 ${S.W} ${S.H}`);
  cv.setAttribute('width', S.W * z); cv.setAttribute('height', S.H * z);
  let html = '';
  if (S.grid && S.gridSize * z >= 5) {
    let d = ''; const g = S.gridSize;
    for (let x = g; x < S.W; x += g) d += `M${numf(x)} 0V${S.H}`;
    for (let y = g; y < S.H; y += g) d += `M0 ${numf(y)}H${S.W}`;
    html += `<path d="${d}" stroke="#d5dae2" stroke-width="${0.7 / z}" fill="none" style="pointer-events:none"/>`;
  }
  html += '<g id="layItems">';
  S.items.forEach((it) => {
    const l = libOf(it); if (!l) return;
    html += `<g data-id="${it.id}" transform="${matStr(itemMatrix(it, l))}" style="cursor:move${it.mode === 'outline' ? ';pointer-events:visible' : ''}">${itemInner(it, l, false)}</g>`;
  });
  html += '</g><g id="layOv"></g>';
  cv.innerHTML = html;
  renderOverlay();
  $('emptyHint').style.display = S.items.length ? 'none' : '';
  $('wsW').value = S.W; $('wsH').value = S.H;
  $('gridChk').checked = S.grid; $('snapChk').checked = S.snap;
  renderProps(); renderStatus();
  $('undoBtn').disabled = !undoStack.length;
  document.querySelectorAll('[data-align]').forEach((b) => { const a = b.dataset.align, n = S.sel.length; b.disabled = a.startsWith('dist') ? n < 3 : n < 1; });
}
function updateTransforms(ids) {
  ids.forEach((id) => { const it = S.items.find((i) => i.id === id), l = it && libOf(it), el = cv.querySelector(`#layItems > [data-id="${id}"]`); if (el && l) el.setAttribute('transform', matStr(itemMatrix(it, l))); });
}
function renderOverlay() {
  const ov = $('layOv'); if (!ov) return;
  const z = S.zoom, px = 1 / z, hs = 9 * px, sw = 1.5 * px;
  let h = '';
  const iss = computeIssues();
  iss.out.forEach((id) => { const b = box(S.items.find((i) => i.id === id)); h += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="rgba(211,58,58,.08)" stroke="#d33a3a" stroke-width="${sw}" stroke-dasharray="${5*px} ${3*px}" style="pointer-events:none"/>`; });
  iss.over.forEach((id) => { const b = box(S.items.find((i) => i.id === id)); h += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#f08c00" stroke-width="${sw}" stroke-dasharray="${2*px} ${3*px}" style="pointer-events:none"/>`; });
  const sel = selItems();
  if (sel.length) {
    h += '<g style="pointer-events:none">';
    sel.forEach((i) => { const c = center(i); h += `<rect transform="rotate(${numf(i.rot || 0)} ${numf(c.x)} ${numf(c.y)})" x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" fill="none" stroke="#2563eb" stroke-width="${sw}" ${sel.length > 1 ? `stroke-dasharray="${4*px} ${3*px}"` : ''}/>`; });
    if (sel.length > 1) { const b = bounds(sel); h += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#2563eb" stroke-width="${sw}"/>`; }
    h += '</g>';
    if (sel.length === 1) {
      const i = sel[0], c = center(i), cur = (n) => ((i.rot || 0) % 180 === 0 ? n + '-resize' : 'crosshair');
      h += `<g transform="rotate(${numf(i.rot || 0)} ${numf(c.x)} ${numf(c.y)})">`;
      h += `<line x1="${c.x}" y1="${i.y}" x2="${c.x}" y2="${i.y - 24 * px}" stroke="#2563eb" stroke-width="${sw}" style="pointer-events:none"/>`;
      h += `<circle data-h="rot" cx="${c.x}" cy="${i.y - 24 * px}" r="${6 * px}" fill="#fff" stroke="#2563eb" stroke-width="${sw}" style="cursor:grab"><title>Drehen (Umschalt: 15°-Schritte)</title></circle>`;
      [['nw', i.x, i.y], ['n', c.x, i.y], ['ne', i.x + i.w, i.y], ['e', i.x + i.w, c.y], ['se', i.x + i.w, i.y + i.h], ['s', c.x, i.y + i.h], ['sw', i.x, i.y + i.h], ['w', i.x, c.y]]
        .forEach(([k, hx, hy]) => { h += `<rect data-h="${k}" x="${hx - hs / 2}" y="${hy - hs / 2}" width="${hs}" height="${hs}" fill="#fff" stroke="#2563eb" stroke-width="${sw}" style="cursor:${cur(k)}"/>`; });
      h += '</g>';
    }
  }
  if (drag && drag.guides) {
    drag.guides.x.forEach((x) => { h += `<line x1="${x}" y1="0" x2="${x}" y2="${S.H}" stroke="#e0369b" stroke-width="${px}" style="pointer-events:none"/>`; });
    drag.guides.y.forEach((y) => { h += `<line x1="0" y1="${y}" x2="${S.W}" y2="${y}" stroke="#e0369b" stroke-width="${px}" style="pointer-events:none"/>`; });
  }
  if (drag && drag.mode === 'rubber') {
    const r = rubberRect();
    h += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="rgba(37,99,235,.08)" stroke="#2563eb" stroke-width="${px}" stroke-dasharray="${4*px} ${3*px}" style="pointer-events:none"/>`;
  }
  ov.innerHTML = h;
}
function renderStatus() {
  const iss = computeIssues(), st = $('status');
  let h = '';
  if (!iss.out.length && !iss.pairs) h += `<span class="ok">✔ Alles innerhalb der Arbeitsfläche, keine doppelten Schnitte</span>`;
  if (iss.out.length) h += `<button data-sel="out">⚠ ${iss.out.length} Teil(e) ragen über die Arbeitsfläche hinaus</button>`;
  if (iss.pairs) h += `<button data-sel="over">⚠ ${iss.pairs} Überlappung(en) von Schnittlinien – würden doppelt geschnitten</button>`;
  const cut = S.items.filter((i) => i.mode === 'outline').length;
  h += `<span class="info">${S.items.length} Teil(e) · ${cut} Schnitt · ${S.items.length - cut} Gravur · ${S.W} × ${S.H} mm</span>`;
  st.innerHTML = h;
  st.querySelectorAll('[data-sel]').forEach((b) => b.onclick = () => { S.sel = b.dataset.sel === 'out' ? computeIssues().out : computeIssues().over; render(); });
}

function renderProps() {
  const sel = selItems();
  $('props').hidden = sel.length === 0; $('propsEmpty').hidden = sel.length !== 0;
  if (!sel.length) return;
  const b = bounds(sel), single = sel.length === 1, it = sel[0];
  $('pX').value = round(b.x); $('pY').value = round(b.y);
  $('pW').value = round(single ? it.w : b.w); $('pH').value = round(single ? it.h : b.h);
  $('pR').value = single ? round(it.rot || 0) : '';
  ['pW', 'pH', 'pLock', 'pR'].forEach((id) => $(id).disabled = !single);
  const modes = new Set(sel.map((i) => i.mode));
  document.querySelectorAll('#modeSeg button').forEach((bt) => bt.classList.toggle('on', modes.size === 1 && modes.has(bt.dataset.mode)));
  const outl = sel.filter((i) => i.mode === 'outline');
  $('offBox').hidden = !outl.length;
  if (outl.length) { $('pOff').value = outl[0].off || 0; $('pOffN').value = outl[0].offN || 1; $('pOffKeep').checked = outl[0].offKeep !== false; $('pOffN').disabled = !(outl[0].off); $('pOffKeep').disabled = !(outl[0].off); }
  const cols = new Set(sel.map((i) => i.color || ''));
  $('colIn').value = cols.size === 1 && sel[0].color ? sel[0].color : '#000000';
  document.querySelectorAll('#swatches button').forEach((bt) => bt.classList.toggle('on', cols.size === 1 && sel[0].color === bt.dataset.c));
  $('grpBtn').disabled = sel.length < 2; $('ungrpBtn').disabled = !sel.some((i) => i.gid);
}

/* ---------- Teile hinzufügen ---------- */
function addItemRaw({ libId, x, y, w, h, gid }) {
  const it = normItem({ id: newId('i'), libId, x: round(x), y: round(y), w: round(w), h: round(h), gid: gid || null });
  S.items.push(it); return it;
}
function addItem(libId, cx, cy) {
  const l = S.lib.find((x) => x.id === libId); if (!l) return;
  snapshot();
  const target = Math.min(S.W, S.H) * 0.3, ratio = l.vb[2] / l.vb[3];
  const w = ratio >= 1 ? target : target * ratio, h = ratio >= 1 ? target / ratio : target;
  const it = addItemRaw({ libId, x: cx - w / 2, y: cy - h / 2, w, h });
  S.sel = [it.id]; render(); save();
}
const groupOf = (id) => { const it = S.items.find((i) => i.id === id); return it && it.gid ? S.items.filter((i) => i.gid === it.gid).map((i) => i.id) : [id]; };
const selectIds = (ids) => { S.sel = [...new Set(ids.flatMap(groupOf))]; };

/* ---------- Maus / Zeiger ---------- */
function pt(e) {
  const p = cv.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  const m = p.matrixTransform(cv.getScreenCTM().inverse()); return { x: m.x, y: m.y };
}
function rubberRect() { const a = drag.start, b = drag.cur; return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }; }

cv.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const p = pt(e), hEl = e.target.closest('[data-h]');
  if (hEl && S.sel.length === 1) {
    const it = selItems()[0]; snapshot();
    drag = hEl.dataset.h === 'rot' ? { mode: 'rotate', id: it.id, c: center(it) } : { mode: 'resize', h: hEl.dataset.h, start: p, orig: { ...it }, id: it.id };
    cv.setPointerCapture(e.pointerId); return;
  }
  const el = e.target.closest('[data-id]');
  if (!el) {
    drag = { mode: 'rubber', start: p, cur: p, add: e.shiftKey, base: e.shiftKey ? [...S.sel] : [], moved: false };
    if (!e.shiftKey && S.sel.length) { S.sel = []; render(); }
    cv.setPointerCapture(e.pointerId); return;
  }
  const id = el.dataset.id, grp = groupOf(id);
  if (e.shiftKey) S.sel = S.sel.includes(id) ? S.sel.filter((x) => !grp.includes(x)) : [...new Set([...S.sel, ...grp])];
  else if (!S.sel.includes(id)) S.sel = [...grp];
  render();
  if (!S.sel.includes(id)) return;
  snapshot();
  const sel = selItems();
  drag = { mode: 'move', start: p, origs: sel.map((i) => ({ id: i.id, x: i.x, y: i.y })), b0: bounds(sel), moved: false, guides: { x: [], y: [] },
           others: S.items.filter((i) => !S.sel.includes(i.id)).map(box) };
  cv.setPointerCapture(e.pointerId);
});

function snapMove(dx, dy) {
  const b = drag.b0, thr = 7 / S.zoom;
  const cx = [b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], cy = [b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h];
  const tx = [0, S.W / 2, S.W], ty = [0, S.H / 2, S.H];
  drag.others.forEach((o) => { tx.push(o.x, o.x + o.w / 2, o.x + o.w); ty.push(o.y, o.y + o.h / 2, o.y + o.h); });
  const best = (cands, targets) => {
    let bd = thr, bv = 0, bt = null;
    cands.forEach((c, i) => {
      targets.forEach((t) => { const d = t - c; if (Math.abs(d) < bd - 1e-9) { bd = Math.abs(d); bv = d; bt = t; } });
      if (S.grid && i !== 1) { const g = S.gridSize, t = Math.round(c / g) * g, d = t - c; if (Math.abs(d) < bd - 1e-9) { bd = Math.abs(d); bv = d; bt = null; } }
    });
    return { v: bv, t: bt };
  };
  const bx = best(cx, tx), by = best(cy, ty);
  drag.guides = { x: bx.t === null ? [] : [bx.t], y: by.t === null ? [] : [by.t] };
  return { dx: dx + bx.v, dy: dy + by.v };
}

cv.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = pt(e);
  if (drag.mode === 'rubber') { drag.cur = p; drag.moved = Math.hypot(p.x - drag.start.x, p.y - drag.start.y) * S.zoom > 3; renderOverlay(); return; }
  if (drag.mode === 'move') {
    drag.moved = true;
    let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (S.snap && !e.ctrlKey) ({ dx, dy } = snapMove(dx, dy)); else drag.guides = { x: [], y: [] };
    drag.origs.forEach((o) => { const it = S.items.find((i) => i.id === o.id); it.x = round(o.x + dx); it.y = round(o.y + dy); });
    updateTransforms(drag.origs.map((o) => o.id));
  } else if (drag.mode === 'rotate') {
    const it = S.items.find((i) => i.id === drag.id);
    let ang = Math.atan2(p.y - drag.c.y, p.x - drag.c.x) * 180 / Math.PI + 90;
    ang = e.shiftKey ? Math.round(ang / 15) * 15 : Math.round(ang);
    if (!e.shiftKey) { const nr = Math.round(ang / 90) * 90; if (Math.abs(normRot(ang - nr)) <= 2) ang = nr; }
    it.rot = normRot(ang); updateTransforms([it.id]);
  } else if (drag.mode === 'resize') {
    const it = S.items.find((i) => i.id === drag.id), o = drag.orig, k = drag.h, min = 2;
    const a = rad(o.rot || 0), co = Math.cos(a), si = Math.sin(a);
    const wx = p.x - drag.start.x, wy = p.y - drag.start.y;
    const dx = wx * co + wy * si, dy = -wx * si + wy * co;   // Verschiebung im Eigenkoordinatensystem des Teils
    let x1 = -o.w / 2, x2 = o.w / 2, y1 = -o.h / 2, y2 = o.h / 2;
    if (k.includes('w')) x1 = Math.min(-o.w / 2 + dx, x2 - min);
    if (k.includes('e')) x2 = Math.max(o.w / 2 + dx, x1 + min);
    if (k.includes('n')) y1 = Math.min(-o.h / 2 + dy, y2 - min);
    if (k.includes('s')) y2 = Math.max(o.h / 2 + dy, y1 + min);
    if ($('pLock').checked && k.length === 2) {
      const r = o.w / o.h; let w = x2 - x1, h = y2 - y1;
      if (w / h > r) w = h * r; else h = w / r;
      w = Math.max(w, min); h = Math.max(h, min);
      if (k.includes('w')) x1 = o.w / 2 - w; else x2 = x1 + w;
      if (k.includes('n')) y1 = o.h / 2 - h; else y2 = y1 + h;
    }
    const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2, oc = center(o);
    const ncx = oc.x + lx * co - ly * si, ncy = oc.y + lx * si + ly * co;
    it.w = round(x2 - x1); it.h = round(y2 - y1); it.x = round(ncx - it.w / 2); it.y = round(ncy - it.h / 2);
    updateTransforms([it.id]);
  }
  renderOverlay(); renderProps();
});
const endDrag = () => {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.mode === 'rubber') {
    if (d.moved) {
      const r = (() => { const a = d.start, b = d.cur; return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }; })();
      const contain = d.cur.x >= d.start.x;   // von links nach rechts: nur komplett umschlossene, sonst alle berührten
      const hit = S.items.filter((it) => { const b = box(it); return contain ? (b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h) : !(b.x > r.x + r.w || b.x + b.w < r.x || b.y > r.y + r.h || b.y + b.h < r.y); }).map((i) => i.id);
      selectIds([...d.base, ...hit]);
    }
  } else if (d.mode === 'move' && !d.moved) undoStack.pop();
  render(); save();
};
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

/* Drag & Drop aus der Bibliothek */
const stage = $('stage');
stage.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('text/x-vectordrop')) { e.preventDefault(); stage.classList.add('dropping'); } });
stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
stage.addEventListener('drop', (e) => {
  stage.classList.remove('dropping');
  const id = e.dataTransfer.getData('text/x-vectordrop'); if (!id) return;
  e.preventDefault();
  const p = pt(e);
  addItem(id, clamp(p.x, 0, S.W), clamp(p.y, 0, S.H));
});
stage.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); S.zoom = clamp(S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.3, 40); render(); }, { passive: false });

/* ---------- Eigenschaften ---------- */
function applyProps(which) {
  const sel = selItems(); if (!sel.length) return;
  snapshot();
  const b = bounds(sel), x = parseFloat($('pX').value), y = parseFloat($('pY').value);
  if (which === 'pX' || which === 'pY') {
    const dx = which === 'pX' && isFinite(x) ? x - b.x : 0, dy = which === 'pY' && isFinite(y) ? y - b.y : 0;
    sel.forEach((i) => { i.x = round(i.x + dx); i.y = round(i.y + dy); });
  } else if (sel.length === 1) {
    const it = sel[0], r = it.w / it.h, c = center(it);
    if (which === 'pR') { const v = parseFloat($('pR').value); if (isFinite(v)) it.rot = normRot(v); }
    if (which === 'pW' || which === 'pH') {
      const w = parseFloat($('pW').value), h = parseFloat($('pH').value);
      if (which === 'pW' && w > 0) { it.w = w; if ($('pLock').checked) it.h = round(w / r); }
      if (which === 'pH' && h > 0) { it.h = h; if ($('pLock').checked) it.w = round(h * r); }
      if (it.rot) { it.x = round(c.x - it.w / 2); it.y = round(c.y - it.h / 2); }
    }
  }
  render(); save();
}
['pX', 'pY', 'pW', 'pH', 'pR'].forEach((id) => $(id).addEventListener('change', () => applyProps(id)));

document.querySelectorAll('#modeSeg button').forEach((bt) => bt.addEventListener('click', () => {
  if (!S.sel.length) return; snapshot(); selItems().forEach((i) => i.mode = bt.dataset.mode); render(); save();
}));
function applyOffset() {
  const sel = selItems().filter((i) => i.mode === 'outline'); if (!sel.length) return; snapshot();
  const off = parseFloat($('pOff').value), n = parseInt($('pOffN').value, 10);
  sel.forEach((i) => { if (isFinite(off)) i.off = Math.max(-200, Math.min(200, off)); if (n >= 1) i.offN = Math.min(20, n); i.offKeep = $('pOffKeep').checked; });
  render(); save();
}
['pOff', 'pOffN', 'pOffKeep'].forEach((id) => $(id).addEventListener('change', applyOffset));
function setColor(c) { if (!S.sel.length) return; snapshot(); selItems().forEach((i) => i.color = c); render(); save(); }
const PALETTE = ['#e03131', '#f08c00', '#f5d90a', '#2f9e44', '#1c7ed6', '#7048e8', '#d6336c', '#868e96'];
$('swatches').innerHTML = PALETTE.map((c) => `<button data-c="${c}" style="background:${c}" title="${c}"></button>`).join('') + '<button data-c="" class="none" title="Originalfarbe">✕</button>';
$('swatches').querySelectorAll('button').forEach((bt) => bt.addEventListener('click', () => setColor(bt.dataset.c || null)));
$('colIn').addEventListener('change', (e) => setColor(e.target.value));
function rotate90(dir) {
  const sel = selItems(); if (!sel.length) return; snapshot();
  const C = sel.length > 1 ? (() => { const b = bounds(sel); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; })() : center(sel[0]);
  sel.forEach((i) => {
    const c = center(i), vx = c.x - C.x, vy = c.y - C.y;
    const nx = C.x - dir * vy, ny = C.y + dir * vx;
    i.x = round(nx - i.w / 2); i.y = round(ny - i.h / 2); i.rot = normRot((i.rot || 0) + 90 * dir);
  });
  render(); save();
}
function flip(axis) {
  const sel = selItems(); if (!sel.length) return; snapshot();
  const b = bounds(sel), C = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  sel.forEach((i) => {
    const c = center(i);
    if (axis === 'h') { i.x = round(2 * C.x - c.x - i.w / 2); i.fx = !i.fx; } else { i.y = round(2 * C.y - c.y - i.h / 2); i.fy = !i.fy; }
    i.rot = normRot(-(i.rot || 0));
  });
  render(); save();
}
$('rotL').onclick = () => rotate90(-1); $('rotR').onclick = () => rotate90(1);
$('flipH').onclick = () => flip('h'); $('flipV').onclick = () => flip('v');

$('dupBtn').onclick = duplicate;
function duplicate() {
  const sel = selItems(); if (!sel.length) return; snapshot();
  const gmap = {};
  const copies = sel.map((i) => { let g = null; if (i.gid) g = gmap[i.gid] || (gmap[i.gid] = newId('g')); return { ...i, id: newId('i'), x: round(i.x + 5), y: round(i.y + 5), gid: g }; });
  S.items.push(...copies); S.sel = copies.map((c) => c.id); render(); save();
}
$('delBtn').onclick = removeSel;
function removeSel() { if (!S.sel.length) return; snapshot(); S.items = S.items.filter((i) => !S.sel.includes(i.id)); S.sel = []; render(); save(); }
$('frontBtn').onclick = () => { snapshot(); const s = selItems(); S.items = [...S.items.filter((i) => !s.includes(i)), ...s]; render(); save(); };
$('backBtn').onclick = () => { snapshot(); const s = selItems(); S.items = [...s, ...S.items.filter((i) => !s.includes(i))]; render(); save(); };
function group() { const s = selItems(); if (s.length < 2) return; snapshot(); const g = newId('g'); s.forEach((i) => i.gid = g); render(); save(); toast('Gruppiert – die Teile bewegen sich jetzt gemeinsam.'); }
function ungroup() { const s = selItems(); if (!s.some((i) => i.gid)) return; snapshot(); s.forEach((i) => i.gid = null); render(); save(); }
$('grpBtn').onclick = group; $('ungrpBtn').onclick = ungroup;

/* ---------- Ausrichten ---------- */
document.querySelectorAll('[data-align]').forEach((btn) => btn.addEventListener('click', () => {
  const sel = selItems(); if (!sel.length) return;
  const a = btn.dataset.align; snapshot();
  if (a === 'distH' || a === 'distV') {
    const hz = a === 'distH', pos = hz ? 'x' : 'y', size = hz ? 'w' : 'h';
    const s = sel.map((i) => ({ i, b: box(i) })).sort((p, q) => p.b[pos] - q.b[pos]);
    const start = s[0].b[pos], end = s[s.length - 1].b[pos] + s[s.length - 1].b[size];
    const total = s.reduce((t, o) => t + o.b[size], 0), gap = (end - start - total) / (s.length - 1);
    let cur = start; s.forEach((o) => { o.i[pos] = round(o.i[pos] + (cur - o.b[pos])); cur += o.b[size] + gap; });
  } else {
    const ref = sel.length > 1 ? bounds(sel) : { x: 0, y: 0, w: S.W, h: S.H };
    sel.forEach((i) => {
      const b = box(i);
      if (a === 'left') i.x = round(i.x + ref.x - b.x);
      if (a === 'right') i.x = round(i.x + ref.x + ref.w - (b.x + b.w));
      if (a === 'hcenter') i.x = round(i.x + ref.x + ref.w / 2 - (b.x + b.w / 2));
      if (a === 'top') i.y = round(i.y + ref.y - b.y);
      if (a === 'bottom') i.y = round(i.y + ref.y + ref.h - (b.y + b.h));
      if (a === 'vmiddle') i.y = round(i.y + ref.y + ref.h / 2 - (b.y + b.h / 2));
    });
  }
  render(); save();
}));

/* ---------- Arbeitsfläche, Zoom, Einstellungen ---------- */
function setWorkspace(w, h) {
  const nw = clamp(Math.round(w) || S.W, 10, S.maxW), nh = clamp(Math.round(h) || S.H, 10, S.maxH);
  if (nw !== Math.round(w) || nh !== Math.round(h)) toast('Maximale Größe: ' + S.maxW + ' × ' + S.maxH + ' mm');
  snapshot(); S.W = nw; S.H = nh; fit(); save();
}
$('wsW').addEventListener('change', () => setWorkspace(parseFloat($('wsW').value), S.H));
$('wsH').addEventListener('change', () => setWorkspace(S.W, parseFloat($('wsH').value)));
function fit() {
  const st = $('stage');
  S.zoom = Math.max(0.5, Math.min((st.clientWidth - 60) / S.W, (st.clientHeight - 60) / S.H));
  render();
}
$('zoomIn').onclick = () => { S.zoom = Math.min(S.zoom * 1.25, 40); render(); };
$('zoomOut').onclick = () => { S.zoom = Math.max(S.zoom / 1.25, 0.3); render(); };
$('zoomFit').onclick = fit;
window.addEventListener('resize', fit);
$('gridChk').onchange = (e) => { S.grid = e.target.checked; render(); save(); };
$('snapChk').onchange = (e) => { S.snap = e.target.checked; save(); };

$('settingsBtn').onclick = () => { $('sMaxW').value = S.maxW; $('sMaxH').value = S.maxH; $('sGrid').value = S.gridSize; $('sColors').checked = S.exportColors; $('settingsDlg').showModal(); };
$('sCancel').onclick = () => $('settingsDlg').close();
$('sSave').onclick = () => {
  const w = parseInt($('sMaxW').value, 10), h = parseInt($('sMaxH').value, 10), g = parseFloat($('sGrid').value);
  if (!(w >= 10 && h >= 10) || !(g > 0)) { toast('Bitte gültige Werte eingeben (Fläche mindestens 10 mm).'); return; }
  S.maxW = w; S.maxH = h; S.gridSize = g; S.exportColors = $('sColors').checked;
  S.W = Math.min(S.W, w); S.H = Math.min(S.H, h);
  $('settingsDlg').close(); fit(); save(); toast('Einstellungen gespeichert.');
};

/* ---------- Export ---------- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function buildSvg() {
  const layer = (name, items) => {
    if (!items.length) return '';
    const parts = items.map((it) => { const l = libOf(it); return l ? `    <g transform="${matStr(itemMatrix(it, l))}">${itemInner(it, l, true)}</g>` : ''; }).join('\n');
    return `  <g id="${name}" inkscape:groupmode="layer" inkscape:label="${name}">\n${parts}\n  </g>\n`;
  };
  const body = layer('Gravur', S.items.filter((i) => i.mode !== 'outline')) + layer('Schnitt', S.items.filter((i) => i.mode === 'outline'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${S.W}mm" height="${S.H}mm" viewBox="0 0 ${S.W} ${S.H}">\n${body}</svg>\n`;
}
$('exportBtn').onclick = async () => {
  if (!S.items.length) { toast('Die Arbeitsfläche ist noch leer.'); return; }
  const iss = computeIssues(), warn = [];
  if (iss.out.length) warn.push(iss.out.length + ' Teil(e) ragen über die Arbeitsfläche hinaus (werden abgeschnitten).');
  if (iss.pairs) warn.push(iss.pairs + ' Überlappung(en) von Schnittlinien (würden doppelt geschnitten).');
  if (warn.length && !confirm('Achtung:\n\n' + warn.join('\n') + '\n\nTrotzdem exportieren?')) return;
  try { await ensureOffsets(); } catch (e) {}
  download('design.svg', buildSvg(), 'image/svg+xml'); toast('design.svg exportiert.');
};
window.__buildSvg = buildSvg;

/* ---------- Projekt speichern / öffnen ---------- */
function saveProject() {
  const used = new Set(S.items.map((i) => i.libId));
  download('design.vdrop', JSON.stringify({ vectordropProject: 1, W: S.W, H: S.H, items: S.items, lib: S.lib.filter((l) => used.has(l.id)) }), 'application/json');
  toast('Projekt gespeichert (design.vdrop).');
}
async function openProject(file) {
  try {
    const d = JSON.parse(await file.text());
    if (!d.vectordropProject || !Array.isArray(d.items) || !Array.isArray(d.lib)) throw 0;
    snapshot();
    const known = new Set(S.lib.map((l) => l.id));
    d.lib.forEach((l) => { if (!known.has(l.id) && l.inner && Array.isArray(l.vb) && l.vb.length === 4) S.lib.push({ id: l.id, name: l.name || 'Teil', vb: l.vb, inner: l.inner, cat: l.cat || 'Eigene' }); });
    S.items = d.items.filter((i) => S.lib.some((l) => l.id === i.libId)).map(normItem);
    S.W = clamp(Math.round(d.W) || S.W, 10, S.maxW); S.H = clamp(Math.round(d.H) || S.H, 10, S.maxH);
    S.sel = []; renderLibrary(); fit(); save();
    toast(d.W > S.maxW || d.H > S.maxH ? 'Projekt geöffnet – Arbeitsfläche auf die erlaubte Maximalgröße verkleinert.' : 'Projekt geöffnet.');
  } catch (e) { toast('Das ist keine gültige VectorDrop-Projektdatei.'); }
}
$('saveBtn').onclick = saveProject;
$('openBtn').onclick = () => $('projInput').click();
$('projInput').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openProject(f); });

/* ---------- Bibliothek als Datei teilen / SVGs laden ---------- */
$('exportLibBtn').onclick = () => download('bibliothek.json', JSON.stringify({ vectordropLibrary: 1, lib: S.lib }, null, 1), 'application/json');
$('importLibBtn').onclick = () => $('libInput').click();
$('libInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d.vectordropLibrary || !Array.isArray(d.lib)) throw 0;
    const known = new Set(S.lib.map((l) => l.id));
    const add = d.lib.filter((l) => !known.has(l.id) && l.inner && Array.isArray(l.vb) && l.vb.length === 4)
      .map((l) => { const t = parseSvgText(`<svg xmlns="${NS}" viewBox="${l.vb.join(' ')}">${l.inner}</svg>`, l.name || 'Teil'); return t && { ...t, id: l.id, name: l.name || 'Teil', cat: l.cat || 'Eigene' }; }).filter(Boolean);
    S.lib.push(...add); renderLibrary(); save(); toast(add.length + ' Teil(e) hinzugefügt.');
  } catch (err) { toast('Das ist keine gültige Bibliotheksdatei.'); }
});
$('importBtn').onclick = () => $('fileInput').click();
$('fileInput').addEventListener('change', (e) => { importFiles([...e.target.files]); e.target.value = ''; });
const lp = $('libraryPanel');
lp.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
lp.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); importFiles([...e.dataTransfer.files]); } });

/* ---------- Tastatur ---------- */
$('undoBtn').onclick = undo;
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.querySelector('dialog[open]')) return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 'z') { e.preventDefault(); undo(); }
  else if (ctrl && k === 'a') { e.preventDefault(); S.sel = S.items.map((i) => i.id); render(); }
  else if (ctrl && k === 'd') { e.preventDefault(); duplicate(); }
  else if (ctrl && k === 'g') { e.preventDefault(); e.shiftKey ? ungroup() : group(); }
  else if (ctrl && k === 's') { e.preventDefault(); saveProject(); }
  else if (ctrl && k === 'o') { e.preventDefault(); $('projInput').click(); }
  else if (!ctrl && k === 'r' && S.sel.length) rotate90(e.shiftKey ? -1 : 1);
  else if (e.key === 'Delete' || e.key === 'Backspace') removeSel();
  else if (e.key === 'Escape') { S.sel = []; render(); }
  else if (e.key.startsWith('Arrow') && S.sel.length) {
    e.preventDefault(); snapshot();
    const st = e.shiftKey ? 5 : 1;
    selItems().forEach((i) => { if (e.key === 'ArrowLeft') i.x -= st; if (e.key === 'ArrowRight') i.x += st; if (e.key === 'ArrowUp') i.y -= st; if (e.key === 'ArrowDown') i.y += st; });
    render(); save();
  }
});

/* ---------- Programmversion & Updates (nur in der Windows-App) ---------- */
if (window.vd) {
  window.vd.info().then((i) => {
    $('updBox').hidden = false; $('verTxt').textContent = i.version;
    if (!i.updates) { $('updBtn').disabled = true; $('updHint').textContent = i.portable ? 'Die portable Version aktualisiert sich nicht automatisch. Bitte die Setup-Version installieren.' : 'Updates gibt es nur in der installierten Version.'; }
  });
  $('updBtn').onclick = () => { window.vd.checkUpdates(); toast('Suche nach Updates …'); };
}

/* ---------- Schnittstelle für text.js und wizard.js ---------- */
window.VD = { activeCat: () => S.filterCat || 'Eigene', $, S, toast, clamp, round, newId, renderLibrary, save, addItem, addLibEntry, addItemRaw, categories, snapshot, selectIds, render: () => render(), fit };

/* ---------- Start ---------- */
load();
renderLibrary();
fit();
})();
