/* Bild-zu-Vektor-Assistent. Nutzt die gemeinsame Schnittstelle VD aus app.js. */
(() => {
'use strict';
const { $, S, toast, clamp, round, newId, addLibEntry, categories, addItemRaw, addItem, snapshot, selectIds, render, save } = window.VD;

/* Stil und Dialog des Assistenten werden hier eingefügt (Datei gehört dem Assistenten) */
const WIZ_CSS = `  /* Assistent */
  #wizDlg { width: min(980px, 95vw); padding: 0; }
  .wz-head { display: flex; gap: 10px; padding: 14px 20px; border-bottom: 1px solid var(--line); align-items: center; }
  .wz-head h3 { margin: 0 16px 0 0; }
  .wz-step { color: var(--muted); padding: 4px 12px; border-radius: 999px; background: var(--bg); }
  .wz-step.on { background: var(--accent); color: #fff; font-weight: 600; }
  .wz-step.done { background: var(--accent-soft); color: var(--accent); }
  .wz-body { padding: 18px 20px; min-height: 420px; }
  .wz-foot { display: flex; justify-content: space-between; padding: 12px 20px; border-top: 1px solid var(--line); background: var(--bg); border-radius: 0 0 14px 14px; }
  .dropzone { border: 3px dashed var(--line); border-radius: 14px; height: 380px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; color: var(--muted); }
  .dropzone.over { border-color: var(--accent); background: var(--accent-soft); }
  .dropzone .big { font-size: 20px; color: var(--text); }
  .kbd { background: #fff; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px; padding: 1px 7px; font-weight: 600; color: var(--text); }
  .wz-cols { display: grid; grid-template-columns: 1fr 1fr 240px; gap: 14px; }
  .wz-cols > div:last-child { max-height: 400px; overflow-y: auto; padding-right: 6px; }
  .pane { border: 1px solid var(--line); border-radius: 10px; background: #fff; overflow: hidden; display: flex; flex-direction: column; }
  .pane h4 { margin: 0; padding: 6px 10px; font-size: 12px; color: var(--muted); background: var(--bg); text-transform: uppercase; letter-spacing: .6px; }
  .pane .view { height: 340px; display: flex; align-items: center; justify-content: center; padding: 6px; }
  .pane canvas, .pane svg { max-width: 100%; max-height: 100%; }
  #wzCrop { cursor: crosshair; touch-action: none; }
  .ctl { margin-bottom: 14px; }
  .ctl label { display: flex; justify-content: space-between; font-weight: 600; }
  .ctl small { color: var(--muted); display: block; }
  .ctl input[type=range] { width: 100%; }
  #wzInfo { color: var(--muted); font-size: 12px; margin-top: 6px; }
  .wz-final { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; }
  .wz-final .pane .view { height: 300px; }
  .wz-final input[type=text] { box-sizing: border-box; width: 100%; padding: 8px; border: 1px solid var(--line); border-radius: 6px; margin: 6px 0 14px; }
  #wizDlg { max-height: 90vh; overflow-y: auto; }
  .wz-mode { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
  .wz-mode b { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
  .wz-mode label, .wz-radios label { display: flex; gap: 6px; align-items: center; cursor: pointer; }
  .wz-radios { display: flex; gap: 16px; margin: 0 0 10px; flex-wrap: wrap; }
  .ctl.off { opacity: .4; pointer-events: none; }
  #wzParts { max-height: 200px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; margin: 0 0 12px; background: #fff; }
  .wz-part { display: flex; align-items: center; gap: 10px; padding: 4px 10px; border-bottom: 1px solid var(--line); cursor: pointer; }
  .wz-part:last-child { border-bottom: 0; }
  .wz-part svg { width: 44px; height: 44px; flex: none; background: #fff; border: 1px solid var(--line); border-radius: 4px; }
  .wz-part .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wz-part small { color: var(--muted); }
  .wz-final input[type=checkbox], .wz-final input[type=radio] { width: auto; margin: 0; }
`;
const WIZ_HTML = `<dialog id="wizDlg">
  <div class="wz-head">
    <h3>Bild in Vektor umwandeln</h3>
    <span class="wz-step" id="wzs1">1 · Bild</span><span class="wz-step" id="wzs2">2 · Anpassen</span><span class="wz-step" id="wzs3">3 · Fertig</span>
    <span class="spacer"></span><button id="wzClose">Schließen</button>
  </div>
  <div class="wz-body">
    <div id="wz1">
      <div class="dropzone" id="wzDrop">
        <div class="big">Screenshot einfügen mit <span class="kbd">Strg</span> + <span class="kbd">V</span></div>
        <div>oder ein Bild hierher ziehen</div>
        <div><button class="primary" id="wzFile">Bilddatei wählen …</button> <button id="wzPaste">Aus Zwischenablage einfügen</button></div>
        <div style="max-width:520px">Am besten: dunkles oder farbiges Design auf einfarbigem, hellem Hintergrund. Das Design wird automatisch erkannt.</div>
        <input type="file" id="wzFileInput" accept="image/*" hidden>
      </div>
    </div>
    <div id="wz2" hidden>
      <div class="wz-cols">
        <div class="pane"><h4>Dein Bild – Ausschnitt mit der Maus aufziehen</h4><div class="view"><canvas id="wzCrop"></canvas></div></div>
        <div class="pane"><h4>Erkanntes Design</h4><div class="view"><svg id="wzPrev" xmlns="http://www.w3.org/2000/svg"></svg></div></div>
        <div>
          <div class="wz-mode"><b>Modus</b>
            <label><input type="radio" name="oMode" value="area" checked> Fläche (Silhouette)</label>
            <label><input type="radio" name="oMode" value="line"> Linie (Strichzeichnung)</label>
          </div>
          <div class="ctl"><label>Empfindlichkeit <span id="vSens"></span></label><input type="range" id="oSens" min="5" max="95" value="70"><small>Mehr, wenn Teile fehlen. Weniger, wenn Schatten oder Rauschen mitkommen.</small></div>
          <div class="ctl"><label>Glätten <span id="vBlur"></span></label><input type="range" id="oBlur" min="0" max="3" step="1" value="1"><small>Macht Kanten weicher.</small></div>
          <div class="ctl"><label>Vereinfachen <span id="vTol"></span></label><input type="range" id="oTol" min="0" max="5" step="0.1" value="1.2"><small>Weniger Punkte, gerader.</small></div>
          <div class="ctl"><label>Flecken entfernen <span id="vNoise"></span></label><input type="range" id="oNoise" min="0" max="100" value="5"><small>Entfernt winzige Punkte.</small></div>
          <details class="ctl" id="wzAdv" open><summary style="cursor:pointer;font-weight:600;margin-bottom:8px">Bild verbessern</summary>
            <div class="ctl"><label>Helligkeit <span id="vBright"></span></label><input type="range" id="oBright" min="-100" max="100" value="0"><small>Heller: schwache Linien und Schatten verschwinden.</small></div>
            <div class="ctl"><label>Kontrast <span id="vContrast"></span></label><input type="range" id="oContrast" min="-100" max="100" value="0"><small>Stärker: Design hebt sich klarer ab.</small></div>
            <div class="ctl"><label>Schärfen <span id="vSharp"></span></label><input type="range" id="oSharp" min="0" max="5" value="0"><small>Für unscharfe Screenshots.</small></div>
            <label class="check" style="margin:0 0 6px"><input type="checkbox" id="oInvert"> Umkehren (Design ist der Hintergrund)</label>
          </details>
          <div class="row2"><button id="wzResetCrop">Ausschnitt zurücksetzen</button><button id="wzResetOpts">Regler zurücksetzen</button></div>
          <div id="wzInfo"></div>
        </div>
      </div>
    </div>
    <div id="wz3" hidden>
      <div class="wz-final">
        <div class="pane"><h4>Ergebnis</h4><div class="view"><svg id="wzFinal" xmlns="http://www.w3.org/2000/svg"></svg></div></div>
        <div>
          <label for="wzName"><b>Name in der Bibliothek</b></label>
          <input type="text" id="wzName" maxlength="40">
          <div id="wzSplitBox" hidden>
            <div class="wz-radios">
              <label><input type="radio" name="wzSplit" value="one" checked> Als ein Teil</label>
              <label><input type="radio" name="wzSplit" value="each"> Jedes Teil einzeln</label>
            </div>
            <div id="wzParts" hidden></div>
            <div class="hint" id="wzPartsHint" hidden></div>
          </div>
          <label for="wzCat"><b>Ordner/Kategorie</b></label>
          <input type="text" id="wzCat" maxlength="40" list="wzCats" value="Eigene" autocomplete="off">
          <datalist id="wzCats"></datalist>
          <div class="stack">
            <button class="primary" id="wzAddPlace">Zur Bibliothek und auf die Arbeitsfläche legen</button>
            <button id="wzAdd">Nur zur Bibliothek hinzufügen</button>
          </div>
          <p class="hint" id="wzHint"></p>
        </div>
      </div>
    </div>
  </div>
  <div class="wz-foot"><button id="wzBack">← Zurück</button><button class="primary" id="wzNext">Weiter →</button></div>
</dialog>`;
document.head.insertAdjacentHTML('beforeend', '<style>' + WIZ_CSS + '</style>');
document.body.insertAdjacentHTML('beforeend', WIZ_HTML);

/* ---------- Bild-zu-Vektor-Assistent ---------- */
const TR = { work: null, crop: null, bg: [255,255,255], res: null, step: 1, timer: 0 };
const wdlg = $('wizDlg');

function wizStep(n) {
  TR.step = n;
  [1,2,3].forEach((i) => { $('wz'+i).hidden = i !== n; $('wzs'+i).classList.toggle('on', i === n); $('wzs'+i).classList.toggle('done', i < n); });
  $('wzBack').style.visibility = n === 1 ? 'hidden' : 'visible';
  $('wzNext').style.display = n === 3 ? 'none' : '';
  $('wzNext').disabled = n === 1 || (n === 2 && !TR.res);
  if (n === 2) { drawCrop(); runTrace(); }
  if (n === 3) renderFinal();
}
function openWizard() { TR.work = null; TR.res = null; if (!wdlg.open) wdlg.showModal(); wizStep(1); }

function estimateBg(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data, r = [], g = [], b = [];
  const add = (x, y) => { const i = (y * w + x) * 4; r.push(d[i]); g.push(d[i+1]); b.push(d[i+2]); };
  for (let i = 0; i < w; i += 3) { add(i, 0); add(i, h - 1); }
  for (let j = 0; j < h; j += 3) { add(0, j); add(w - 1, j); }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(r), med(g), med(b)];
}
async function loadBlob(blob) {
  let bmp;
  try { bmp = await createImageBitmap(blob); } catch (e) { toast('Das Bild konnte nicht gelesen werden.'); return; }
  const sc = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  TR.work = c; TR.crop = { x: 0, y: 0, w: c.width, h: c.height }; TR.bg = estimateBg(x, c.width, c.height);
  if (!wdlg.open) wdlg.showModal();
  wizStep(2);
}

/* Ausschnitt */
const cropCv = $('wzCrop');
function drawCrop() {
  if (!TR.work) return;
  cropCv.width = TR.work.width; cropCv.height = TR.work.height;
  const x = cropCv.getContext('2d'), c = TR.crop;
  x.drawImage(TR.work, 0, 0);
  x.fillStyle = 'rgba(20,30,50,.45)';
  x.fillRect(0, 0, cropCv.width, c.y); x.fillRect(0, c.y + c.h, cropCv.width, cropCv.height - c.y - c.h);
  x.fillRect(0, c.y, c.x, c.h); x.fillRect(c.x + c.w, c.y, cropCv.width - c.x - c.w, c.h);
  x.strokeStyle = '#2563eb'; x.lineWidth = Math.max(2, cropCv.width / 400); x.strokeRect(c.x, c.y, c.w, c.h);
}
let cropDrag = null;
const cpt = (e) => { const r = cropCv.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) * cropCv.width / r.width, 0, cropCv.width), y: clamp((e.clientY - r.top) * cropCv.height / r.height, 0, cropCv.height) }; };
cropCv.addEventListener('pointerdown', (e) => { cropDrag = cpt(e); cropCv.setPointerCapture(e.pointerId); });
cropCv.addEventListener('pointermove', (e) => {
  if (!cropDrag) return;
  const p = cpt(e), x1 = Math.min(cropDrag.x, p.x), y1 = Math.min(cropDrag.y, p.y);
  TR.crop = { x: Math.round(x1), y: Math.round(y1), w: Math.max(8, Math.round(Math.abs(p.x - cropDrag.x))), h: Math.max(8, Math.round(Math.abs(p.y - cropDrag.y))) };
  drawCrop();
});
cropCv.addEventListener('pointerup', () => { if (!cropDrag) return; cropDrag = null; const c = TR.crop; if (c.x + c.w > TR.work.width) c.w = TR.work.width - c.x; if (c.y + c.h > TR.work.height) c.h = TR.work.height - c.y; scheduleTrace(); });
$('wzResetCrop').onclick = () => { TR.crop = { x: 0, y: 0, w: TR.work.width, h: TR.work.height }; drawCrop(); scheduleTrace(); };

