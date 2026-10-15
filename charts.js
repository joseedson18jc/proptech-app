/* Minimal SVG charts drawn to one scale; colors come from CSS classes bound to theme tokens. */
(function (root) {
  "use strict";

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * p;
  }

  /**
   * series: [{ points: [[x, y], ...], cls: "a"|"b"|"c", area?: boolean }]
   * hlines: [{ y, cls: "target"|"zero", label? }], marks: [{ x, y, cls, label }]
   */
  function line({ w = 640, h = 260, series, hlines = [], marks = [], xMin = 0, xMax, yMin = 0, yMax, xTicks = 6, yTicks = 4, xFmt = String, yFmt = String, title = "" }) {
    const pad = { l: 52, r: 20, t: 18, b: 30 };
    const allY = series.flatMap((s) => s.points.map((p) => p[1])).concat(hlines.map((l) => l.y));
    const rawTop = yMax != null ? yMax : Math.max(...allY) * 1.08;
    const rawBottom = yMin != null ? Math.min(yMin, ...allY) : Math.min(...allY);
    const step = niceMax((rawTop - rawBottom) / yTicks);
    const bottom = Math.floor(rawBottom / step) * step;
    const top = Math.max(bottom + step, Math.ceil(rawTop / step) * step);
    yTicks = Math.round((top - bottom) / step);
    const X = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * (w - pad.l - pad.r);
    const Y = (y) => pad.t + (1 - (y - bottom) / (top - bottom)) * (h - pad.t - pad.b);
    const out = [`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">`];
    for (let i = 0; i <= yTicks; i += 1) {
      const v = bottom + ((top - bottom) * i) / yTicks;
      out.push(`<line class="grid-l" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/>`);
      out.push(`<text class="axis-t" x="${pad.l - 8}" y="${Y(v) + 3}" text-anchor="end">${yFmt(v)}</text>`);
    }
    for (let i = 0; i <= xTicks; i += 1) {
      const v = xMin + ((xMax - xMin) * i) / xTicks;
      out.push(`<text class="axis-t" x="${X(v)}" y="${h - 10}" text-anchor="middle">${xFmt(Math.round(v))}</text>`);
    }
    if (bottom < 0 && top > 0) out.push(`<line class="zero" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(0)}" y2="${Y(0)}"/>`);
    hlines.forEach((l) => {
      out.push(`<line class="${l.cls}" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(l.y)}" y2="${Y(l.y)}"/>`);
      if (l.label) out.push(`<text class="lbl-good" x="${w - pad.r - 4}" y="${Y(l.y) - 6}" text-anchor="end">${l.label}</text>`);
    });
    series.forEach((s) => {
      const d = s.points.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" ");
      if (s.area) {
        const base = Y(Math.max(bottom, 0));
        const first = s.points[0];
        const last = s.points[s.points.length - 1];
        out.push(`<path class="area-${s.cls}" d="${d} L${X(last[0]).toFixed(1)} ${base} L${X(first[0]).toFixed(1)} ${base} Z"/>`);
      }
      out.push(`<path class="line-${s.cls}" d="${d}"/>`);
    });
    marks.forEach((m) => {
      const x = X(m.x);
      const y = Y(m.y);
      const anchor = x > w * 0.7 ? "end" : "start";
      const dx = anchor === "end" ? -9 : 9;
      out.push(`<circle class="mark ${m.cls}" cx="${x}" cy="${y}" r="5"/>`);
      if (m.label) out.push(`<text class="lbl" x="${x + dx}" y="${y - 9}" text-anchor="${anchor}">${m.label}</text>`);
    });
    out.push("</svg>");
    return out.join("");
  }

  root.Charts = Object.freeze({ line, niceMax });
})(typeof self !== "undefined" ? self : this);
