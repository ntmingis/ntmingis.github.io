// Deterministic choreography for the knight.
//
// The cycle is a fixed list of keyframed poses plus two walk segments.
// sample(t) returns the state name, the blended pose and the root position;
// it never uses randomness, so the same time always produces the same pose.
//
// Pose channels (world units, y up, relative to the hip unless noted):
//   hx, hy      hip offset from the root / hip height above ground
//   torso       lean, radians (+ = forward, toward the fire)
//   head        head pitch, radians (+ = looking down/forward)
//   rh, lh      near (sword) hand / far hand targets, relative to hip
//   ff, bf      near / far foot targets, relative to root on the ground
//   sw          blade angle in world space (unwrapped so lerps turn the right way)
//   scab        scabbard angle in world space
//   held        1 = sword in hand, 0 = in scabbard (step, switched only when hand == grip)
//   glow        blade glow 0..1

import { ease, lerp, clamp, TAU } from "./util.js";

export const STATES = [
  ["arrival", 0],
  ["sword_draw", 4.9],
  ["sword_swing", 7.6],
  ["sheathing", 11.9],
  ["walk_to_fire", 14.7],
  ["sitting", 19.6],
  ["idle", 21.8],
];
export const CYCLE = 30;
export const FADE_OUT = [28.6, 30];

// Walk: slow, heavy gait. Cycle 2.0 s, stride 24 → speed 2S/T = 24 u/s.
// Each walk is exactly two cycles, so both feet are on the ground when it ends.
export const GAIT = { T: 2.0, S: 24 };
const V = (2 * GAIT.S) / GAIT.T;
const W1 = [0, 4.0];
const W2 = [14.9, 18.9];
export const WALKS = [
  { t0: W1[0], t1: W1[1] },
  { t0: W2[0], t1: W2[1] },
];
export const WORLD = {
  width: 340,
  startX: 34,
  standX: 34 + V * 4, // 130
  sitStandX: 34 + V * 8, // 226
  rockX: 212,
  rockR: 21,
  fireX: 298,
};

// Sword geometry shared with knight.js.
export const SWORD = { blade: 80, grip: 7 };
export const MOUTH = [10, -2]; // scabbard mouth, relative to hip
const hiltDir = (scab) => [Math.cos(scab - Math.PI), Math.sin(scab - Math.PI)];
const gripAt = (scab, pull) => {
  const h = hiltDir(scab);
  return [MOUTH[0] + h[0] * (SWORD.grip + pull), MOUTH[1] + h[1] * (SWORD.grip + pull)];
};

const SCAB = 4.14; // blade direction while sheathed: back and down
const SCAB_SIT = 3.62; // tip resting on the ground behind the rock while seated
const GRIP = gripAt(SCAB, 0);
const PULLED = gripAt(SCAB, SWORD.blade);
const GUARD_SW = 1.1 + TAU; // forward-up, unwrapped

const STAND = {
  hx: 0, hy: 89, torso: 0.04, head: 0.02,
  rh: [8, 4], lh: [2, 6], ff: [11, 0], bf: [-9, 0],
  sw: SCAB, scab: SCAB, held: 0, glow: 0,
};

