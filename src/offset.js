/* VectorDrop: Konturversatz (Offset) per Raster + Distanztransformation + Marching Squares.
 * Global: window.VDOffset.compute(lib, wMm, hMm, offMm, n) -> Promise<string> (SVG-Pfad in lib.vb-Koordinaten)
 */
(function () {
  'use strict';

  var INF = 1e20;

  // Felzenszwalb & Huttenlocher: 1D-Transformation (quadrierte Distanz), f -> d
  function edt1d(f, d, n, v, z) {
    var k = 0, q, s;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (q = 1; q < n; q++) {
      do {
        var p = v[k];
        s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
        if (s <= z[k]) k--; else break;
      } while (k >= 0);
      if (k < 0) { k = 0; v[0] = q; z[0] = -INF; z[1] = INF; continue; }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      var dq = q - v[k];
      d[q] = dq * dq + f[v[k]];
    }
  }

  // 2D, in place auf Float64Array g (Länge W*H)
  function edt2d(g, W, H) {
    var m = Math.max(W, H);
    var f = new Float64Array(m), d = new Float64Array(m);
    var v = new Int32Array(m), z = new Float64Array(m + 1);
    var x, y;
    for (x = 0; x < W; x++) {
      for (y = 0; y < H; y++) f[y] = g[y * W + x];
      edt1d(f, d, H, v, z);
      for (y = 0; y < H; y++) g[y * W + x] = d[y];
    }
    for (y = 0; y < H; y++) {
      var o = y * W;
      for (x = 0; x < W; x++) f[x] = g[o + x];
      edt1d(f, d, W, v, z);
      for (x = 0; x < W; x++) g[o + x] = d[x];
    }
  }

  // Marching Squares -> Liste geschlossener Schleifen (Arrays [x0,y0,x1,y1,...] in Pixelkoordinaten)
  function contours(sd, W, H, L) {
    // Kanten-ID: horizontal (i,j)-(i+1,j): 2*(j*W+i); vertikal (i,j)-(i,j+1): 2*(j*W+i)+1
    var ptIdx = new Map();   // Kanten-ID -> Punktindex
    var px = [], py = [];
    var adj = [];            // je Punkt: [a, b] (-1 = leer)

    function pt(id) {
      var k = ptIdx.get(id);
      if (k !== undefined) return k;
      var vert = id & 1, c = id >> 1;
      var i = c % W, j = (c - i) / W;
      var a = sd[c], b = vert ? sd[c + W] : sd[c + 1];
      // t = Anteil von Knoten a zu Knoten b, an dem sd == L
      var t = (L - a) / (b - a);
      if (!(t >= 0 && t <= 1)) t = 0.5;
      px.push(i + 0.5 + (vert ? 0 : t));
      py.push(j + 0.5 + (vert ? t : 0));
      k = px.length - 1;
      ptIdx.set(id, k);
      adj.push(-1, -1);
      return k;
    }
    function seg(e1, e2) {
      var a = pt(e1), b = pt(e2);
      if (adj[2 * a] < 0) adj[2 * a] = b; else adj[2 * a + 1] = b;
      if (adj[2 * b] < 0) adj[2 * b] = a; else adj[2 * b + 1] = a;
    }

    for (var j = 0; j < H - 1; j++) {
      for (var i = 0; i < W - 1; i++) {
        var c = j * W + i;
        var vtl = sd[c], vtr = sd[c + 1], vbl = sd[c + W], vbr = sd[c + W + 1];
        var idx = (vtl <= L ? 8 : 0) | (vtr <= L ? 4 : 0) | (vbr <= L ? 2 : 0) | (vbl <= L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        var T = 2 * c, B = 2 * (c + W), Lf = 2 * c + 1, R = 2 * (c + 1) + 1;
        switch (idx) {
          case 1: case 14: seg(Lf, B); break;
          case 2: case 13: seg(B, R); break;
          case 3: case 12: seg(Lf, R); break;
          case 4: case 11: seg(T, R); break;
          case 6: case 9: seg(T, B); break;
          case 7: case 8: seg(T, Lf); break;
          case 5:
          case 10: {
            var cin = (vtl + vtr + vbl + vbr) / 4 <= L;
            // idx 5: tl,br innen ; idx 10: tr,bl innen
            if ((idx === 5) === cin) { seg(T, R); seg(B, Lf); }
            else { seg(T, Lf); seg(R, B); }
            break;
          }
        }
      }
    }

    // Verketten
    var n = px.length, used = new Uint8Array(n), loops = [];
    for (var s = 0; s < n; s++) {
      if (used[s]) continue;
      var loop = [], prev = -1, cur = s, closed = false;
      while (true) {
        used[cur] = 1;
        loop.push(px[cur], py[cur]);
        var a = adj[2 * cur], b = adj[2 * cur + 1];
        var nx = (a >= 0 && a !== prev && !(used[a] && a !== s)) ? a :
                 (b >= 0 && b !== prev && !(used[b] && b !== s)) ? b : -1;
        // Rückkehr zum Start
        if (nx < 0) {
          if ((a === s || b === s) && prev !== -1 && loop.length >= 6) closed = true;
          break;
        }
        if (nx === s) { closed = true; break; }
        prev = cur; cur = nx;
      }
      if (closed && loop.length >= 6) loops.push(loop);
    }
    return loops;
  }

  // Douglas-Peucker für geschlossene Linienzüge
  function simplifyClosed(p, tol) {
    var n = p.length / 2;
    if (n < 4) return p;
    // weitester Punkt von Punkt 0
    var far = 0, best = -1, i;
    for (i = 1; i < n; i++) {
      var dx = p[2 * i] - p[0], dy = p[2 * i + 1] - p[1], dd = dx * dx + dy * dy;
      if (dd > best) { best = dd; far = i; }
    }
    var keep = new Uint8Array(n);
    keep[0] = 1; keep[far] = 1;
    var tol2 = tol * tol;
    var stack = [[0, far], [far, n]]; // zweiter Abschnitt endet bei n (== Punkt 0)
    while (stack.length) {
      var seg = stack.pop(), a = seg[0], b = seg[1];
      if (b - a < 2) continue;
      var ax = p[2 * a], ay = p[2 * a + 1];
      var bi = b % n, bx = p[2 * bi], by = p[2 * bi + 1];
      var ex = bx - ax, ey = by - ay, el2 = ex * ex + ey * ey;
      var maxd = -1, mi = -1;
      for (i = a + 1; i < b; i++) {
        var qx = p[2 * i] - ax, qy = p[2 * i + 1] - ay, d2;
        if (el2 === 0) d2 = qx * qx + qy * qy;
        else {
          var cr = qx * ey - qy * ex;
          d2 = cr * cr / el2;
        }
        if (d2 > maxd) { maxd = d2; mi = i; }
      }
      if (maxd > tol2) {
        keep[mi] = 1;
        stack.push([a, mi], [mi, b]);
      }
    }
    var out = [];
    for (i = 0; i < n; i++) if (keep[i]) out.push(p[2 * i], p[2 * i + 1]);
    return out;
  }

  function rasterize(svg, W, H) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var cv = document.createElement('canvas');
          cv.width = W; cv.height = H;
          var ctx = cv.getContext('2d', { willReadFrequently: true });
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          resolve(ctx.getImageData(0, 0, W, H).data);
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('SVG konnte nicht gerastert werden')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  function run(lib, wMm, hMm, offMm, n, withZero) {
    return new Promise(function (resolve, reject) {
      try {
        wMm = +wMm; hMm = +hMm; offMm = +offMm;
        n = Math.max(1, Math.min(20, Math.round(+n || 1)));
        if (!lib || !lib.vb || !(wMm > 0) || !(hMm > 0) || !isFinite(offMm) || (offMm === 0 && !withZero)) { resolve([]); return; }
        var vb = lib.vb;
        var margin = (offMm > 0 ? offMm * n : 0) + 1;
        var totW = wMm + 2 * margin, totH = hMm + 2 * margin;
        var scale = Math.min(10, 1200 / Math.max(totW, totH));
        var W = Math.max(2, Math.ceil(totW * scale)), H = Math.max(2, Math.ceil(totH * scale));
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
          '" viewBox="' + (-margin) + ' ' + (-margin) + ' ' + (W / scale) + ' ' + (H / scale) + '">' +
          '<svg x="0" y="0" width="' + wMm + '" height="' + hMm + '" viewBox="' + vb.join(' ') +
          '" preserveAspectRatio="none" overflow="visible">' + lib.inner + '</svg></svg>';

        rasterize(svg, W, H).then(function (data) {
          var N = W * H, i;
          var dOut = new Float64Array(N), dIn = new Float64Array(N);
          var any = false;
          for (i = 0; i < N; i++) {
            if (data[4 * i + 3] > 127) { any = true; dOut[i] = 0; dIn[i] = INF; }
            else { dOut[i] = INF; dIn[i] = 0; }
          }
          if (!any) { resolve([]); return; }
          edt2d(dOut, W, H);
          edt2d(dIn, W, H);
          var sd = new Float64Array(N);
          for (i = 0; i < N; i++) {
            sd[i] = dOut[i] > 0 ? Math.sqrt(dOut[i]) - 0.5 : -(Math.sqrt(dIn[i]) - 0.5);
          }
          dOut = null; dIn = null;

          var kx = vb[2] / wMm, ky = vb[3] / hMm;
          var parts = [];
          var kMax = offMm === 0 ? 0 : n, levelsOut = [];
          for (var k = (withZero || offMm === 0) ? 0 : 1; k <= kMax; k++) {
            var lvl = [];
            var L = k * offMm * scale;
            var loops = contours(sd, W, H, L);
            for (var li = 0; li < loops.length; li++) {
              var lp = simplifyClosed(loops[li], 0.25);
              if (lp.length < 6) continue;
              var s = '';
              for (var q = 0; q < lp.length; q += 2) {
                var u = lp[q] / scale - margin, v = lp[q + 1] / scale - margin;
                var X = vb[0] + u * kx, Y = vb[1] + v * ky;
                s += (q ? 'L' : 'M') + (+X.toFixed(3)) + ' ' + (+Y.toFixed(3));
              }
              lvl.push(s + 'Z');
            }
            levelsOut.push(lvl.join(''));
          }
          resolve(levelsOut);
        }).catch(reject);
      } catch (e) { reject(e); }
    });
  }

  /* compute: ein Pfad-String; levels: ein Pfad-String je Stufe (Stufe 0 = Original, nur mit withZero oder offMm = 0) */
  function compute(lib, wMm, hMm, offMm, n, withZero) { return run(lib, wMm, hMm, offMm, n, withZero).then(function (a) { return a.join(''); }); }
  window.VDOffset = { compute: compute, levels: run };
})();
