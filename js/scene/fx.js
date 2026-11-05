// Effects: campfire, embers, smoke, sword trail, footstep ash and shed glyphs.
// All particles live in fixed-size pools (no unbounded growth) and are drawn
// as tiny squares or glyphs, never DOM elements.

import { rng, noise1, clamp, TAU } from "./util.js";

const GLYPHS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class Pool {
  constructor(max) { this.max = max; this.items = []; }
  add(p) { if (this.items.length < this.max) this.items.push(p); }
  step(dt, fn) {
    const a = this.items;
    for (let i = a.length - 1; i >= 0; i--) {
      const p = a[i];
      p.age += dt;
      if (p.age >= p.life) { a[i] = a[a.length - 1]; a.pop(); continue; }
      fn(p, dt);
    }
  }
  clear() { this.items.length = 0; }
}

export class Effects {
  constructor() {
    this.embers = new Pool(140);
    this.smoke = new Pool(36);
    this.bits = new Pool(160); // crimson fragments from the sword, ash from footsteps
    this.glyphs = new Pool(120); // green glyphs shed while the knight materialises
    this.trail = [];
    this.reseed();
  }

  reseed() {
    this.R = rng(0xf17e);
    this.emberAcc = 0; this.smokeAcc = 0;
  }

  clear() {
    this.embers.clear(); this.smoke.clear(); this.bits.clear(); this.glyphs.clear();
    this.trail.length = 0;
    this.reseed();
  }