// [time, overrides, easing into this key]
const KEYS = [
  [0, {}, "linear"],
  [W1[1], {}, "linear"],
  [4.9, {}, "inOutSine"],
  // ── sword_draw ───────────────────────────────────────────────
  [5.6, { rh: GRIP, lh: [10, -1], torso: 0.09, head: 0.16, sw: SCAB }, "inOutCubic"],
  [5.82, { held: 1 }, "linear"], // grip, short pause
  [6.2, { rh: PULLED, torso: -0.03, head: 0.02, glow: 0.55 }, "outQuart"], // decisive pull
  [6.95, { rh: [36, 40], sw: GUARD_SW, torso: 0.06, lh: [4, 14], glow: 1, ff: [14, 0], bf: [-11, 0] }, "inOutCubic"],
  [7.6, { hy: 88 }, "inOutSine"], // beat before acting
  // ── sword_swing: overhead diagonal cut ─────────────────────────
  [8.4, { rh: [8, 92], sw: 2.3 + TAU, torso: -0.15, hy: 86, ff: [16, 0], bf: [-14, 0], lh: [-22, 30], head: -0.05 }, "inOutSine"],
  [8.68, { rh: [52, 30], sw: -0.5 + TAU, torso: 0.28, hy: 80, ff: [26, 0], bf: [-16, 0], lh: [-6, 18], head: 0.15 }, "strike"],
  [8.9, { rh: [40, 12], sw: 5.2, torso: 0.32, hy: 79 }, "outCubic"],
  [9.6, { rh: [34, 38], sw: GUARD_SW, torso: 0.08, hy: 87, ff: [16, 0], bf: [-12, 0], lh: [4, 14], head: 0.05 }, "inOutCubic"],
  // ── sword_swing: rising cut ──────────────────────────────────
  [10.25, { rh: [-6, 18], sw: 3.7 + TAU, torso: -0.05, hy: 84, lh: [18, 40] }, "inOutSine"],
  [10.52, { rh: [50, 58], sw: 0.7 + 2 * TAU, torso: 0.2, ff: [24, 0], lh: [-10, 24] }, "strike"],
  [10.75, { rh: [44, 74], sw: 13.6, torso: 0.12 }, "outCubic"],
  [11.5, { rh: [36, 40], sw: GUARD_SW + TAU, torso: 0.06, hy: 89, ff: [11, 0], bf: [-9, 0], lh: [4, 14], head: 0.02 }, "inOutCubic"],
  [11.9, { glow: 0.85 }, "inOutSine"],
  // ── sheathing ───────────────────────────────────────────────
  [12.5, { rh: [30, 22], sw: 12.0, glow: 0.6, torso: 0.05, head: 0.1 }, "inOutSine"],
  [13.2, { rh: PULLED, sw: SCAB + TAU, torso: -0.02, head: 0.26, lh: [10, -1], glow: 0.3 }, "inOutCubic"],
  [13.45, {}, "linear"],
  [13.95, { rh: GRIP, glow: 0, torso: 0.07 }, "inOutQuad"],
  [13.96, { held: 0 }, "linear"], // blade fully home: the scabbard now owns the sword
  [14.0, { sw: SCAB }, "linear"], // rewind the unwrapped angle while it is unused
  [14.4, { rh: [8, 4], lh: [2, 6], torso: 0.04, head: 0.04 }, "inOutCubic"],
  [14.7, {}, "linear"],
  // ── walk_to_fire (gait overlay) ─────────────────────────────
  [W2[1], { head: 0.06 }, "linear"],
  [19.6, {}, "inOutSine"],
  // ── sitting ──────────────────────────────────────────────
  [19.95, { torso: 0.16, ff: [17, 7] }, "inOutSine"],
  [20.3, { torso: 0.3, hy: 82, hx: -2, ff: [24, 0], rh: [20, 10], lh: [16, 12] }, "inOutSine"],
  [21.2, { torso: 0.2, hy: 40, hx: -12, ff: [26, 0], bf: [17, 0], rh: [44, 10], lh: [40, 9], scab: SCAB_SIT, sw: SCAB_SIT, head: 0.1 }, "inOutCubic"],
  [21.8, { torso: 0.21, head: 0.14 }, "outSine"],
  [CYCLE, {}, "linear"],
];

// Expand overrides into full poses once.
const FULL = [];
{
  let cur = clone(STAND);
  for (const [t, over, e] of KEYS) {
    cur = Object.assign(clone(cur), clone(over));
    FULL.push({ t, pose: cur, ease: ease[e] || ease.linear });
  }
}

function clone(o) {
  const r = {};
  for (const k in o) r[k] = Array.isArray(o[k]) ? o[k].slice() : o[k];
  return r;
}

function blend(a, b, u) {
  const r = {};
  for (const k in a) {
    if (k === "held") r[k] = a[k];
    else if (Array.isArray(a[k])) r[k] = [lerp(a[k][0], b[k][0], u), lerp(a[k][1], b[k][1], u)];
    else r[k] = lerp(a[k], b[k], u);
  }
  return r;
}

