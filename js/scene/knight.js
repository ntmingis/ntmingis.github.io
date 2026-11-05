// Knight rig: solves a 2D skeleton from a timeline pose (IK for arms and legs)
// and draws the armoured silhouette with Canvas 2D paths. No sprites, no images.

import { ik, dir, add, mul, TAU } from "./util.js";
import { SWORD, MOUTH } from "./timeline.js";

const BONES = { torso: 58, neck: 64, thigh: 47, shin: 46, upper: 31, fore: 30, ankle: 6 };

export function solve(sample) {
  const { pose: p, rootX } = sample;
  const H = [rootX + p.hx, p.hy];
  const u = [Math.sin(p.torso), Math.cos(p.torso)]; // torso "up"
  const v = [Math.cos(p.torso), -Math.sin(p.torso)]; // torso "forward"
  const T = (lv, lu) => [H[0] + v[0] * lv + u[0] * lu, H[1] + v[1] * lv + u[1] * lu];
  const ha = p.torso + p.head;
  const hu = [Math.sin(ha), Math.cos(ha)];
  const hv = [Math.cos(ha), -Math.sin(ha)];
  const N = T(0, BONES.neck - 4);
  const headC = add(N, mul(hu, 13.5));
  const Hd = (lv, lu) => [headC[0] + hv[0] * lv + hu[0] * lu, headC[1] + hv[1] * lv + hu[1] * lu];

  const leg = (hipOff, foot) => {
    const hipJ = add(H, [hipOff, 0]);
    const ankle = [rootX + foot[0], foot[1] + BONES.ankle];
    const r = ik(hipJ, ankle, BONES.thigh, BONES.shin, +1);
    return { hip: hipJ, knee: r.joint, ankle: r.end, ground: [r.end[0], r.end[1] - BONES.ankle] };
  };
  const arm = (sh, hand) => {
    const r = ik(sh, add(H, hand), BONES.upper, BONES.fore, -1);
    return { sh, elbow: r.joint, hand: r.end };
  };

  const legN = leg(1.5, p.ff);
  const legF = leg(-2.5, p.bf);
  const armN = arm(T(3, 53), p.rh);
  const armF = arm(T(-1, 54), p.lh);

  // Scabbard swings a little with the stride.
  const scab = p.scab + (sample.gait !== null ? 0.05 * Math.sin(TAU * sample.gait) * sample.gaitW : 0);
  const mouth = add(H, MOUTH);
  const sd = dir(scab);
  let bd, G;
  if (p.held) { bd = dir(p.sw); G = add(armN.hand, mul(bd, SWORD.grip)); }
  else { bd = sd; G = mouth; }

  // Blade length visible outside the scabbard (hidden while it slides in or out).
  let visible = SWORD.blade;
  if (!p.held) visible = 0;
  else {
    const d = Math.atan2(Math.sin(p.sw - scab), Math.cos(p.sw - scab));
    const off = [mouth[0] - G[0], mouth[1] - G[1]];
    const along = off[0] * bd[0] + off[1] * bd[1];
    const across = Math.abs(off[0] * bd[1] - off[1] * bd[0]);
    if (Math.abs(d) < 0.05 && across < 2.5 && along > -1) visible = Math.max(0, Math.min(SWORD.blade, along));
  }
  const tip = add(G, mul(bd, SWORD.blade));

  return {
    H, u, v, T, N, headC, hu, hv, Hd, legN, legF, armN, armF,
    sword: { G, bd, tip, visible, glow: p.glow, held: p.held },
    scabbard: { mouth, d: sd, tip: add(mouth, mul(sd, SWORD.blade + 4)) },
    cloakA: T(-12, 60),
    cloakB: T(6, 58),
    spine: [H, N],
  };
}

/* ------------------------------------------------------------------ drawing */

const C = {
  steel: "#1f2125",
  steelHi: "#2b2e34",
  far: "#0d0e10",
  farHi: "#16171a",
  mail: "#151619",
  leather: "#140f0d",
  edge: "rgba(170,176,186,0.26)",
  edgeSoft: "rgba(170,176,186,0.10)",
  blade: "#c3c8cf",
};