  // world-space simulation (y up)
  step(dt, t, world, tier) {
    const R = this.R;
    const fx = world.fireX;
    this.emberAcc += dt * [6, 10, 15][tier];
    while (this.emberAcc >= 1) {
      this.emberAcc -= 1;
      this.embers.add({ x: fx + (R() - 0.5) * 18, y: 6 + R() * 12, vx: (R() - 0.5) * 10, vy: 22 + R() * 34,
        age: 0, life: 1.6 + R() * 2.4, size: 0.8 + R() * 1.4, seed: R() * 100 });
    }
    if (tier > 0) {
      this.smokeAcc += dt * 2.2;
      while (this.smokeAcc >= 1) {
        this.smokeAcc -= 1;
        this.smoke.add({ x: fx + (R() - 0.5) * 10, y: 30 + R() * 8, vx: -3 + (R() - 0.5) * 4, vy: 14 + R() * 8,
          age: 0, life: 4 + R() * 3, size: 8 + R() * 6, seed: R() * 100 });
      }
    }
    this.embers.step(dt, (p, d) => {
      p.vx += noise1(t * 1.7 + p.seed, 5) * 40 * d - 4 * d;
      p.vy += 6 * d;
      p.x += p.vx * d; p.y += p.vy * d;
    });
    this.smoke.step(dt, (p, d) => {
      p.vx += noise1(t * 0.5 + p.seed, 9) * 6 * d - 2 * d;
      p.x += p.vx * d; p.y += p.vy * d; p.size += 5 * d;
    });
    this.bits.step(dt, (p, d) => {
      p.vx *= 1 - 2.4 * d; p.vy = p.vy * (1 - 2.4 * d) + (p.kind === "ash" ? 3 : -12) * d;
      p.x += p.vx * d; p.y = Math.max(0.5, p.y + p.vy * d);
    });
    this.glyphs.step(dt, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; });
    const now = t;
    while (this.trail.length && now - this.trail[0].t > 0.2) this.trail.shift();
  }

  shedGlyph(x, y, strength) {
    const R = this.R;
    this.glyphs.add({ x: x + (R() - 0.5) * 8, y: y + (R() - 0.5) * 8, vx: -6 - R() * 14, vy: (R() - 0.3) * 8,
      age: 0, life: 0.8 + R() * 1.2, ch: GLYPHS[Math.floor(R() * GLYPHS.length)], a: 0.3 + 0.35 * strength });
  }

  footstep(x) {
    const R = this.R;
    for (let i = 0; i < 6; i++) {
      this.bits.add({ kind: "ash", x: x + (R() - 0.3) * 10, y: 0.8, vx: (R() - 0.5) * 22, vy: 4 + R() * 7,
        age: 0, life: 0.7 + R() * 0.7, size: 0.7 + R() * 0.8 });
    }
  }

  slash(G, tip, vel) {
    const R = this.R;
    for (let i = 0; i < 9; i++) {
      const k = 0.35 + R() * 0.65;
      this.bits.add({ kind: "spark", x: G[0] + (tip[0] - G[0]) * k, y: G[1] + (tip[1] - G[1]) * k,
        vx: vel[0] * k * 0.35 + (R() - 0.5) * 30, vy: vel[1] * k * 0.35 + (R() - 0.5) * 30,
        age: 0, life: 0.35 + R() * 0.45, size: 0.8 + R() * 1.0 });
    }
  }

  pushTrail(t, G, tip) { this.trail.push({ t, G: G.slice(), tip: tip.slice() }); }

  /* ------------------------------------------------------------ drawing */

  drawFireLight(ctx, view, t, flick) {
    const [fx, fy] = toS(view, [view.world.fireX, 6]);
    const s = view.s;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    let g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 260 * s);
    g.addColorStop(0, `rgba(255,100,45,${0.16 * flick})`);
    g.addColorStop(0.4, `rgba(181,18,37,${0.05 * flick})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(fx - 260 * s, fy - 260 * s, 520 * s, 520 * s);
    // pool of light on the ground
    ctx.translate(fx, view.gy);
    ctx.scale(1, 0.22);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, 150 * s);
    g.addColorStop(0, `rgba(255,120,60,${0.22 * flick})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 150 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawFire(ctx, view, t) {
    const s = view.s;
    const [cx, gy] = toS(view, [view.world.fireX, 0]);
    // stones and logs
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI;
      const x = cx + Math.cos(a) * 19 * s, y = gy - 1.2 * s + Math.sin(a) * 1.6 * s;
      ctx.beginPath(); ctx.ellipse(x, y, 5.2 * s, 3.4 * s, 0, 0, TAU);
      ctx.fillStyle = "#121212"; ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, gy - 3 * s);
    for (const [r, l] of [[0.32, 34], [-0.38, 32]]) {
      ctx.save(); ctx.rotate(r);
      ctx.fillStyle = "#1b120d"; ctx.fillRect((-l / 2) * s, -2.6 * s, l * s, 5.2 * s);
      ctx.fillStyle = "rgba(255,100,45,0.55)"; ctx.fillRect((-l / 4) * s, -2.6 * s, (l / 2) * s, 1.1 * s);
      ctx.restore();
    }
    ctx.restore();
    // flames: layered tongues with deterministic noise
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const tongues = [
      [-7, 30, 0], [6, 34, 1.7], [-1, 44, 3.1], [11, 22, 4.4], [-12, 20, 5.9], [2, 26, 7.3],
    ];
    for (const [ox, hBase, sd] of tongues) {
      const h = hBase * (0.72 + 0.28 * (0.5 + 0.5 * noise1(t * 3.1 + sd, 11))) * s;
      const sway = noise1(t * 1.9 + sd, 13) * 5 * s;
      const w = (7 + hBase * 0.12) * s;
      const x0 = cx + ox * s;
      const y0 = gy - 3 * s;
      const g = ctx.createLinearGradient(0, y0, 0, y0 - h);
      g.addColorStop(0, "rgba(255,190,120,0.75)");
      g.addColorStop(0.35, "rgba(255,100,45,0.55)");
      g.addColorStop(0.75, "rgba(181,18,37,0.28)");
      g.addColorStop(1, "rgba(181,18,37,0)");
      ctx.beginPath();
      ctx.moveTo(x0 - w, y0);
      ctx.quadraticCurveTo(x0 - w * 0.9 + sway * 0.3, y0 - h * 0.55, x0 + sway, y0 - h);
      ctx.quadraticCurveTo(x0 + w * 0.9 + sway * 0.3, y0 - h * 0.55, x0 + w, y0);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
    // hot core
    const g = ctx.createRadialGradient(cx, gy - 7 * s, 0, cx, gy - 7 * s, 14 * s);
    g.addColorStop(0, "rgba(255,226,180,0.8)");
    g.addColorStop(1, "rgba(255,100,45,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, gy - 7 * s, 14 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawSmoke(ctx, view) {
    for (const p of this.smoke.items) {
      const k = p.age / p.life;
      const a = 0.07 * Math.sin(Math.PI * k);
      const [x, y] = toS(view, [p.x, p.y]);
      ctx.beginPath(); ctx.arc(x, y, p.size * view.s, 0, TAU);
      ctx.fillStyle = `rgba(40,36,34,${a})`; ctx.fill();
    }
  }

  drawParticles(ctx, view) {
    const s = view.s;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.embers.items) {
      const k = p.age / p.life;
      const [x, y] = toS(view, [p.x, p.y]);
      const a = (1 - k) * (0.6 + 0.4 * Math.sin(p.seed + p.age * 9));
      const c = k < 0.35 ? "255,170,90" : k < 0.7 ? "255,100,45" : "181,18,37";
      ctx.fillStyle = `rgba(${c},${clamp(a, 0, 1)})`;
      const sz = Math.max(1, p.size * s * 0.9);
      ctx.fillRect(x, y, sz, sz);
    }
    for (const p of this.bits.items) {
      const k = p.age / p.life;
      const [x, y] = toS(view, [p.x, p.y]);
      const sz = Math.max(1, p.size * s);
      if (p.kind === "spark") ctx.fillStyle = `rgba(181,18,37,${0.85 * (1 - k)})`;
      else ctx.fillStyle = `rgba(120,118,112,${0.35 * (1 - k)})`;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.restore();
  }

  drawGlyphs(ctx, view) {
    if (!this.glyphs.items.length) return;
    ctx.save();
    ctx.font = `${Math.max(4, 3.2 * view.s)}px ui-monospace, Consolas, monospace`;
    ctx.textBaseline = "middle";
    for (const p of this.glyphs.items) {
      const k = p.age / p.life;
      const [x, y] = toS(view, [p.x, p.y]);
      ctx.fillStyle = `rgba(63,214,130,${p.a * (1 - k)})`;
      ctx.fillText(p.ch, x, y);
    }
    ctx.restore();
  }

  drawTrail(ctx, view, t) {
    const tr = this.trail;
    if (tr.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const age = t - b.t;
      const k = clamp(1 - age / 0.2, 0, 1) * (i / tr.length);
      if (k <= 0) continue;
      const P = [toS(view, a.G), toS(view, a.tip), toS(view, b.tip), toS(view, b.G)];
      const g = ctx.createLinearGradient(P[0][0], P[0][1], P[1][0], P[1][1]);
      g.addColorStop(0, "rgba(181,18,37,0)");
      g.addColorStop(0.6, `rgba(150,18,34,${0.11 * k})`);
      g.addColorStop(1, `rgba(200,50,62,${0.26 * k})`);
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.lineTo(P[2][0], P[2][1]); ctx.lineTo(P[3][0], P[3][1]);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }
}

export function toS(view, p) { return [view.ox + p[0] * view.s, view.gy - p[1] * view.s]; }
