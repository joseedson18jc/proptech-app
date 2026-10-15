/* Generative illustrations: one facade per listing (seeded by id) and the interactive hero skyline.
   Flat pastel art; colors are illustration content, not UI tokens. */
(function (root) {
  "use strict";

  function rng(seedText) {
    let h = 2166136261;
    for (let i = 0; i < seedText.length; i += 1) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const PALETTES = [
    { sky: ["#e9e6fb", "#f7f4ff"], wall: "#ffffff", wall2: "#d9d4f5", accent: "#5b5cf0", roof: "#3d3fb8", ground: "#d8efe3", tree: "#7cc9a1" },
    { sky: ["#fde9df", "#fff7f2"], wall: "#fff8ef", wall2: "#f6cdb8", accent: "#e86f4f", roof: "#b9502f", ground: "#e5f1dc", tree: "#8cc58b" },
    { sky: ["#dff1ec", "#f3fbf8"], wall: "#ffffff", wall2: "#bfe3d6", accent: "#1f9e7a", roof: "#17725a", ground: "#f3ead6", tree: "#5fb88f" },
    { sky: ["#e2eefc", "#f5f9ff"], wall: "#fbfdff", wall2: "#c9dcf7", accent: "#3b6fe0", roof: "#2a4fa8", ground: "#e2f0dd", tree: "#78bf8c" },
    { sky: ["#fbf2d9", "#fffbef"], wall: "#ffffff", wall2: "#f2deaa", accent: "#d39a1c", roof: "#9a6c0c", ground: "#e6efdc", tree: "#86c08d" },
  ];

  function tree(x, y, s, color) {
    return `<rect x="${x - 2}" y="${y - 6 * s}" width="4" height="${12 * s}" rx="2" fill="#a07a5b"/><circle cx="${x}" cy="${y - 18 * s}" r="${16 * s}" fill="${color}"/><circle cx="${x - 9 * s}" cy="${y - 10 * s}" r="${10 * s}" fill="${color}" opacity=".85"/>`;
  }

  function windows(x, y, cols, rows, w, h, gx, gy, r, lit, accent) {
    let out = "";
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const on = r() < lit;
        out += `<rect x="${x + i * (w + gx)}" y="${y + j * (h + gy)}" width="${w}" height="${h}" rx="2.5" fill="${on ? "#ffd98a" : accent}" opacity="${on ? 1 : 0.22}"/>`;
      }
    }
    return out;
  }

  function facade(l) {
    const r = rng(l.id + l.titulo);
    const p = PALETTES[Math.floor(r() * PALETTES.length)];
    const W = 400;
    const H = 260;
    const gid = "g" + l.id;
    let body = "";
    const isHouse = /Casa|Sobrado/.test(l.tipo);
    if (isHouse) {
      const floors = l.tipo === "Sobrado" ? 2 : 1;
      const hw = 190;
      const hx = 105 + r() * 20;
      const hh = 70 * floors;
      const hy = 214 - hh;
      body += `<rect x="${hx}" y="${hy}" width="${hw}" height="${hh}" rx="6" fill="${p.wall}"/>`;
      body += `<rect x="${hx + hw - 70}" y="${hy}" width="70" height="${hh}" rx="6" fill="${p.wall2}"/>`;
      body += `<path d="M${hx - 14} ${hy + 4} L${hx + hw / 2} ${hy - 58} L${hx + hw + 14} ${hy + 4} Z" fill="${p.roof}"/>`;
      body += `<rect x="${hx + 28}" y="${214 - 52}" width="30" height="52" rx="4" fill="${p.accent}"/><circle cx="${hx + 52}" cy="${214 - 26}" r="2.4" fill="#fff"/>`;
      body += windows(hx + 78, hy + 18, 2, floors, 30, 26, 14, 44, r, 0.5, p.accent);
      body += windows(hx + hw - 52, hy + 18, 1, floors, 34, 26, 0, 44, r, 0.4, p.accent);
      if (l.tags.includes("Quintal")) body += `<rect x="40" y="208" width="60" height="6" rx="3" fill="${p.wall2}"/><rect x="${hx + hw + 18}" y="208" width="70" height="6" rx="3" fill="${p.wall2}"/>`;
    } else {
      const tall = l.tipo === "Apartamento" ? 1 : 0.72;
      const bw = l.tipo === "Kitnet" || l.tipo === "Studio" ? 120 : 150;
      const bx = 130 + (r() - 0.5) * 40;
      const bh = 190 * tall;
      const by = 214 - bh;
      body += `<rect x="${bx + bw - 10}" y="${by + 30}" width="70" height="${bh - 30}" rx="6" fill="${p.wall2}"/>`;
      body += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="${p.wall}"/>`;
      body += `<rect x="${bx}" y="${by}" width="${bw}" height="12" rx="6" fill="${p.accent}" opacity=".9"/>`;
      const cols = Math.max(2, Math.floor((bw - 24) / 30));
      const rows = Math.max(3, Math.floor((bh - 60) / 30));
      body += windows(bx + 14, by + 26, cols, rows, 20, 18, 10, 12, r, 0.35, p.accent);
      if (l.tags.includes("Varanda")) {
        for (let j = 0; j < rows; j += 2) body += `<rect x="${bx - 6}" y="${by + 26 + j * 30 + 18}" width="${bw + 12}" height="3" rx="1.5" fill="${p.roof}" opacity=".55"/>`;
      }
      body += `<rect x="${bx + bw / 2 - 16}" y="${214 - 34}" width="32" height="34" rx="4" fill="${p.accent}"/>`;
      body += windows(bx + bw + 4, by + 46, 1, Math.max(2, rows - 2), 18, 16, 0, 14, r, 0.3, p.accent);
    }
    const sunX = 300 + r() * 70;
    return `<svg class="art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#${gid})"/>
      <circle cx="${sunX}" cy="${46 + r() * 20}" r="${22 + r() * 10}" fill="#fff" opacity=".9"/>
      <ellipse cx="${70 + r() * 60}" cy="${44 + r() * 30}" rx="38" ry="10" fill="#fff" opacity=".8"/>
      <rect y="210" width="${W}" height="${H - 210}" fill="${p.ground}"/>
      <g class="art-house">${body}</g>
      ${tree(56, 214, 1.05, p.tree)}${tree(352, 214, 0.85, p.tree)}
    </svg>`;
  }

  // Hero skyline: three depth layers that drift with the pointer. Built once, then reused.
  let skylineCache = null;
  function skyline() {
    if (skylineCache) return skylineCache;
    const r = rng("proptech-hero");
    const layer = (n, yBase, minH, maxH, fill, win, lit) => {
      let x = -40;
      let out = "";
      while (x < 1240) {
        const w = 60 + r() * 90;
        const h = minH + r() * (maxH - minH);
        out += `<rect x="${x}" y="${yBase - h}" width="${w}" height="${h + 40}" rx="6" fill="${fill}"/>`;
        if (win) {
          const cols = Math.floor((w - 16) / 18);
          const rows = Math.floor((h - 24) / 22);
          for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
            const on = r() < lit;
            out += `<rect class="${on && r() < 0.25 ? "twinkle" : ""}" x="${x + 10 + i * 18}" y="${yBase - h + 16 + j * 22}" width="9" height="11" rx="2" fill="${on ? "#ffd98a" : win}" opacity="${on ? 0.95 : 0.35}" style="animation-delay:${(r() * 6).toFixed(2)}s"/>`;
          }
        }
        x += w + 6 + r() * 18;
      }
      return `<g class="layer" data-depth="${n}">${out}</g>`;
    };
    let trees = "";
    for (let i = 0; i < 16; i += 1) trees += tree(30 + i * 78 + r() * 30, 470, 0.9 + r() * 0.6, i % 2 ? "#7cc9a1" : "#5fb88f");
    skylineCache = `<svg class="skyline" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><linearGradient id="heroSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ebe8fd"/><stop offset=".65" stop-color="#f8f1ff"/><stop offset="1" stop-color="#fff4ec"/></linearGradient></defs>
      <rect width="1200" height="520" fill="url(#heroSky)"/>
      <g class="layer" data-depth="0.2"><circle cx="930" cy="140" r="78" fill="#ffd8c2"/><circle cx="930" cy="140" r="54" fill="#ffe6d6"/></g>
      <g class="layer clouds" data-depth="0.35"><ellipse cx="260" cy="110" rx="90" ry="20" fill="#fff"/><ellipse cx="320" cy="96" rx="50" ry="18" fill="#fff"/><ellipse cx="700" cy="70" rx="70" ry="14" fill="#fff" opacity=".85"/></g>
      ${layer(0.5, 430, 120, 260, "#dcd6fb", null, 0)}
      ${layer(0.8, 470, 80, 200, "#b9b2f4", "#8d86e6", 0.18)}
      ${layer(1.2, 500, 40, 120, "#ffffff", "#c9c4f7", 0.12)}
      <g class="layer" data-depth="1.5">${trees}<rect y="490" width="1200" height="40" fill="#e3f2e8"/></g>
    </svg>`;
    return skylineCache;
  }

  function bindParallax(el) {
    if (!el || el._px) return;
    el._px = true;
    if (root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers = [...el.querySelectorAll(".layer")];
    let raf = 0;
    el.addEventListener("pointermove", (e) => {
      const b = el.getBoundingClientRect();
      const dx = (e.clientX - b.left) / b.width - 0.5;
      const dy = (e.clientY - b.top) / b.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => layers.forEach((g) => {
        const d = Number(g.dataset.depth);
        g.style.transform = `translate(${(-dx * 26 * d).toFixed(1)}px, ${(-dy * 10 * d).toFixed(1)}px)`;
      }));
    });
    el.addEventListener("pointerleave", () => layers.forEach((g) => { g.style.transform = ""; }));
  }

  root.Art = Object.freeze({ facade, skyline, bindParallax });
})(typeof self !== "undefined" ? self : this);