/* Kantenerkennung / Vektorisierung */
function boxBlur(f, w, h) {
  const t = new Float32Array(f.length), o = new Float32Array(f.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; t[i] = (f[x > 0 ? i - 1 : i] + f[i] + f[x < w - 1 ? i + 1 : i]) / 3; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; o[i] = (t[y > 0 ? i - w : i] + t[i] + t[y < h - 1 ? i + w : i]) / 3; }
  return o;
}
function perp(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  if (!l) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / Math.sqrt(l);
}
function dpLine(p, tol) {
  const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1;
  const st = [[0, p.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = perp(p[i], p[a], p[b]); if (d > md) { md = d; mi = i; } }
    if (md > tol && mi >= 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return p.filter((_, i) => keep[i]);
}
function simplifyLoop(pts, tol) {
  if (tol <= 0 || pts.length < 6) return pts;
  let fi = 0, fd = -1;
  pts.forEach((q, i) => { const d = (q[0] - pts[0][0]) ** 2 + (q[1] - pts[0][1]) ** 2; if (d > fd) { fd = d; fi = i; } });
  const a = dpLine(pts.slice(0, fi + 1), tol), b = dpLine(pts.slice(fi).concat([pts[0]]), tol);
  return a.slice(0, -1).concat(b.slice(0, -1));
}
/* Zusammenhängende Bereiche (4er-Nachbarschaft) der Maske; Rand muss 0 sein */
function labelMask(m, PW, PH) {
  const label = new Int32Array(PW * PH), st = new Int32Array(PW * PH), areas = [0];
  let n = 0;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || label[s]) continue;
    n++; let sp = 0, cnt = 0; st[sp++] = s; label[s] = n;
    while (sp) {
      const i = st[--sp]; cnt++;
      let j = i - 1; if (m[j] && !label[j]) { label[j] = n; st[sp++] = j; }
      j = i + 1; if (m[j] && !label[j]) { label[j] = n; st[sp++] = j; }
      j = i - PW; if (m[j] && !label[j]) { label[j] = n; st[sp++] = j; }
      j = i + PW; if (m[j] && !label[j]) { label[j] = n; st[sp++] = j; }
    }
    areas.push(cnt);
  }
  return { label, areas };
}
/* Zhang-Suen-Ausdünnung (in place), arbeitet nur mit einer Kandidatenliste der Randpixel */
function thin(m, PW, PH) {
  const N = PW * PH, o8 = [-PW, -PW + 1, 1, PW + 1, PW, PW - 1, -1, -PW - 1], stamp = new Int32Array(N);
  let cand = [], gen = 0;
  for (let y = 1; y < PH - 1; y++) for (let x = 1; x < PW - 1; x++) {
    const i = y * PW + x; if (!m[i]) continue;
    for (let k = 0; k < 8; k++) if (!m[i + o8[k]]) { cand.push(i); break; }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const del = [];
      for (let c = 0; c < cand.length; c++) {
        const i = cand[c]; if (!m[i]) continue;
        const p2 = m[i-PW], p3 = m[i-PW+1], p4 = m[i+1], p5 = m[i+PW+1], p6 = m[i+PW], p7 = m[i+PW-1], p8 = m[i-1], p9 = m[i-PW-1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
        if (A !== 1) continue;
        if (step === 0) { if ((p2 && p4 && p6) || (p4 && p6 && p8)) continue; }
        else if ((p2 && p4 && p8) || (p2 && p6 && p8)) continue;
        del.push(i);
      }
      if (!del.length) continue;
      changed = true;
      for (let c = 0; c < del.length; c++) m[del[c]] = 0;
      gen++; const next = [];
      for (let c = 0; c < cand.length; c++) { const i = cand[c]; if (m[i] && stamp[i] !== gen) { stamp[i] = gen; next.push(i); } }
      for (let c = 0; c < del.length; c++) for (let k = 0; k < 8; k++) { const j = del[c] + o8[k]; if (m[j] && stamp[j] !== gen) { stamp[j] = gen; next.push(j); } }
      cand = next;
    }
  }
  /* Treppenpixel entfernen (Verbindung bleibt erhalten), damit nur echte Kreuzungen Grad 3 behalten */
  for (let pass = 0; pass < 4; pass++) {
    let any = false;
    for (let y = 1; y < PH - 1; y++) for (let x = 1; x < PW - 1; x++) {
      const i = y * PW + x; if (!m[i]) continue;
      const q = [m[i-PW], m[i-PW+1], m[i+1], m[i+PW+1], m[i+PW], m[i+PW-1], m[i-1], m[i-PW-1]];
      const B = q[0] + q[1] + q[2] + q[3] + q[4] + q[5] + q[6] + q[7]; if (B < 2 || B > 3) continue;
      /* Nachbarn zusammenhängend (8er, inkl. Diagonale zwischen zwei 4er-Nachbarn)? Dann ist der Pixel überflüssig */
      const par = [0, 1, 2, 3, 4, 5, 6, 7], fd = (a) => (par[a] === a ? a : (par[a] = fd(par[a])));
      const jn = (a, b) => { if (q[a] && q[b]) par[fd(a)] = fd(b); };
      for (let k = 0; k < 8; k++) jn(k, (k + 1) & 7);
      jn(0, 2); jn(2, 4); jn(4, 6); jn(6, 0);
      let roots = 0; for (let k = 0; k < 8; k++) if (q[k] && fd(k) === k) roots++;
      if (roots === 1) { m[i] = 0; any = true; }
    }
    if (!any) break;
  }
}
/* Skelett in Polylinien zerlegen (Knoten = Enden/Kreuzungen, Ringe separat) */
function skeletonLines(sk, PW, PH) {
  const N = PW * PH, o8 = [-PW, -PW + 1, 1, PW + 1, PW, PW - 1, -1, -PW - 1], deg = new Uint8Array(N), used = new Uint8Array(N), lines = [];
  for (let y = 1; y < PH - 1; y++) for (let x = 1; x < PW - 1; x++) {
    const i = y * PW + x; if (!sk[i]) continue;
    let c = 0; for (let k = 0; k < 8; k++) c += sk[i + o8[k]]; deg[i] = c;
  }
  const plen = (idx) => { let l = 0; for (let k = 1; k < idx.length; k++) { const a = idx[k-1], b = idx[k]; l += (Math.abs(a - b) === 1 || Math.abs(a - b) === PW) ? 1 : 1.4142; } return l; };
  for (let p = 0; p < N; p++) {
    if (!sk[p] || deg[p] === 2 || deg[p] === 0) continue;
    for (let k = 0; k < 8; k++) {
      const q = p + o8[k]; if (!sk[q]) continue;
      if (deg[q] !== 2) { if (q > p) lines.push({ idx: [p, q], ring: false, e0: deg[p], e1: deg[q] }); continue; }
      if (used[q]) continue;
      const path = [p, q]; used[q] = 1; let prev = p, cur = q;
      for (let guard = 0; guard < N; guard++) {
        let nx = -1; for (let t = 0; t < 8; t++) { const j = cur + o8[t]; if (sk[j] && j !== prev) { nx = j; break; } }
        if (nx < 0) break;
        path.push(nx);
        if (deg[nx] !== 2) break;
        used[nx] = 1; prev = cur; cur = nx;
      }
      lines.push({ idx: path, ring: false, e0: deg[p], e1: deg[path[path.length - 1]] });
    }
  }
  for (let s = 0; s < N; s++) {
    if (!sk[s] || deg[s] !== 2 || used[s]) continue;
    const path = [s]; used[s] = 1; let prev = -1, cur = s;
    for (let guard = 0; guard < N; guard++) {
      let nx = -1; for (let t = 0; t < 8; t++) { const j = cur + o8[t]; if (sk[j] && j !== prev) { nx = j; break; } }
      if (nx < 0 || nx === s) break;
      if (used[nx]) break;
      path.push(nx); used[nx] = 1; prev = cur; cur = nx;
    }
    if (path.length >= 3) lines.push({ idx: path, ring: true, e0: 2, e1: 2 });
  }
  lines.forEach((l) => { l.len = plen(l.idx) + (l.ring ? 1 : 0); });
  return lines;
}
const r1 = (v) => round(v * 10) / 10;
function traceImage(opts) {
  const c = TR.crop, w = c.w, h = c.h, [br, bg, bb] = TR.bg;
  const d = TR.work.getContext('2d').getImageData(c.x, c.y, w, h).data;
  let f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = Math.max(Math.abs(d[i*4] - br), Math.abs(d[i*4+1] - bg), Math.abs(d[i*4+2] - bb));
  if (opts.sharp > 0) { const bl = boxBlur(boxBlur(f, w, h), w, h); for (let i = 0; i < f.length; i++) f[i] = Math.min(255, Math.max(0, f[i] + opts.sharp * 0.8 * (f[i] - bl[i]))); }
  if (opts.bright || opts.contrast) {
    const k = opts.contrast >= 0 ? 1 + opts.contrast / 50 : 1 + opts.contrast / 100, off = -opts.bright * 2.55;
    for (let i = 0; i < f.length; i++) f[i] = Math.min(255, Math.max(0, (f[i] - 128) * k + 128 + off));
  }
  if (opts.invert) for (let i = 0; i < f.length; i++) f[i] = 255 - f[i];
  for (let p = 0; p < opts.blur; p++) f = boxBlur(f, w, h);
  const PW = w + 2, PH = h + 2, g = new Float32Array(PW * PH);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[(y + 1) * PW + x + 1] = f[y * w + x];
  const thr = opts.thr, mask = new Uint8Array(PW * PH);
  for (let i = 0; i < mask.length; i++) mask[i] = g[i] >= thr ? 1 : 0;
  const { label, areas } = labelMask(mask, PW, PH);
  const minArea = opts.noise * 8;
  return opts.mode === 'line' ? traceLines(opts, mask, label, areas, PW, PH, minArea) : traceAreas(opts, g, label, areas, PW, PH, minArea);
}
function traceAreas(opts, g, label, areas, PW, PH, minArea) {
  const thr = opts.thr, M = PW * PH * 2;
  const px = new Float32Array(M), py = new Float32Array(M), ins = new Int32Array(M).fill(-1), adjA = new Int32Array(M).fill(-1), adjB = new Int32Array(M).fill(-1);
  const link = (a, b) => { if (adjA[a] < 0) adjA[a] = b; else adjB[a] = b; if (adjA[b] < 0) adjA[b] = a; else adjB[b] = a; };
  const tt = (p, q) => (q === p ? 0.5 : clamp((thr - p) / (q - p), 0, 1));
  /* Kantenpunkt zwischen zwei Rasterpunkten; ins = Index des innen liegenden Rasterpunkts */
  const H = (x, y) => { const id = (y * PW + x) * 2; if (ins[id] < 0) { const a = y * PW + x; px[id] = x + tt(g[a], g[a+1]); py[id] = y; ins[id] = g[a] >= thr ? a : (g[a+1] >= thr ? a + 1 : -1); } return id; };
  const V = (x, y) => { const id = (y * PW + x) * 2 + 1; if (ins[id] < 0) { const a = y * PW + x; px[id] = x; py[id] = y + tt(g[a], g[a+PW]); ins[id] = g[a] >= thr ? a : (g[a+PW] >= thr ? a + PW : -1); } return id; };
  for (let y = 0; y < PH - 1; y++) for (let x = 0; x < PW - 1; x++) {
    const i = y * PW + x;
    const idx = (g[i] >= thr ? 1 : 0) | (g[i+1] >= thr ? 2 : 0) | (g[i+PW+1] >= thr ? 4 : 0) | (g[i+PW] >= thr ? 8 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = H(x, y), B = H(x, y + 1), L = V(x, y), R = V(x + 1, y);
    switch (idx) {
      case 1: case 14: link(L, T); break;
      case 2: case 13: link(T, R); break;
      case 3: case 12: link(L, R); break;
      case 4: case 11: link(R, B); break;
      case 6: case 9: link(T, B); break;
      case 7: case 8: link(L, B); break;
      case 5: link(L, T); link(R, B); break;
      case 10: link(T, R); link(L, B); break;
    }
  }
  const seen = new Uint8Array(M), byComp = new Map();
  for (let start = 0; start < M; start++) {
    if (adjA[start] < 0 || seen[start]) continue;
    const loop = []; let prev = -1, cur = start;
    for (;;) {
      seen[cur] = 1; loop.push([px[cur], py[cur]]);
      const nxt = adjA[cur] === prev ? adjB[cur] : adjA[cur];
      if (nxt < 0 || nxt === start || seen[nxt]) break;
      prev = cur; cur = nxt;
    }
    let a = 0; for (let i = 0; i < loop.length; i++) { const p = loop[i], q = loop[(i + 1) % loop.length]; a += p[0] * q[1] - q[0] * p[1]; }
    if (Math.abs(a) / 2 < minArea || loop.length < 3) continue;
    const sl = simplifyLoop(loop, opts.tol); if (sl.length < 3) continue;
    const comp = label[ins[start]];
    (byComp.get(comp) || byComp.set(comp, []).get(comp)).push(sl);
  }
  const build = (loops) => {
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9, dstr = '';
    loops.forEach((l) => {
      dstr += 'M' + l.map((p) => { const X = p[0] - 1, Y = p[1] - 1; x1 = Math.min(x1, X); y1 = Math.min(y1, Y); x2 = Math.max(x2, X); y2 = Math.max(y2, Y); return round(X * 10) / 10 + ' ' + round(Y * 10) / 10; }).join('L') + 'Z';
    });
    return { d: dstr, vb: [round(x1 - 1), round(y1 - 1), round(x2 - x1 + 2), round(y2 - y1 + 2)], n: loops.length, inner: `<path d="${dstr}" fill="#000" fill-rule="evenodd"/>` };
  };
  const parts = [], all = [];
  byComp.forEach((loops, comp) => { const p = build(loops); p.area = areas[comp]; parts.push(p); all.push(...loops); });
  if (!all.length) return null;
  parts.sort((a, b) => b.area - a.area);
  const res = build(all); res.parts = parts; res.mode = 'area';
  return res;
}
function traceLines(opts, mask, label, areas, PW, PH, minArea) {
  const sk = mask.slice(); thin(sk, PW, PH);
  const minLen = opts.noise * 0.6, byComp = new Map();
  skeletonLines(sk, PW, PH).forEach((l) => {
    const comp = label[l.idx[0]];
    if (areas[comp] < minArea) return;
    if (!l.ring && (l.e0 === 1 || l.e1 === 1) && l.len < minLen) return;
    (byComp.get(comp) || byComp.set(comp, []).get(comp)).push(l);
  });
  const build = (lines, W) => {
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9, dstr = '';
    lines.forEach((l) => {
      let pts = l.idx.map((i) => [(i % PW) - 1, Math.floor(i / PW) - 1]);
      pts = l.ring ? simplifyLoop(pts, opts.tol) : (opts.tol > 0 ? dpLine(pts, opts.tol) : pts);
      dstr += 'M' + pts.map((p) => { x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]); x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]); return p[0] + ' ' + p[1]; }).join('L') + (l.ring ? 'Z' : '');
    });
    const pad = W / 2 + 1, fx = Math.floor((x1 - pad) * 10) / 10, fy = Math.floor((y1 - pad) * 10) / 10;
    return { d: dstr, vb: [fx, fy, r1(Math.ceil((x2 + pad) * 10) / 10 - fx), r1(Math.ceil((y2 + pad) * 10) / 10 - fy)], n: lines.length, w: W,
      inner: `<path d="${dstr}" fill="none" stroke="#000" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"/>` };
  };
  const widthOf = (area, len) => Math.max(1, r1(area / Math.max(1, len)));
  const parts = [], all = []; let tArea = 0, tLen = 0;
  byComp.forEach((lines, comp) => {
    const len = lines.reduce((s, l) => s + l.len, 0);
    const p = build(lines, widthOf(areas[comp], len)); p.area = areas[comp]; parts.push(p);
    all.push(...lines); tArea += areas[comp]; tLen += len;
  });
  if (!all.length) return null;
  parts.sort((a, b) => b.area - a.area);
  const res = build(all, widthOf(tArea, tLen)); res.parts = parts; res.mode = 'line';
  return res;
}
const wzOpts = () => ({ mode: document.querySelector('input[name=oMode]:checked').value, thr: 255 * (1 - $('oSens').value / 100), blur: +$('oBlur').value, tol: +$('oTol').value, noise: +$('oNoise').value, bright: +$('oBright').value, contrast: +$('oContrast').value, sharp: +$('oSharp').value, invert: $('oInvert').checked });
function runTrace() {
  $('vSens').textContent = $('oSens').value; $('vBlur').textContent = $('oBlur').value; $('vTol').textContent = $('oTol').value; $('vNoise').textContent = $('oNoise').value; $('vBright').textContent = $('oBright').value; $('vContrast').textContent = $('oContrast').value; $('vSharp').textContent = $('oSharp').value;
  if (!TR.work) return;
  const t0 = performance.now();
  TR.res = traceImage(wzOpts());
  TR.ms = performance.now() - t0;
  const sv = $('wzPrev');
  sv.setAttribute('viewBox', `0 0 ${TR.crop.w} ${TR.crop.h}`);
  sv.style.background = '#fff'; sv.style.border = '1px solid #eee';
  sv.style.aspectRatio = TR.crop.w + '/' + TR.crop.h; sv.style.height = '100%';
  sv.innerHTML = TR.res ? TR.res.inner : '';
  const r = TR.res, np = r ? r.parts.length : 0;
  $('wzInfo').textContent = !r ? 'Kein Design erkannt – Empfindlichkeit erhöhen oder anderen Ausschnitt wählen.'
    : (r.mode === 'line' ? r.n + ' Linie(n), Strichstärke ca. ' + r.w + ' px' : r.n + ' Fläche(n)/Löcher erkannt') + ' · ' + np + (np === 1 ? ' Teil.' : ' Teile.');
  $('wzNext').disabled = !r;
}
function scheduleTrace() { clearTimeout(TR.timer); TR.timer = setTimeout(runTrace, 90); }
['oSens','oBlur','oTol','oNoise','oBright','oContrast','oSharp','oInvert'].forEach((id) => $(id).addEventListener('input', scheduleTrace));
document.querySelectorAll('input[name=oMode]').forEach((el) => el.addEventListener('change', scheduleTrace));
$('wzResetOpts').onclick = () => { const dv = { oSens: 70, oBlur: 1, oTol: 1.2, oNoise: 5, oBright: 0, oContrast: 0, oSharp: 0 }; Object.keys(dv).forEach((k) => $(k).value = dv[k]); $('oInvert').checked = false; document.querySelector('input[name=oMode][value=area]').checked = true; scheduleTrace(); };

