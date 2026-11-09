/* Text einfügen: Schriftzug wird mit opentype.js in Vektorpfade umgewandelt. */
(() => {
'use strict';
const { $, S, toast, addLibEntry, addItem } = window.VD;
const fonts = [];

function b64ToBuf(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
function getFont(i) { if (!fonts[i]) fonts[i] = window.opentype.parse(b64ToBuf(window.VD_FONTS[i].data)); return fonts[i]; }

function buildText(text, fi) {
  const font = getFont(fi);
  let d = '', x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  text.split('\n').forEach((line, li) => {
    if (!line.trim()) return;
    const p = font.getPath(line, 0, li * 115, 100), bb = p.getBoundingBox();
    if (!isFinite(bb.x1)) return;
    d += p.toPathData(2);
    x1 = Math.min(x1, bb.x1); y1 = Math.min(y1, bb.y1); x2 = Math.max(x2, bb.x2); y2 = Math.max(y2, bb.y2);
  });
  return d ? { d, vb: [x1, y1, x2 - x1, y2 - y1] } : null;
}

const sel = $('txtFont');
sel.innerHTML = window.VD_FONTS.map((f, i) => `<option value="${i}">${f.name}</option>`).join('');

let current = null;
function preview() {
  const t = $('txtIn').value;
  try { current = t.trim() ? buildText(t, +sel.value) : null; } catch (e) { current = null; }
  const sv = $('textPrev');
  if (!current) { sv.innerHTML = ''; $('txtAdd').disabled = true; return; }
  const [x, y, w, h] = current.vb;
  sv.setAttribute('viewBox', `${x - 8} ${y - 8} ${w + 16} ${h + 16}`);
  sv.innerHTML = `<path d="${current.d}" fill="#000"/>`;
  $('txtAdd').disabled = false;
}
$('textBtn').onclick = () => { $('txtIn').value = $('txtIn').value || ''; preview(); $('textDlg').showModal(); $('txtIn').focus(); };
$('txtIn').addEventListener('input', preview);
sel.addEventListener('change', preview);
$('txtCancel').onclick = () => $('textDlg').close();
$('txtAdd').onclick = () => {
  if (!current) return;
  const name = $('txtIn').value.trim().replace(/\s+/g, ' ').slice(0, 24);
  const lib = addLibEntry({ name: '„' + name + '“', vb: current.vb, inner: `<path d="${current.d}" fill="#000"/>`, cat: S.filterCat || 'Text' });
  $('textDlg').close();
  addItem(lib.id, S.W / 2, S.H / 2);
  toast('Text eingefügt – du findest ihn auch in der Bibliothek.');
};
})();
