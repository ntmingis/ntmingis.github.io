// Hero scene bootstrap: canvas sizing, fixed-step simulation, render loop,
// quality tiers, pause/visibility handling, reduced motion and cleanup.

import { sample, CYCLE, WORLD, stateAt } from "./timeline.js";
import { solve, draw as drawKnight, bodyPoints, bounds } from "./knight.js";
import { Cloak } from "./cloak.js";
import { Matrix } from "./matrix.js";
import { Effects, toS } from "./fx.js";
import { rng, noise1, clamp, lerp, TAU } from "./util.js";
import MANIFEST from "./video-manifest.js";
import { mountVideoScene } from "./video.js";

const STEP = 1 / 60;
const IDLE_T = 24.5; // frame used for the static / reduced-motion picture

export function mountScene(host, { textEl, stateEl, toggleEl } = {}) {
  const canvas = host.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  const layer = document.createElement("canvas");
  const lctx = layer.getContext("2d");
  const bg = document.createElement("canvas");
  const bctx = bg.getContext("2d");

  const matrix = new Matrix();
  const cloak = new Cloak();
  const fx = new Effects();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  let w = 0, h = 0, dpr = 1, tier = 2, view = null, textBox = null;
  let simT = 0, acc = 0, last = 0, raf = 0;
  let playing = false, visible = true, userPaused = false, destroyed = false;
  let smp = null, sk = null, prevTip = null, burstCool = 0, prevPhase = null, prevTc = 0;
  let workAvg = 0, workN = 0;
  let shedR = rng(0x91);
  const listeners = [];

  function initialTier() {
    let t = w >= 1100 ? 2 : w >= 700 ? 1 : 0;
    if ((navigator.hardwareConcurrency || 8) <= 4) t = Math.min(t, 1);
    return t;
  }

  function layout() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    if (!view) tier = initialTier();
    // cap the device-pixel budget: tiny glyphs do not need full retina resolution
    const budget = [0.9e6, 1.6e6, 2.6e6][tier];
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(budget / (w * h))));
    for (const c of [canvas, layer, bg]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }

    textBox = null;
    if (textEl) {
      const t = textEl.getBoundingClientRect();
      textBox = { x: t.left - r.left, y: t.top - r.top, w: t.width, h: t.height };
    }
    let x0, x1, gy, s;
    if (w >= 900) {
      x0 = Math.max(w * 0.36, textBox ? textBox.x + textBox.w - 40 : 0);
      x1 = w - 16;
      gy = Math.round(h * 0.86);
      s = Math.min((x1 - x0) / WORLD.width, (h * 0.5) / 190);
    } else {
      const top = textBox ? textBox.y + textBox.h + 8 : h * 0.45;
      x0 = 8; x1 = w - 8;
      gy = h - Math.max(52, h * 0.08); // leave the strip under the ground for the scene controls
      s = Math.min((x1 - x0) / WORLD.width, Math.max(40, gy - top) / 200);
    }
    const ox = x0 + ((x1 - x0) - WORLD.width * s) / 2;
    view = { ox, gy, s, world: WORLD };
    matrix.resize(w, h, dpr, tier);
    paintBackground();
    if (!playing) renderFrame();
  }

  function paintBackground() {
    const g = bctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#050505";
    g.fillRect(0, 0, w, h);
    let gr = g.createLinearGradient(0, 0, 0, view.gy);
    gr.addColorStop(0, "rgba(8,14,11,0.9)");
    gr.addColorStop(1, "rgba(5,5,5,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, view.gy);
    // ground
    gr = g.createLinearGradient(0, view.gy, 0, h);
    gr.addColorStop(0, "#0b0a0a"); gr.addColorStop(1, "#030303");
    g.fillStyle = gr; g.fillRect(0, view.gy, w, h - view.gy);
    g.fillStyle = "rgba(170,176,186,0.06)"; g.fillRect(0, view.gy, w, 1);
    const R = rng(0x57);
    for (let i = 0; i < 26; i++) { // stones
      const x = R() * w, y = view.gy + 2 + R() * (h - view.gy) * 0.8;
      const rx = (2 + R() * 7) * view.s * (0.6 + (y - view.gy) / (h - view.gy + 1));
      g.beginPath(); g.ellipse(x, y, rx, rx * 0.45, 0, 0, TAU);
      g.fillStyle = `rgba(${18 + R() * 8},${17 + R() * 6},${16 + R() * 6},1)`; g.fill();
    }
    for (let i = 0; i < 220; i++) { // ash
      g.fillStyle = `rgba(150,146,140,${0.05 + R() * 0.12})`;
      g.fillRect(R() * w, view.gy + R() * (h - view.gy), 1, 1);
    }
    // vignette
    gr = g.createRadialGradient(w * 0.62, h * 0.55, Math.min(w, h) * 0.2, w * 0.62, h * 0.55, Math.max(w, h) * 0.85);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.7)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }

  /* ------------------------------------------------------- simulation */

  function resetCycle() {
    cloak.ready = false;
    prevTip = null; prevPhase = null; burstCool = 0;
    fx.trail.length = 0;
    shedR = rng(0x91);
  }

  function simStep(hh) {
    simT += hh;
    const tc = simT % CYCLE;
    if (tc < prevTc) resetCycle();
    prevTc = tc;
    smp = sample(tc);
    sk = solve(smp);
    if (!cloak.ready) cloak.reset(sk);
    cloak.step(sk, hh, simT, WORLD);
    fx.step(hh, simT, WORLD, tier);

    // footsteps: a foot lands when its phase wraps to 0 (near) or crosses 0.5 (far)
    const ph = smp.gait;
    if (ph !== null && prevPhase !== null && smp.gaitW > 0.5 && smp.alpha > 0.3) {
      if (ph < prevPhase) fx.footstep(sk.legN.ground[0]);
      if (prevPhase < 0.5 && ph >= 0.5) fx.footstep(sk.legF.ground[0]);
    }
    prevPhase = ph;

    // sword trail and slash burst from blade tip speed
    const sw = sk.sword;
    burstCool = Math.max(0, burstCool - hh);
    if (sw.held && sw.visible > 60 && prevTip) {
      const vel = [(sw.tip[0] - prevTip[0]) / hh, (sw.tip[1] - prevTip[1]) / hh];
      const sp = Math.hypot(vel[0], vel[1]);
      if (sp > 140) fx.pushTrail(simT, sw.G, sw.tip);
      if (sp > 520 && burstCool === 0) { fx.slash(sw.G, sw.tip, vel); burstCool = 0.12; }
    }
    prevTip = sw.tip.slice();

    // digital glyphs shed while the knight materialises / dissolves
    let shed = 0;
    if (tc < 3.4) shed = 1 - tc / 3.4;
    else if (tc > 28.4) shed = clamp((tc - 28.4) / 1.2, 0, 1);
    if (shed > 0 && shedR() < shed * [0.25, 0.45, 0.7][tier]) {
      const pts = bodyPoints(sk);
      const q = pts[Math.floor(shedR() * pts.length)];
      fx.shedGlyph(q[0], q[1], shed);
    }
  }

  function seek(t) {
    simT = 0; prevTc = 0; acc = 0;
    fx.clear(); resetCycle();
    const n = Math.round(t / STEP);
    for (let i = 0; i < n; i++) simStep(STEP);
  }

  /* ----------------------------------------------------------- render */

  function renderFrame() {
    if (!sk) { smp = sample(simT % CYCLE); sk = solve(smp); if (!cloak.ready) cloak.reset(sk); }
    const s = view.s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const flick = 0.82 + 0.12 * noise1(simT * 5.3, 21) + 0.06 * Math.sin(simT * 17);
    const b = bounds(sk, cloak.extent());
    const bx = view.ox + b.x0 * s, by = view.gy - b.y1 * s, bw = (b.x1 - b.x0) * s, bh = (b.y1 - b.y0) * s;

    // matrix rain with separation behind the knight, the fire and the hero text
    const masks = [
      { x: bx + bw / 2, y: by + bh / 2, rx: bw / 2 + 40, ry: bh / 2 + 40, k: lerp(1, 0.14, smp.alpha) },
      { x: view.ox + WORLD.fireX * s, y: view.gy - 34 * s, rx: 90 * s, ry: 80 * s, k: 0.3 },
    ];
    if (textBox) masks.push({ x: textBox.x + textBox.w / 2, y: textBox.y + textBox.h / 2, rx: textBox.w * 0.62, ry: textBox.h * 0.62, k: 0.4 });
    // the matrix canvas already contains the static background: one full-size blit per frame
    const m = matrix.render(simT, masks, view.gy, !playing, bg);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(m, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    fx.drawFireLight(ctx, view, simT, flick);
    drawRock(ctx, flick);
    fx.drawSmoke(ctx, view);

    // knight + cloak on their own layer so light and fades apply to the whole figure
    if (smp.alpha > 0.002) {
      const pad = 4;
      const cx0 = Math.max(0, Math.floor((bx - pad) * dpr)), cy0 = Math.max(0, Math.floor((by - pad) * dpr));
      const cw = Math.min(layer.width - cx0, Math.ceil((bw + pad * 2) * dpr)), ch = Math.min(layer.height - cy0, Math.ceil((bh + pad * 2) * dpr));
      if (cw > 0 && ch > 0) {
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.clearRect(cx0, cy0, cw, ch);
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const fireDist = Math.abs(WORLD.fireX - sk.H[0]);
        const light = clamp(1.15 - fireDist / 220, 0.15, 1) * flick;
        drawKnight(lctx, sk, view, {
          eye: 0.5 + 0.5 * Math.sin(simT * 0.9),
          drawCloak: () => cloak.draw(lctx, view, light),
        });
        // fire light wraps the side of the figure that faces the camp
        lctx.save();
        lctx.globalCompositeOperation = "source-atop";
        const [fxp, fyp] = toS(view, [WORLD.fireX, 14]);
        let g = lctx.createRadialGradient(fxp, fyp, 0, fxp, fyp, 240 * s);
        g.addColorStop(0, `rgba(255,110,50,${0.22 * light})`);
        g.addColorStop(0.5, `rgba(255,90,40,${0.07 * light})`);
        g.addColorStop(1, "rgba(255,90,40,0)");
        lctx.fillStyle = g;
        lctx.fillRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
        if (sk.sword.glow > 0.02 && sk.sword.visible > 10) {
          const mid = toS(view, [(sk.sword.G[0] + sk.sword.tip[0]) / 2, (sk.sword.G[1] + sk.sword.tip[1]) / 2]);
          g = lctx.createRadialGradient(mid[0], mid[1], 0, mid[0], mid[1], 90 * s);
          g.addColorStop(0, `rgba(181,18,37,${0.32 * sk.sword.glow})`);
          g.addColorStop(1, "rgba(181,18,37,0)");
          lctx.fillStyle = g;
          lctx.fillRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
        }
        // emerging from darkness: the figure is shadowed before it is fully present
        if (smp.alpha < 1) {
          lctx.fillStyle = `rgba(5,5,5,${0.6 * (1 - smp.alpha)})`;
          lctx.fillRect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
        }
        lctx.restore();
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = smp.alpha;
        ctx.drawImage(layer, cx0, cy0, cw, ch, cx0, cy0, cw, ch);
        ctx.restore();
      }
    }

    fx.drawTrail(ctx, view, simT);
    fx.drawFire(ctx, view, simT);
    fx.drawParticles(ctx, view);
    fx.drawGlyphs(ctx, view);

    // low mist over the ground line
    const gr = ctx.createLinearGradient(0, view.gy - 26 * s, 0, h);
    gr.addColorStop(0, "rgba(5,5,5,0)");
    gr.addColorStop(0.35, "rgba(5,5,5,0.35)");
    gr.addColorStop(1, "rgba(5,5,5,0.85)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, view.gy - 26 * s, w, h - view.gy + 26 * s);

    const st = stateAt(simT % CYCLE);
    if (stateEl && stateEl.dataset.state !== st) { stateEl.dataset.state = st; stateEl.textContent = st; }
  }

  function drawRock(c, flick) {
    const s = view.s;
    const [x, y] = toS(view, [WORLD.rockX, 0]);
    const r = WORLD.rockR * s;
    c.beginPath();
    c.moveTo(x - r * 1.25, y);
    c.quadraticCurveTo(x - r * 1.2, y - r * 1.55, x - r * 0.1, y - r * 1.75);
    c.quadraticCurveTo(x + r * 1.05, y - r * 1.6, x + r * 1.3, y);
    c.closePath();
    const g = c.createLinearGradient(x - r, 0, x + r * 1.3, 0);
    g.addColorStop(0, "#0c0c0c");
    g.addColorStop(1, `rgba(${46 + 30 * flick},${24 + 10 * flick},${18},1)`);
    c.fillStyle = g;
    c.fill();
  }

  /* ------------------------------------------------------------- loop */

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const t0 = performance.now();
    acc += dt;
    while (acc >= STEP) { simStep(STEP); acc -= STEP; }
    renderFrame();
    const work = performance.now() - t0;
    workAvg += work; workN++;
    if (workN === 45) { // ~0.75 s at 60 fps: step quality down quickly on slow devices
      const avg = workAvg / workN;
      workAvg = 0; workN = 0;
      if (avg > 13 && tier > 0) { tier--; layout(); }
    }
  }

  function updateRunning() {
    const should = !destroyed && visible && !userPaused && !reduce.matches && !document.hidden;
    if (should && !playing) { playing = true; last = 0; raf = requestAnimationFrame(frame); }
    else if (!should && playing) { playing = false; cancelAnimationFrame(raf); raf = 0; }
    if (toggleEl) {
      toggleEl.hidden = reduce.matches;
      toggleEl.setAttribute("aria-pressed", String(userPaused));
      toggleEl.textContent = userPaused ? "Play scene" : "Pause scene";
    }
  }

  const on = (target, ev, fn, o) => { target.addEventListener(ev, fn, o); listeners.push(() => target.removeEventListener(ev, fn, o)); };

  let pending = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => layout());
  });
  ro.observe(host);
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; updateRunning(); });
  io.observe(host);
  on(document, "visibilitychange", updateRunning);
  on(reduce, "change", () => { if (reduce.matches) { seek(IDLE_T); renderFrame(); } updateRunning(); });
  if (toggleEl) on(toggleEl, "click", () => { userPaused = !userPaused; updateRunning(); });

  // Freeze frame for screenshots / static fallback: ?scene=<seconds>
  const frozen = new URLSearchParams(location.search).get("scene");
  layout();
  if (frozen !== null && !Number.isNaN(parseFloat(frozen))) {
    seek(parseFloat(frozen)); userPaused = true;
  } else if (reduce.matches) {
    seek(IDLE_T);
  }
  renderFrame();
  host.classList.add("is-live");
  updateRunning();

  const api = {
    get state() { return stateAt(simT % CYCLE); },
    get time() { return simT; },
    get tier() { return tier; },
    get glyphs() { return matrix.count || 0; },
    get running() { return playing; },
    seek(t) { seek(t); renderFrame(); },
    pause() { userPaused = true; updateRunning(); },
    play() { userPaused = false; updateRunning(); },
    destroy() {
      destroyed = true;
      updateRunning();
      cancelAnimationFrame(pending);
      ro.disconnect(); io.disconnect();
      listeners.forEach((off) => off());
      fx.clear();
      for (const c of [layer, bg, matrix.canvas]) { c.width = 0; c.height = 0; }
      host.classList.remove("is-live");
    },
  };
  return api;
}

// Auto-mount. A hero film (tools/prepare_video.py) takes precedence over the
// procedural scene. Any failure leaves the static poster in place.
const host = document.querySelector("[data-scene]");
if (host && "ResizeObserver" in window && "IntersectionObserver" in window) {
  try {
    const mount = MANIFEST ? (h, o) => mountVideoScene(h, MANIFEST, o) : mountScene;
    const api = mount(host, {
      textEl: document.querySelector("[data-hero-text]"),
      stateEl: document.querySelector("[data-scene-state]"),
      toggleEl: document.querySelector("[data-scene-toggle]"),
    });
    if (api && new URLSearchParams(location.search).has("scene-debug")) window.__scene = api;
    window.addEventListener("pagehide", (e) => { if (!e.persisted && api) api.destroy(); });
  } catch (err) {
    host.classList.remove("is-live");
    console.warn("hero scene disabled:", err);
  }
}