export function draw(ctx, sk, view, opts = {}) {
  const s = view.s;
  const P = (q) => [view.ox + q[0] * s, view.gy - q[1] * s];
  const poly = (pts, fill, stroke, lw = 1) => {
    ctx.beginPath();
    pts.forEach((q, i) => { const r = P(q); if (i) ctx.lineTo(r[0], r[1]); else ctx.moveTo(r[0], r[1]); });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  const limb = (a, b, ra, rb, fill, stroke) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    poly([[a[0] + nx * ra, a[1] + ny * ra], [b[0] + nx * rb, b[1] + ny * rb], [b[0] - nx * rb, b[1] - ny * rb], [a[0] - nx * ra, a[1] - ny * ra]], fill, stroke, Math.max(0.6, s * 0.5));
    circle(a, ra, fill); circle(b, rb, fill);
  };
  const circle = (c, r, fill, stroke) => {
    const q = P(c);
    ctx.beginPath(); ctx.arc(q[0], q[1], r * s, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(0.6, s * 0.45); ctx.stroke(); }
  };
  const line = (a, b, color, w) => {
    const p = P(a), q = P(b);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    ctx.strokeStyle = color; ctx.lineWidth = w * s; ctx.lineCap = "round"; ctx.stroke();
  };
  const sabaton = (g, fill, stroke) => {
    poly([[g[0] - 5, g[1]], [g[0] + 14, g[1]], [g[0] + 11, g[1] + 3.5], [g[0] + 4, g[1] + 6.5], [g[0] - 4, g[1] + 7.5]], fill, stroke, Math.max(0.6, s * 0.45));
  };
  const gauntlet = (arm, fill, stroke) => {
    const f = [arm.hand[0] - arm.elbow[0], arm.hand[1] - arm.elbow[1]];
    const L = Math.hypot(f[0], f[1]) || 1;
    const a = [f[0] / L, f[1] / L], n = [-a[1], a[0]];
    const h = arm.hand;
    poly([
      [h[0] - a[0] * 4 + n[0] * 4.6, h[1] - a[1] * 4 + n[1] * 4.6],
      [h[0] + a[0] * 4.5 + n[0] * 4, h[1] + a[1] * 4.5 + n[1] * 4],
      [h[0] + a[0] * 5.5 - n[0] * 3.6, h[1] + a[1] * 5.5 - n[1] * 3.6],
      [h[0] - a[0] * 4 - n[0] * 4.6, h[1] - a[1] * 4 - n[1] * 4.6],
    ], fill, stroke, Math.max(0.6, s * 0.45));
  };

  // 1. far limbs (in shadow)
  const aF = sk.armF, lF = sk.legF;
  limb(aF.sh, aF.elbow, 6.2, 5.4, C.far);
  limb(aF.elbow, aF.hand, 5.4, 4.6, C.far);
  gauntlet(aF, C.farHi);
  limb(lF.hip, lF.knee, 8.6, 7, C.far);
  limb(lF.knee, lF.ankle, 6.6, 5.2, C.far);
  circle(lF.knee, 6, C.farHi);
  sabaton(lF.ground, C.farHi);

  // 2. cloak behind the body
  if (opts.drawCloak) opts.drawCloak();

  // 3. torso: chainmail skirt, breastplate, belt
  const T = (a, b) => sk.T(a * 1.2, b);
  poly([T(-13, 7), T(11, 7), T(14, -13), T(4, -16), T(-8, -15), T(-15, -10)], C.mail, C.edgeSoft, Math.max(0.6, s * 0.4));
  // dark surcoat skirt with a ragged hem
  poly([T(-13, 6), T(12, 6), T(15, -22), T(10, -29), T(5, -24), T(0, -31), T(-5, -25), T(-10, -30), T(-15, -21)], "#1a0a0d", "rgba(181,18,37,0.18)", Math.max(0.6, s * 0.4));
  poly([T(-11, 4), T(-12, 24), T(-11, 46), T(-8, 58), T(-2, 63), T(6, 62), T(12, 55), T(15, 42), T(14, 28), T(10, 14), T(9, 4)], C.steel, C.edge, Math.max(0.7, s * 0.55));
  // lames and a central highlight on the breastplate
  line(T(10.5, 16), T(-10.5, 15), "rgba(170,176,186,0.10)", 0.9);
  line(T(12.5, 24), T(-11.5, 23), "rgba(170,176,186,0.08)", 0.9);
  line(T(13.5, 44), T(9, 30), "rgba(200,206,214,0.16)", 1.4);
  poly([T(-12, 3.5), T(10, 3.5), T(10.5, 8), T(-12, 8)], C.leather, null);
  circle(T(6, 5.8), 1.6, "#3a3d44");

  // 4. near leg + tasset
  const lN = sk.legN;
  limb(lN.hip, lN.knee, 9, 7.2, C.steel, C.edgeSoft);
  limb(lN.knee, lN.ankle, 6.8, 5.4, C.steel, C.edgeSoft);
  circle(lN.knee, 6.2, C.steelHi, C.edge);
  sabaton(lN.ground, C.steelHi, C.edge);
  poly([T(-2, 7), T(12, 7), T(14, -9), T(3, -11)], C.steelHi, C.edge, Math.max(0.6, s * 0.45));

  // 5. scabbard (in front of the hip; hides the part of the blade that is inside it)
  const sc = sk.scabbard;
  limb(sc.mouth, sc.tip, 2.9, 2.2, "#110d0c", "rgba(170,176,186,0.12)");
  limb(sc.mouth, add(sc.mouth, mul(sc.d, 6)), 3.4, 3.2, "#3a3d44");
  limb(add(sc.tip, mul(sc.d, -7)), sc.tip, 2.6, 1.6, "#3a3d44");

  // 6. gorget + helmet
  const Hd = (a, b) => sk.Hd(a * 1.18, b * 1.18);
  poly([T(-8, 57), T(-6, 66), T(7, 66), T(9, 57)], C.steelHi, C.edgeSoft, Math.max(0.6, s * 0.4));
  poly([Hd(-10, -9), Hd(-11.5, 3), Hd(-9.5, 11.5), Hd(-3, 15), Hd(4, 14.2), Hd(9, 10), Hd(11.2, 3.2), Hd(11.8, -6), Hd(8, -10.5), Hd(-2, -11.5)], C.steel, C.edge, Math.max(0.7, s * 0.55));
  poly([Hd(-6, 15.4), Hd(3, 15.4), Hd(2, 17.8), Hd(-5, 17.6)], C.steelHi, C.edgeSoft, Math.max(0.5, s * 0.35)); // crest
  line(Hd(2.5, 2.6), Hd(11.6, 2.6), "#020202", 1.9); // eye slit
  line(Hd(4, 2.6), Hd(10.8, 2.6), `rgba(255,100,45,${0.35 + 0.25 * (opts.eye || 0)})`, 0.55);
  for (const q of [[7.6, -3.5], [9.6, -3.4], [7.6, -6.4], [9.6, -6.3]]) circle(Hd(q[0], q[1]), 0.55, "#050505");
  line(Hd(-9, -2), Hd(-3, 13), "rgba(200,206,214,0.12)", 1.1);

  // 7. near arm, sword, gauntlet
  const aN = sk.armN;
  limb(aN.sh, aN.elbow, 6.4, 5.6, C.steel, C.edgeSoft);
  limb(aN.elbow, aN.hand, 5.6, 4.8, C.steel, C.edgeSoft);
  circle(aN.elbow, 5.4, C.steelHi, C.edge);
  // layered pauldron over the shoulder
  poly([T(-9, 49), T(-7, 60), T(3, 64.5), T(12, 60), T(14, 49), T(9, 42), T(-2, 43)], C.steelHi, C.edge, Math.max(0.7, s * 0.5));
  poly([T(-7, 44), T(10, 40), T(11.5, 35), T(-5, 38.5)], C.steel, C.edgeSoft, Math.max(0.5, s * 0.4));
  line(T(-6, 55), T(9, 59), "rgba(200,206,214,0.14)", 1.1);

  drawSword(ctx, sk.sword, P, s);
  gauntlet(aN, C.steelHi, C.edge);
}