/* Schritt 3 */
const MAX_PARTS = 40;
const splitEach = () => TR.res && TR.res.parts.length > 1 && document.querySelector('input[name=wzSplit]:checked').value === 'each';
function partNames() {
  const base = ($('wzName').value || '').trim() || 'Bild-Design';
  document.querySelectorAll('#wzParts .nm').forEach((el) => { el.textContent = base + ' ' + (+el.dataset.i + 1); });
}
function syncSplit() {
  const multi = TR.res.parts.length > 1;
  $('wzSplitBox').hidden = !multi;
  $('wzParts').hidden = !splitEach();
}
function renderFinal() {
  const sv = $('wzFinal'), v = TR.res.vb, parts = TR.res.parts;
  sv.setAttribute('viewBox', v.join(' ')); sv.style.height = '100%'; sv.style.aspectRatio = v[2] + '/' + v[3];
  sv.innerHTML = TR.res.inner;
  if (!$('wzName').value) $('wzName').value = 'Bild-Design ' + (S.lib.length + 1);
  document.querySelector('input[name=wzSplit][value=one]').checked = true;
  const list = $('wzParts'); list.innerHTML = '';
  parts.slice(0, MAX_PARTS).forEach((p, i) => {
    const row = document.createElement('label'); row.className = 'wz-part';
    row.innerHTML = `<input type="checkbox" checked data-i="${i}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${p.vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${p.inner}</svg><span class="nm" data-i="${i}"></span>`;
    list.appendChild(row);
  });
  const hint = $('wzPartsHint');
  hint.hidden = parts.length <= MAX_PARTS || !splitEach();
  hint.textContent = 'Es werden nur die ' + MAX_PARTS + ' größten von ' + parts.length + ' Teilen angeboten.';
  $('wzHint').textContent = TR.res.mode === 'line'
    ? 'Das Design wird als schwarze Strichzeichnung (Linien mit abgerundeten Enden) übernommen und lässt sich danach wie jedes andere Teil skalieren und ausrichten.'
    : 'Das Design wird einfarbig schwarz übernommen (gefüllte Fläche) und lässt sich danach wie jedes andere Teil skalieren und ausrichten.';
  $('wzCats').innerHTML = (categories() || []).map((c) => '<option value="' + String(c).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"></option>').join('');
  if (!$('wzCat').value.trim()) $('wzCat').value = 'Eigene';
  partNames(); syncSplit();
}
document.querySelectorAll('input[name=wzSplit]').forEach((el) => el.addEventListener('change', () => { syncSplit(); const hint = $('wzPartsHint'); hint.hidden = TR.res.parts.length <= MAX_PARTS || !splitEach(); }));
$('wzName').addEventListener('input', partNames);
function finishWizard(place) {
  const res = TR.res;
  const name = ($('wzName').value || '').trim() || 'Bild-Design';
  const cat = ($('wzCat').value || '').trim() || 'Eigene';
  let msg;
  if (splitEach()) {
    const sel = [...$('wzParts').querySelectorAll('input[type=checkbox]')].filter((c) => c.checked).map((c) => +c.dataset.i);
    if (!sel.length) { toast('Bitte mindestens ein Teil auswählen.'); return; }
    const ents = sel.map((i) => ({ p: res.parts[i], lib: addLibEntry({ name: name + ' ' + (i + 1), vb: res.parts[i].vb, inner: res.parts[i].inner, cat }) }));
    if (place) {
      let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
      ents.forEach(({ p }) => { x1 = Math.min(x1, p.vb[0]); y1 = Math.min(y1, p.vb[1]); x2 = Math.max(x2, p.vb[0] + p.vb[2]); y2 = Math.max(y2, p.vb[1] + p.vb[3]); });
      const bw = x2 - x1, bh = y2 - y1, k = 0.3 * Math.min(S.W, S.H) / Math.max(bw, bh);
      const ox = S.W / 2 - bw * k / 2, oy = S.H / 2 - bh * k / 2, gid = ents.length > 1 ? newId('g') : undefined;
      snapshot();
      const items = ents.map(({ p, lib }) => addItemRaw({ libId: lib.id, x: ox + (p.vb[0] - x1) * k, y: oy + (p.vb[1] - y1) * k, w: p.vb[2] * k, h: p.vb[3] * k, gid }));
      selectIds(items.map((it) => it.id)); render(); save();
    }
    msg = sel.length + ' Teile zur Bibliothek hinzugefügt.';
  } else {
    const lib = addLibEntry({ name, vb: res.vb, inner: res.inner, cat });
    if (place) addItem(lib.id, S.W / 2, S.H / 2);
    msg = '„' + name + '“ zur Bibliothek hinzugefügt.';
  }
  wdlg.close(); $('wzName').value = '';
  toast(msg);
}

/* Bild beschaffen: Datei, Ziehen, Einfügen */
$('wizBtn').onclick = openWizard;
$('wzClose').onclick = () => wdlg.close();
$('wzBack').onclick = () => wizStep(Math.max(1, TR.step - 1));
$('wzNext').onclick = () => wizStep(Math.min(3, TR.step + 1));
$('wzFile').onclick = () => $('wzFileInput').click();
$('wzFileInput').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) loadBlob(f); });
$('wzAdd').onclick = () => finishWizard(false);
$('wzAddPlace').onclick = () => finishWizard(true);
$('wzPaste').onclick = async () => {
  try {
    for (const it of await navigator.clipboard.read()) { const t = it.types.find((x) => x.startsWith('image/')); if (t) return loadBlob(await it.getType(t)); }
    toast('In der Zwischenablage ist kein Bild.');
  } catch (e) { toast('Bitte Strg+V drücken, um das Bild einzufügen.'); }
};
document.addEventListener('paste', (e) => {
  const it = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith('image/'));
  if (!it) return;
  e.preventDefault(); loadBlob(it.getAsFile());
});
const wz = $('wzDrop');
wz.addEventListener('dragover', (e) => { e.preventDefault(); wz.classList.add('over'); });
wz.addEventListener('dragleave', () => wz.classList.remove('over'));
wz.addEventListener('drop', (e) => { e.preventDefault(); wz.classList.remove('over'); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/')); if (f) loadBlob(f); });
window.__wiz = { loadBlob, TR, traceImage, wzOpts, thin, skeletonLines };

})();
