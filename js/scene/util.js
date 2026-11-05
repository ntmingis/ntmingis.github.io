// Small math helpers shared by the scene modules. No dependencies.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const ease = {
  linear: (t) => t,
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  // slow start, violent middle, soft landing: used for the actual sword strike
  strike: (t) => (t < 0.7 ? Math.pow(t / 0.7, 2.2) * 0.85 : 0.85 + 0.15 * (1 - Math.pow(1 - (t - 0.7) / 0.3, 2))),
};

// Deterministic PRNG (mulberry32): the same seed gives the same scene every cycle.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash -> [0, 1). Stateless, so glyph choice depends only on (column, row, time bucket).
export function hash3(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth 1D value noise in [-1, 1], deterministic.
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash3(i, seed, 17) * 2 - 1;
  const b = hash3(i + 1, seed, 17) * 2 - 1;
  return a + (b - a) * u;
}

export const dir = (ang) => [Math.cos(ang), Math.sin(ang)];
export const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
export const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
export const mul = (p, k) => [p[0] * k, p[1] * k];
export const len = (p) => Math.hypot(p[0], p[1]);

// Two-bone inverse kinematics in a y-up world.
// bend = +1 puts the middle joint counter-clockwise of the root->target line.
export function ik(root, target, a, b, bend) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const base = Math.atan2(dy, dx);
  const off = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const ang = base + bend * off;
  const joint = [root[0] + a * Math.cos(ang), root[1] + a * Math.sin(ang)];
  const end = [root[0] + d * Math.cos(base), root[1] + d * Math.sin(base)];
  return { joint, end };
}
