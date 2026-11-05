// Cloak: two verlet chains hung from the neck and the near shoulder.
// The cloth is the area between them. Fixed timestep, so the motion is the same
// for the same sequence of poses (deterministic) and inertia comes for free.

import { noise1 } from "./util.js";

const N = 11;
const GRAV = -520; // world units / s²
const DAMP = 0.985;

export class Cloak {
  constructor() {
    this.a = []; this.b = [];
    this.lenA = 136 / (N - 1);
    this.lenB = 120 / (N - 1);
    this.ready = false;
  }

  reset(sk) {
    const mk = (anchor, seg, back) => {
      const pts = [];
      for (let i = 0; i < N; i++) {
        const x = anchor[0] - back * i * 0.6;
        const y = Math.max(1, anchor[1] - seg * i);
        pts.push({ x, y, px: x, py: y });
      }
      return pts;
    };
    this.a = mk(sk.cloakA, this.lenA, 2.2);
    this.b = mk(sk.cloakB, this.lenB, 1.2);
    this.ready = true;
  }

  // world: { rockX, rockR } ; t: seconds (for wind)
  step(sk, dt, t, world) {
    if (!this.ready) this.reset(sk);
    const wind = -26 + 16 * noise1(t * 0.35, 3) + 8 * Math.sin(t * 1.3);
    const chains = [[this.a, sk.cloakA, this.lenA], [this.b, sk.cloakB, this.lenB]];
    for (const [pts] of chains) {
      for (let i = 1; i < N; i++) {
        const p = pts[i];
        const k = i / (N - 1);
        const vx = (p.x - p.px) * DAMP;
        const vy = (p.y - p.py) * DAMP;
        p.px = p.x; p.py = p.y;
        p.x += vx + wind * k * dt * dt;
        p.y += vy + GRAV * dt * dt;
      }
    }
    // spine line: cloth may not pass forward through the body
    const [H, Nk] = sk.spine;
    const limit = (y) => {
      if (y >= H[1]) {
        const k = Math.min(1, (y - H[1]) / Math.max(1, Nk[1] - H[1]));
        return H[0] + (Nk[0] - H[0]) * k - 7;
      }
      return H[0] - 3;
    };
    for (let it = 0; it < 6; it++) {
      for (const [pts, anchor, seg] of chains) {
        pts[0].x = anchor[0]; pts[0].y = anchor[1];
        for (let i = 1; i < N; i++) {
          const p = pts[i - 1], q = pts[i];
          const dx = q.x - p.x, dy = q.y - p.y;
          const d = Math.hypot(dx, dy) || 1e-6;
          const diff = (d - seg) / d;
          if (i === 1) { q.x -= dx * diff; q.y -= dy * diff; }
          else { p.x += dx * diff * 0.5; p.y += dy * diff * 0.5; q.x -= dx * diff * 0.5; q.y -= dy * diff * 0.5; }
        }
      }
      // keep the two edges roughly a cloth-width apart
      for (let i = 2; i < N; i++) {
        const p = this.a[i], q = this.b[i];
        const dx = q.x - p.x, dy = q.y - p.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const want = 12 + i * 2.9;
        const diff = ((d - want) / d) * 0.25;
        p.x += dx * diff; p.y += dy * diff; q.x -= dx * diff; q.y -= dy * diff;
      }
      for (const [pts] of chains) {
        for (let i = 1; i < N; i++) {
          const p = pts[i];
          const lx = limit(p.y);
          if (p.x > lx) p.x = lx;
          if (p.y < 1) { p.y = 1; p.px = p.x - (p.x - p.px) * 0.6; }
          // rock the knight sits on
          const rx = p.x - world.rockX, ry = p.y - world.rockR * 0.75;
          const rd = Math.hypot(rx, ry);
          if (rd < world.rockR + 2) { const k = (world.rockR + 2) / (rd || 1); p.x = world.rockX + rx * k; p.y = world.rockR * 0.75 + ry * k; }
        }
      }
    }
  }

  draw(ctx, view, light) {
    if (!this.ready) return;
    const s = view.s;
    const P = (p) => [view.ox + p.x * s, view.gy - p.y * s];
    const A = this.a.map(P), B = this.b.map(P);
    const last = N - 1;
    // tattered hem between the two chain ends
    const hem = [];
    const steps = 7;
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      const x = A[last][0] + (B[last][0] - A[last][0]) * f;
      const y = A[last][1] + (B[last][1] - A[last][1]) * f;
      const notch = (k % 2 ? 1 : 0) * (3 + ((k * 7) % 5)) * s;
      hem.push([x, y - notch]);
    }
    ctx.beginPath();
    A.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    hem.forEach((q) => ctx.lineTo(q[0], q[1]));
    for (let i = last; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]);
    ctx.closePath();
    const top = Math.min(A[0][1], B[0][1]);
    const bot = Math.max(A[last][1], B[last][1]);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "#2a0408");
    g.addColorStop(0.3, "#560812");
    g.addColorStop(0.75, "#6c0b17");
    g.addColorStop(1, "#3f060d");
    ctx.fillStyle = g;
    ctx.fill();
    // folds
    ctx.lineCap = "round";
    for (const f of [0.3, 0.62]) {
      ctx.beginPath();
      for (let i = 1; i <= last; i++) {
        const x = A[i][0] + (B[i][0] - A[i][0]) * f;
        const y = A[i][1] + (B[i][1] - A[i][1]) * f;
        i === 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(12,0,3,0.55)";
      ctx.lineWidth = 1.6 * s;
      ctx.stroke();
    }
    // warm edge from the fire on the outer edge
    if (light > 0.02) {
      ctx.beginPath();
      B.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.strokeStyle = `rgba(255,100,45,${0.18 * light})`;
      ctx.lineWidth = 1.2 * s;
      ctx.stroke();
    }
  }

  extent() {
    return [...this.a, ...this.b].map((p) => [p.x, p.y]);
  }
}

