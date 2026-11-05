// Digital rain background: thousands of tiny green glyphs (0-9 a-z A-Z) falling
// in vertical streams on three depth layers. Rendered into its own canvas at a
// reduced frame rate from pre-rendered glyph atlases (one drawImage per glyph,
// no DOM nodes). Glyph choice is a pure hash of (column, row, time bucket).

import { rng, hash3, clamp } from "./util.js";

const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// size/cell/col in CSS px; alpha = base alpha of a stream's tail
const LAYERS = [
  { name: "far", size: 2.6, cell: 3.6, col: 4.6, speed: [9, 17], len: [10, 34], gap: [0.12, 1.0], alpha: 0.16, color: "#1f8a55", blur: 0.9, rate: [0.25, 0.7] },
  { name: "mid", size: 3.8, cell: 5.2, col: 7.2, speed: [16, 30], len: [8, 26], gap: [0.25, 1.4], alpha: 0.22, color: "#2fbf79", blur: 0, rate: [0.3, 0.9] },
  { name: "near", size: 5.6, cell: 7.4, col: 13, speed: [26, 44], len: [5, 15], gap: [0.8, 2.6], alpha: 0.22, color: "#5fe39a", blur: 0.7, rate: [0.3, 0.8] },
];
const DENSITY = [0.38, 0.62, 1]; // by quality tier

export class Matrix {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.cols = [];
    this.atlas = [];
    this.lastT = -1;
    this.fps = 24;
  }

  resize(w, h, dpr, tier) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.atlas = LAYERS.map((L) => makeAtlas(L, dpr));
    const R = rng(0x6d61);
    const keep = DENSITY[tier];
    this.cols = [];
    LAYERS.forEach((L, li) => {
      const rows = Math.ceil(h / L.cell);
      const n = Math.ceil(w / L.col);
      for (let i = 0; i < n; i++) {
        const r = R();
        if (r > keep) continue; // thinned deterministically for lower tiers
        const len = Math.round(L.len[0] + R() * (L.len[1] - L.len[0]));
        const gap = Math.round(rows * (L.gap[0] + R() * (L.gap[1] - L.gap[0])));
        this.cols.push({
          li, i, x: i * L.col + (R() - 0.5) * L.col * 0.4,
          rows, len, period: rows + len + gap,
          speed: (L.speed[0] + R() * (L.speed[1] - L.speed[0])) / L.cell, // rows per second
          off: R() * (rows + len + gap),
          rate: L.rate[0] + R() * (L.rate[1] - L.rate[0]),
        });
      }
    });
    this.lastT = -1;
  }

  // masks: [{x, y, rx, ry, k}] in CSS px — glyph alpha is multiplied down to k inside.
  // fadeY: glyphs fade out below this y (the ground line).
  // base: optional canvas (same pixel size) painted underneath the glyphs.
  // maskFn: optional (x, y) -> multiplier, e.g. an occupancy grid from the hero video.
  render(t, masks, fadeY, force, base, maskFn) {
    if (!force && this.lastT >= 0 && t - this.lastT < 1 / this.fps && t >= this.lastT) return this.canvas;
    this.lastT = t;
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (base) ctx.drawImage(base, 0, 0);
    else ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let count = 0;
    for (const c of this.cols) {
      const L = LAYERS[c.li], A = this.atlas[c.li];
      const head = Math.floor((c.off + t * c.speed) % c.period) - c.len;
      for (let k = 0; k < c.len; k++) {
        const row = head + c.len - k; // k = 0 is the leading glyph
        if (row < 0 || row >= c.rows) continue;
        const y = row * L.cell;
        if (y > fadeY + 6) continue;
        let a = L.alpha * Math.pow(1 - k / c.len, 1.5);
        if (k === 0) a *= 1.35;
        const bucket = Math.floor(t * c.rate + hash3(c.i, row, c.li) * 7);
        if (hash3(c.i * 3 + c.li, row, Math.floor(t * 1.4)) < 0.0035) a = Math.max(a, 0.5); // brief glint
        let m = maskFn ? maskFn(c.x, y) : 1;
        for (const q of masks) {
          const dx = (c.x - q.x) / q.rx, dy = (y - q.y) / q.ry;
          const d = dx * dx + dy * dy;
          if (d < 1) m *= q.k + (1 - q.k) * d * d;
        }
        if (y > fadeY - 60) m *= clamp((fadeY - y) / 60, 0, 1);
        a *= m;
        if (a < 0.012) continue;
        const gi = Math.floor(hash3(c.i + c.li * 977, row, bucket) * CHARS.length);
        ctx.globalAlpha = Math.min(0.6, a);
        ctx.drawImage(A.img, gi * A.cw, 0, A.cw, A.ch, (c.x - A.pad) * dpr, (y - A.pad) * dpr, A.cw, A.ch);
        count++;
      }
    }
    ctx.globalAlpha = 1;
    this.count = count;
    return this.canvas;
  }
}

function makeAtlas(L, dpr) {
  const pad = Math.ceil(L.blur * 2 + 1);
  const cw = Math.ceil((L.size * 0.75 + pad * 2) * dpr);
  const ch = Math.ceil((L.size * 1.15 + pad * 2) * dpr);
  const img = document.createElement("canvas");
  img.width = cw * CHARS.length;
  img.height = ch;
  const g = img.getContext("2d");
  g.font = `${L.size * dpr}px ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace`;
  g.textBaseline = "top";
  g.fillStyle = L.color;
  for (let i = 0; i < CHARS.length; i++) {
    const x = i * cw + pad * dpr, y = pad * dpr;
    if (L.blur) {
      // draw the glyph off-canvas and keep only its blurred shadow (works without ctx.filter)
      g.shadowColor = L.color;
      g.shadowBlur = L.blur * dpr * 1.6;
      g.shadowOffsetX = 10000;
      g.fillText(CHARS[i], x - 10000, y);
      g.shadowColor = "transparent";
      g.globalAlpha = 0.55;
      g.fillText(CHARS[i], x, y);
      g.globalAlpha = 1;
    } else {
      g.fillText(CHARS[i], x, y);
    }
  }
  return { img, cw, ch, pad };
}