function drawSword(ctx, sw, P, s) {
  const { G, bd, visible, glow } = sw;
  const n = [-bd[1], bd[0]];
  const at = (k, w) => [G[0] + bd[0] * k + n[0] * w, G[1] + bd[1] * k + n[1] * w];
  const path = (pts) => {
    ctx.beginPath();
    pts.forEach((q, i) => { const r = P(q); if (i) ctx.lineTo(r[0], r[1]); else ctx.moveTo(r[0], r[1]); });
    ctx.closePath();
  };
  // grip, pommel, guard
  path([at(0, 1.4), at(-14, 1.2), at(-14, -1.2), at(0, -1.4)]);
  ctx.fillStyle = "#1a1310"; ctx.fill();
  const pm = P(at(-15.8, 0));
  ctx.beginPath(); ctx.arc(pm[0], pm[1], 2.3 * s, 0, TAU); ctx.fillStyle = "#4a4e56"; ctx.fill();
  path([at(-1.2, 8.5), at(1.2, 8), at(1.2, -8), at(-1.2, -8.5)]);
  ctx.fillStyle = "#5a5f68"; ctx.fill();
  if (visible <= 0.5) return;

  const L = visible;
  const full = L >= SWORD.blade - 0.5;
  const pts = full
    ? [at(1, 2.3), at(L - 9, 1.9), at(L, 0), at(L - 9, -1.9), at(1, -2.3)]
    : [at(1, 2.3), at(L, 2.0), at(L, -2.0), at(1, -2.3)];
  path(pts);
  const a = P(G), b = P(at(L, 0));
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, "#8d939c"); g.addColorStop(0.5, C.blade); g.addColorStop(1, "#9aa0a8");
  ctx.fillStyle = g; ctx.fill();
  // fuller
  const f0 = P(at(3, 0)), f1 = P(at(Math.max(4, L - 16), 0));
  ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]);
  ctx.strokeStyle = "rgba(40,44,50,0.55)"; ctx.lineWidth = 0.9 * s; ctx.stroke();

  if (glow > 0.01) {
    // heated cutting edge + faint halo; the steel stays readable underneath
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = "rgba(181,18,37,0.9)";
    ctx.shadowBlur = 9 * s * glow;
    const e0 = P(at(2, 1.7)), e1 = P(full ? at(L - 1, 0.3) : at(L, 1.7));
    const gg = ctx.createLinearGradient(e0[0], e0[1], e1[0], e1[1]);
    gg.addColorStop(0, `rgba(255,100,45,${0.25 * glow})`);
    gg.addColorStop(0.5, `rgba(214,36,48,${0.7 * glow})`);
    gg.addColorStop(1, `rgba(255,205,190,${0.85 * glow})`);
    ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]);
    ctx.strokeStyle = gg; ctx.lineWidth = 1.3 * s; ctx.lineCap = "round"; ctx.stroke();
    path(pts);
    ctx.fillStyle = `rgba(181,18,37,${0.12 * glow})`; ctx.fill();
    ctx.restore();
  }
}

// Sample points on the body, used to shed glyph particles while materialising.
export function bodyPoints(sk) {
  return [sk.headC, sk.N, sk.T(0, 30), sk.H, sk.armN.elbow, sk.armN.hand, sk.armF.elbow,
    sk.legN.knee, sk.legN.ankle, sk.legF.knee, sk.legF.ankle, sk.T(-10, 45), sk.T(10, 20)];
}

export function bounds(sk, extra = []) {
  const pts = [sk.headC, sk.armN.hand, sk.armF.hand, sk.legN.ground, sk.legF.ground, sk.sword.tip, sk.scabbard.tip, sk.H, ...extra];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  return { x0: x0 - 22, x1: x1 + 22, y0: Math.min(0, y0) - 8, y1: y1 + 26 };
}