export function stateAt(t) {
  let name = STATES[0][0];
  for (const [n, s] of STATES) if (t >= s) name = n;
  return name;
}

export function rootXAt(t) {
  let x = WORLD.startX;
  for (const w of WALKS) x += V * clamp(t - w.t0, 0, w.t1 - w.t0);
  return x;
}

// Weight of the walking overlay at time t, with soft ramps at both ends of each walk.
function gaitWeight(t) {
  if (t < W1[1]) return 1;
  if (t < W1[1] + 0.45) return 1 - ease.inOutSine((t - W1[1]) / 0.45);
  if (t >= W2[0] && t < W2[1]) return ease.inOutSine(clamp((t - W2[0]) / 0.4, 0, 1));
  if (t >= W2[1] && t < W2[1] + 0.45) return 1 - ease.inOutSine((t - W2[1]) / 0.45);
  return 0;
}

// Foot offset (relative to hip x) for a foot with gait phase p in [0,1).
function footGait(p) {
  const S = GAIT.S / 2;
  if (p < 0.5) return [S - (p / 0.5) * 2 * S, 0]; // stance: planted, moves back relative to hip
  const q = (p - 0.5) / 0.5;
  return [-S + 2 * S * ease.inOutSine(q), 7 * Math.sin(Math.PI * q)];
}

export function gaitPhase(t) {
  let w = null;
  if (t < W1[1] + 0.45) w = W1;
  else if (t >= W2[0] && t < W2[1] + 0.45) w = W2;
  if (!w) return null;
  return ((Math.min(t, w[1]) - w[0]) / GAIT.T) % 1;
}

export function sample(t) {
  t = ((t % CYCLE) + CYCLE) % CYCLE;
  let i = 0;
  while (i < FULL.length - 2 && FULL[i + 1].t <= t) i++;
  const A = FULL[i], B = FULL[i + 1];
  const u = B.t > A.t ? B.ease(clamp((t - A.t) / (B.t - A.t), 0, 1)) : 1;
  const pose = blend(A.pose, B.pose, u);

  // Walk overlay: feet, hip bob, arm swing, slight forward lean.
  const w = gaitWeight(t);
  const ph = gaitPhase(t);
  if (w > 0 && ph !== null) {
    const fa = footGait(ph);
    const fb = footGait((ph + 0.5) % 1);
    pose.ff = [lerp(pose.ff[0], fa[0], w), lerp(pose.ff[1], fa[1], w)];
    pose.bf = [lerp(pose.bf[0], fb[0], w), lerp(pose.bf[1], fb[1], w)];
    pose.hy -= w * 2.8 * (0.5 + 0.5 * Math.cos(4 * Math.PI * ph));
    pose.torso += w * 0.05;
    const s = Math.sin(TAU * ph);
    pose.lh = [pose.lh[0] + w * 10 * s, pose.lh[1] + w * 2 * Math.abs(s)];
    pose.rh = [pose.rh[0] - w * 2.5 * s, pose.rh[1]];
    pose.head += w * 0.03 * Math.sin(4 * Math.PI * ph);
  }

  // Idle: slow breathing while seated.
  if (t >= 21.8) {
    const k = smoothIn(t - 21.8, 1.2);
    const b = Math.sin((TAU * (t - 21.8)) / 3.8);
    pose.torso += k * 0.018 * b;
    pose.hy += k * 0.5 * b;
    pose.head += k * (0.02 * Math.sin((TAU * (t - 21.8)) / 7.1) + 0.012 * b);
    pose.rh = [pose.rh[0], pose.rh[1] + k * 0.6 * b];
  }

  // Knight visibility: emerges from darkness, dissolves before the loop restarts.
  let alpha = 1;
  if (t < 2.4) alpha = ease.inOutSine(t / 2.4);
  if (t > FADE_OUT[0]) alpha = 1 - ease.inOutSine((t - FADE_OUT[0]) / (FADE_OUT[1] - FADE_OUT[0]));

  return { t, state: stateAt(t), pose, rootX: rootXAt(t), alpha, gait: ph, gaitW: w };
}

function smoothIn(x, d) { return ease.inOutSine(clamp(x / d, 0, 1)); }
