// Hero: a black cat drawn by the code rain inside a terminal window.
// It keeps Minh's hours (GMT+7): 12-22 study, 22-05 sleep, 05-12 awake; visitors can override it
// with the buttons or terminal commands. Canvas 2D, no libraries; all text output uses textContent.
(() => {
  "use strict";
  const stage = document.querySelector("[data-hero]");
  if (!stage) return;
  const device = document.getElementById("device");
  const screen = document.getElementById("screen");
  const cv = screen.querySelector("canvas");
  const ctx = cv.getContext("2d");
  const laser = stage.querySelector(".laser");
  const stateEl = document.getElementById("state");
  const glyphEl = document.getElementById("glyphs");
  const clockEl = document.getElementById("clock");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const CH = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function h3(a, b, c) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise(x, s) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const a = h3(i, s, 3) * 2 - 1, b = h3(i + 1, s, 3) * 2 - 1;
    return a + (b - a) * u;
  }

  /* ---------------- code rain inside the screen ---------------- */
  const LAYERS = [
    { size: 2.6, cell: 3.6, col: 4.6, speed: [9, 17], len: [10, 34], gap: [0.12, 1.0], alpha: 0.17, color: "#1f8a55", blur: 0.9 },
    { size: 3.8, cell: 5.2, col: 7.2, speed: [16, 30], len: [8, 26], gap: [0.25, 1.4], alpha: 0.24, color: "#2fbf79", blur: 0 },
    { size: 5.6, cell: 7.4, col: 13, speed: [26, 44], len: [5, 15], gap: [0.8, 2.6], alpha: 0.24, color: "#5fe39a", blur: 0.7 },
  ];
  const rain = document.createElement("canvas");
  const rctx = rain.getContext("2d");
  let atlases = [], streams = [], rainT = -1, glyphCount = 0;

  function atlas(L) {
    const pad = Math.ceil(L.blur * 2 + 1);
    const cw = Math.ceil((L.size * 0.75 + pad * 2) * dpr), ch = Math.ceil((L.size * 1.15 + pad * 2) * dpr);
    const c = document.createElement("canvas");
    c.width = cw * CH.length; c.height = ch;
    const g = c.getContext("2d");
    g.font = `${L.size * dpr}px ui-monospace, Consolas, "DejaVu Sans Mono", monospace`;
    g.textBaseline = "top"; g.fillStyle = L.color;
    for (let i = 0; i < CH.length; i++) {
      const x = i * cw + pad * dpr, y = pad * dpr;
      if (L.blur) {
        g.shadowColor = L.color; g.shadowBlur = L.blur * dpr * 1.6; g.shadowOffsetX = 10000;
        g.fillText(CH[i], x - 10000, y);
        g.shadowColor = "transparent"; g.globalAlpha = 0.55; g.fillText(CH[i], x, y); g.globalAlpha = 1;
      } else g.fillText(CH[i], x, y);
    }
    return { img: c, cw, ch, pad };
  }

  function buildRain() {
    atlases = LAYERS.map(atlas);
    const R = rng(0x6d61);
    streams = [];
    LAYERS.forEach((L, li) => {
      const rows = Math.ceil(H / L.cell), n = Math.ceil(W / L.col);
      for (let i = 0; i < n; i++) {
        const len = Math.round(L.len[0] + R() * (L.len[1] - L.len[0]));
        const gap = Math.round(rows * (L.gap[0] + R() * (L.gap[1] - L.gap[0])));
        streams.push({ li, i, x: i * L.col + (R() - 0.5) * L.col * 0.4, rows, len, period: rows + len + gap,
          speed: (L.speed[0] + R() * (L.speed[1] - L.speed[0])) / L.cell, off: R() * (rows + len + gap), rate: 0.3 + R() * 0.6 });
      }
    });
    rainT = -1;
  }

  function drawRain(t, force) {
    if (!force && rainT >= 0 && t - rainT < 1 / 24 && t >= rainT) return;
    rainT = t;
    rctx.setTransform(1, 0, 0, 1, 0, 0);
    rctx.clearRect(0, 0, rain.width, rain.height);
    let n = 0;
    for (const s of streams) {
      const L = LAYERS[s.li], A = atlases[s.li];
      const head = Math.floor((s.off + t * s.speed) % s.period) - s.len;
      for (let k = 0; k < s.len; k++) {
        const row = head + s.len - k;
        if (row < 0 || row >= s.rows) continue;
        const y = row * L.cell;
        let a = L.alpha * Math.pow(1 - k / s.len, 1.5);
        if (k === 0) a *= 1.35;
        if (h3(s.i * 3 + s.li, row, Math.floor(t * 1.4)) < 0.0035) a = Math.max(a, 0.5);
        a *= 1 - 0.93 * catCover(s.x, y); // the cat is a hole in the rain
        if (y < textBottom) a *= 0.25;    // keep the prompt and its output readable
        if (a < 0.012) continue;
        const gi = Math.floor(h3(s.i + s.li * 977, row, Math.floor(t * s.rate + h3(s.i, row, s.li) * 7)) * CH.length);
        rctx.globalAlpha = Math.min(0.6, a);
        rctx.drawImage(A.img, gi * A.cw, 0, A.cw, A.ch, (s.x - A.pad) * dpr, (y - A.pad) * dpr, A.cw, A.ch);
        n++;
      }
    }
    rctx.globalAlpha = 1;
    glyphCount = n;
  }

  /* ---------------- the cat: vector silhouette sampled onto a glyph grid ---------------- */
  // Cat space: units, origin between the front paws, y down.
  const BOX = { x0: -40, x1: 62, y0: -106, y1: 6 };
  const mask = document.createElement("canvas");
  const mctx = mask.getContext("2d", { willReadFrequently: true });
  let cell = 8, S = 3, catX = 0, catY = 0, gx0 = 0, gy0 = 0, gw = 0, gh = 0, cover = null, promptH = 30, textBottom = 30;
  const pose = { lie: 0, hx: 0, hy: 0, hr: 0, earL: 0, earR: 0, tail: 0, tailLift: 0, sq: 0, lx: 0, ly: 0, breath: 0, pupil: 1.3, px: 0, py: 0, lid: 1,
    paw: null /* { side, x, y } in cat units while a paw is out */ };

  // vertical squash of the body; the head is lifted/lowered by exactly how much the neck moves
  const bodySY = () => 1 - pose.sq * 0.09 + pose.breath * (0.006 + pose.lie * 0.01) - pose.lie * 0.34;
  const headDrop = () => 56 * (1 - bodySY());

  // Sleeping: lying on its side in a loaf, head resting on the front paws, tail wrapped round the front.
  const CURL_EYES = [[-33, -17], [-22, -18]];
  function curledShape(g) {
    const b = pose.breath;
    g.beginPath(); g.ellipse(7, -13.5 - b * 0.4, 35, 13.5 + b * 0.6, 0, 0, TAU); g.fill();           // body
    g.beginPath(); g.ellipse(27, -17 - b * 0.4, 16, 13 + b * 0.5, 0, 0, TAU); g.fill();              // haunch
    g.beginPath(); g.ellipse(-27, -17, 17, 14.5, -0.08, 0, TAU); g.fill();                          // head
    g.beginPath(); g.ellipse(-29, -3.5, 14, 4.8, 0, 0, TAU); g.fill();                              // paws under the chin
    g.beginPath(); g.moveTo(-42, -22); g.lineTo(-41, -41); g.lineTo(-30, -29); g.closePath(); g.fill(); // ears
    g.beginPath(); g.moveTo(-24, -30.5); g.lineTo(-14, -41); g.lineTo(-11.5, -25); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(41, -8); g.bezierCurveTo(48, 3, 22, 4.5, -10, -0.5);                   // tail
    g.lineWidth = 7; g.lineCap = "round"; g.stroke();
  }

  function catShape(g) {
    // the two poses cross-fade in the mask: the glyphs dissolve and re-form into the new silhouette
    const L = clamp((pose.lie - 0.15) / 0.7, 0, 1);
    if (L > 0) { g.globalAlpha = L; curledShape(g); }
    g.globalAlpha = 1 - L;
    if (L >= 1) { g.globalAlpha = 1; return; }
    sittingShape(g);
    g.globalAlpha = 1;
  }

  function sittingShape(g) {
    g.save();
    g.translate(pose.lx, pose.ly);
    g.scale(1 + pose.breath * 0.012 + pose.sq * 0.05 + pose.lie * 0.16, bodySY());
    g.beginPath();
    g.moveTo(-13, -56);
    g.bezierCurveTo(-31, -45, -33, -14, -26, 0);
    g.lineTo(26, 0);
    g.bezierCurveTo(33, -14, 31, -45, 13, -56);
    g.closePath(); g.fill();
    g.beginPath(); g.ellipse(-9, -1.5, 8, 4.6, 0, 0, TAU); g.ellipse(9, -1.5, 8, 4.6, 0, 0, TAU); g.fill();
    g.beginPath();
    g.moveTo(22, -5);
    const sw = pose.tail, L = pose.lie;
    // awake: tail curls up behind; asleep: it wraps round the front paws
    g.bezierCurveTo(lerp(40, 38, L), lerp(-2, 3, L), lerp(54 + sw * 0.6, 12, L), lerp(-16, 8, L),
      lerp(47 + sw, -22 + sw * 0.15, L), lerp(-36 - pose.tailLift, -2, L));
    g.lineWidth = 7.5; g.lineCap = "round"; g.stroke();
    if (pose.paw) {
      const p = pose.paw;
      g.beginPath(); g.moveTo(p.side * 10, -44); g.lineTo(p.x, p.y);
      g.lineWidth = 8; g.stroke();
      g.beginPath(); g.ellipse(p.x, p.y, 5.4, 4.6, 0, 0, TAU); g.fill();
    }
    g.restore();
    g.save();
    g.translate(pose.lx, pose.ly + headDrop());
    g.beginPath();
    g.moveTo(-21, -67);
    g.bezierCurveTo(-22, -81, -12, -87, 0, -87);
    g.bezierCurveTo(12, -87, 22, -81, 21, -67);
    g.bezierCurveTo(20, -56, 10, -51, 0, -51);
    g.bezierCurveTo(-10, -51, -20, -56, -21, -67);
    g.closePath(); g.fill();
    ear(g, -1, pose.earL); ear(g, 1, pose.earR);
    g.restore();
  }
  function ear(g, side, rot) {
    g.save();
    g.translate(side * 13, -82); g.rotate(side * rot); g.translate(-side * 13, 82);
    g.beginPath();
    g.moveTo(side * 7, -85); g.lineTo(side * 20, -101); g.lineTo(side * 20.5, -74); g.closePath();
    g.fill();
    g.restore();
  }

  function sampleMask() {
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, gw, gh);
    mctx.setTransform(S / cell, 0, 0, S / cell, (catX - gx0) / cell, (catY - gy0) / cell);
    mctx.fillStyle = "#fff"; mctx.strokeStyle = "#fff";
    catShape(mctx);
    const d = mctx.getImageData(0, 0, gw, gh).data;
    for (let i = 0; i < gw * gh; i++) cover[i] = d[i * 4 + 3] / 255;
  }
  function catCover(x, y) {
    if (!cover) return 0;
    const i = Math.floor((x - gx0) / cell), j = Math.floor((y - gy0) / cell);
    if (i < 0 || j < 0 || i >= gw || j >= gh) return 0;
    return cover[j * gw + i];
  }

  const mode = "void"; // black cat: a hole in the rain with a glowing outline
  function drawCat(t) {
    ctx.font = `${cell * 0.95}px ui-monospace, Consolas, "DejaVu Sans Mono", monospace`;
    ctx.textBaseline = "top";
    const at = (ii, jj) => (ii < 0 || jj < 0 || ii >= gw || jj >= gh ? 0 : cover[jj * gw + ii]);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const a = cover[j * gw + i];
        if (a < 0.06) continue;
        let ring = 0;
        if (a < 0.9 || Math.min(at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1)) < 0.5) ring = 1;
        else if (Math.min(at(i - 2, j), at(i + 2, j), at(i, j - 2), at(i, j + 2), at(i - 1, j - 1), at(i + 1, j + 1), at(i - 1, j + 1), at(i + 1, j - 1)) < 0.5) ring = 2;
        const pulse = 0.5 + 0.5 * Math.sin(j * 0.55 - t * 4.2 + i * 0.15); // data runs down the outline
        let alpha, color;
        if (ring === 1) { alpha = (mode === "void" ? 0.5 : 0.62) + 0.4 * pulse * pulse; color = pulse > 0.92 ? "#eafff3" : "#a6ffd0"; }
        else if (ring === 2 && mode === "void") { alpha = 0.16 + 0.22 * pulse * pulse; color = "#5fe39a"; }
        else if (mode === "void") {
          if (h3(i, j, Math.floor(t * 0.6 + h3(j, i, 5) * 4)) > 0.16) continue;
          alpha = 0.07; color = "#2fbf79";
        } else { alpha = 0.16 + 0.3 * h3(i, j, Math.floor(t * 1.1 + h3(j, i, 9) * 6)); color = "#5fe39a"; }
        const rate = ring ? 2.2 : 0.7;
        const ch = CH[Math.floor(h3(i + 31, j, Math.floor(t * rate + h3(i, j, 1) * 9)) * CH.length)];
        ctx.globalAlpha = alpha * Math.min(1, a * 1.4);
        ctx.fillStyle = color;
        ctx.fillText(ch, gx0 + i * cell + cell * 0.12, gy0 + j * cell);
      }
    }
    ctx.globalAlpha = 1;
  }

  function headPoint(ex, ey) {
    return [catX + (ex + pose.lx) * S, catY + (ey + pose.ly + headDrop()) * S];
  }

  function drawEyes() {
    for (const side of [-1, 1]) {
      const [X, Y] = headPoint(side * 8.6, -70);
      const w = 5.4 * S, h = 3.3 * S * pose.lid * (1 - clamp(pose.lie * 1.6, 0, 1));
      if (pose.lie > 0.62) { // asleep: soft closed-eye curves on the curled-up head
        const [ex, ey] = CURL_EYES[side < 0 ? 0 : 1];
        const k = clamp((pose.lie - 0.62) / 0.3, 0, 1);
        ctx.save(); ctx.globalAlpha = k; ctx.translate(catX + ex * S, catY + ey * S);
        ctx.beginPath(); ctx.moveTo(-2.6 * S, 0); ctx.quadraticCurveTo(0, 1.8 * S, 2.6 * S, 0);
        ctx.strokeStyle = "rgba(166,255,208,0.75)"; ctx.lineWidth = Math.max(1.2, S * 0.55); ctx.lineCap = "round";
        ctx.shadowColor = "rgba(120,255,180,0.6)"; ctx.shadowBlur = 6; ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(X, Y); ctx.rotate(side * -0.12);
      if (h > 0.4) {
        ctx.beginPath();
        ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, -h * 1.6, w, 0); ctx.quadraticCurveTo(0, h * 1.6, -w, 0); ctx.closePath();
        ctx.shadowColor = "rgba(120,255,180,0.9)"; ctx.shadowBlur = 12 * Math.min(1, S / 3);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
        g.addColorStop(0, "#e9fff2"); g.addColorStop(0.55, "#8affbf"); g.addColorStop(1, "#1fa865");
        ctx.fillStyle = g; ctx.fill();
        ctx.shadowBlur = 0;
        ctx.save(); ctx.clip();
        ctx.beginPath(); ctx.ellipse(pose.px * S, pose.py * S, pose.pupil * S * 0.55, h * 1.2, 0, 0, TAU);
        ctx.fillStyle = "#020302"; ctx.fill();
        ctx.beginPath(); ctx.arc(pose.px * S + w * 0.28, pose.py * S - h * 0.35, Math.max(1, S * 0.45), 0, TAU);
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0);
        ctx.strokeStyle = "rgba(166,255,208,0.7)"; ctx.lineWidth = Math.max(1, S * 0.5); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------------- behaviour ---------------- */
  // pointer coordinates are kept in screen (canvas) space; they may lie outside the screen
  const pointer = { x: 0, y: 0, in: false, fine: false, last: -10, speed: 0 };
  let pounce = null, burst = [];
  const R = rng(0xca7);
  let nextBlink = 2, blinkAt = -1, double = false, nextTwitch = 3, twitch = null, state = "idle";
  const MAX_LUNGE = 14; // units; the bounding box keeps this much room so the cat never leaves the screen
  const REACH = 60;     // units from the chest: inside this, the cat swipes instead of just watching
  const PAW = -1;       // only one paw ever moves: the one on the left of the screen, away from the tail
  const swipe = { on: false, t0: 0, side: 1, tx: 0, ty: 0, cool: 0, what: null };
  const WINGS = [ // mint, crimson, amber, ice
    { fill: "rgba(166,255,208,0.42)", edge: "rgba(220,255,236,0.92)", glow: "rgba(120,255,180,0.8)", dust: "#8affbf" },
    { fill: "rgba(229,89,107,0.55)", edge: "rgba(255,150,160,0.95)", glow: "rgba(181,18,37,0.8)", dust: "#e5596b" },
    { fill: "rgba(242,185,80,0.5)", edge: "rgba(255,224,165,0.95)", glow: "rgba(242,185,80,0.7)", dust: "#f2b950" },
    { fill: "rgba(103,200,230,0.48)", edge: "rgba(195,238,255,0.95)", glow: "rgba(103,200,230,0.75)", dust: "#67c8e6" },
  ];
  const flies = WINGS.map((c, i) => ({ i, c, x: 0, y: 0, vx: 0, vy: 0, seed: 11 + i * 23, phase: i * 1.7, flee: -10, ready: false }));
  let dust = [];
  const toUnits = (x, y) => [(x - catX) / S - pose.lx, (y - catY) / S - pose.ly];

  let asleep = false, zzz = [], zAcc = 0;
  // study mode: a keyboard slides in, the cat types with both paws, its notes stream into the terminal
  let studying = false;
  const NOTES = [
    "notes: LLM01 = prompt injection",
    "test(direct): ignore previous ...",
    "test(indirect): poisoned RAG doc",
    "metric: attack success rate / N",
    "falco: rule memfd_exec in container",
    "auditd -w /etc/sudoers -p wa",
    "TODO: write down the limits",
    "git commit -m \"lab notes\"",
  ];
  const KB = { rows: 4, cols: 12 };
  const study = { next: 0, pauseUntil: 0, paw: 0, lastL: -9, lastR: -9, keyL: 0, keyR: 0, glow: new Float32Array(KB.rows * KB.cols), note: 0, ci: 0, li: null, text: null, look: 0 };
  function update(t, dt) {
    // sleep: ease into the loaf pose, ease out when woken
    pose.lie = clamp(pose.lie + (asleep ? dt / 1.4 : -dt / 0.7), 0, 1);
    const resting = pose.lie > 0.05;
    pose.kb = clamp((pose.kb || 0) + (studying ? dt / 0.45 : -dt / 0.35), 0, 1);
    if (studying && pose.kb > 0.6) typeStep(t);
    const [headX, headY] = headPoint(0, -68);
    let tx, ty;
    if (pounce) { tx = pounce.x; ty = pounce.y; }
    else if (pointer.in && t - pointer.last < 4) { tx = pointer.x; ty = pointer.y; }
    else if (flies[0].ready && noise(t * 0.15, 4) > -0.35) {
      const f = flies[Math.floor((noise(t * 0.07, 6) + 1) * 2) % flies.length]; tx = f.x; ty = f.y;
    } else { tx = headX + noise(t * 0.32, 1) * W * 0.6; ty = headY + noise(t * 0.27, 2) * H * 0.3; }
    if (swipe.on) { tx = catX + (swipe.tx + pose.lx) * S; ty = catY + (swipe.ty + pose.ly) * S; }
    if (resting) { tx = headX; ty = headY + 40; }
    if (studying && !resting) { tx = catX; ty = t < study.look ? textBottom - 20 : catY + 30 * S; } // keys, or a glance up at the notes
    const dx = tx - headX, dy = ty - headY, dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist, near = Math.min(1, dist / (W * 0.35));
    const k = 1 - Math.pow(0.0015, dt);
    pose.px = lerp(pose.px, ux * 2.6 * near, k);
    pose.py = lerp(pose.py, uy * 1.4 * near, k);
    const excited = pointer.in && pointer.speed > 600;
    pose.pupil = lerp(pose.pupil, pounce ? 4.2 : excited ? 3.0 : pointer.in ? 2.0 : 1.3, k * 0.6);

    pose.breath = Math.sin(t * lerp(1.6, 0.9, pose.lie));
    const flick = pointer.in && !resting ? clamp(pointer.speed / 900, 0, 1) : 0;
    pose.tail = Math.sin(t * (1.1 + flick * 3)) * (4 + flick * 6) + noise(t * 0.7, 9) * 3;
    pose.tailLift = 4 * Math.sin(t * 0.8) + flick * 6;
    pointer.speed *= Math.pow(0.05, dt);

    if (t > nextBlink && blinkAt < 0) { blinkAt = t; double = R() < 0.25; }
    if (blinkAt >= 0) {
      const u = (t - blinkAt) / 0.16;
      if (u >= (double ? 2.4 : 1)) { blinkAt = -1; nextBlink = t + 2.5 + R() * 4; pose.lid = 1; }
      else { const v = u % 1.2; pose.lid = v > 1 ? 1 : 1 - Math.sin(Math.PI * v); }
    }
    if (!twitch && t > nextTwitch) twitch = { t, side: R() < 0.5 ? -1 : 1 };
    pose.earL = pose.earR = 0;
    if (twitch) {
      const u = (t - twitch.t) / 0.35;
      if (u >= 1) { twitch = null; nextTwitch = t + 3 + R() * 6; }
      else { const v = -0.32 * Math.sin(Math.PI * u); if (twitch.side < 0) pose.earL = v; else pose.earR = v; }
    }
    if (pounce || flick > 0.5) pose.earL = pose.earR = -0.12;
    if (resting) { pose.earL += 0.12 * pose.lie; pose.earR += 0.12 * pose.lie; }

    pose.sq = 0; pose.lx = 0; pose.ly = 0;
    state = pointer.in && t - pointer.last < 4 ? "watching" : "idle";
    if (resting) state = asleep ? (pose.lie < 1 ? "falling asleep" : "sleeping") : "waking up";
    else if (studying) state = t < study.look ? "studying (reading)" : "studying";
    if (pounce) {
      const u = t - pounce.t, dirX = pounce.dir;
      if (u < 0.24) { pose.sq = ease(u / 0.24); state = "crouch"; }
      else if (u < 0.4) {
        const v = (u - 0.24) / 0.16;
        pose.sq = 1 - v * 1.6; pose.lx = dirX * MAX_LUNGE * ease(v); pose.ly = -10 * Math.sin(Math.PI * v * 0.9); state = "pounce";
        if (!pounce.burst && v > 0.5) { pounce.burst = true; const [bx] = headPoint(dirX * 20, 0); spawnBurst(bx, catY - 4 * S); }
      } else if (u < 1.05) {
        const v = (u - 0.4) / 0.65;
        pose.lx = dirX * MAX_LUNGE * (1 - ease(v)); pose.ly = -10 * Math.sin(Math.PI * 0.9) * (1 - ease(v)); state = "landing";
      } else pounce = null;
    }
    // paw swipe: something inside reach -> raise, strike, retract
    if (!pounce && !swipe.on && !resting && !studying && t > swipe.cool) {
      let target = null;
      if (pointer.in && t - pointer.last < 4) {
        const [ux, uy] = toUnits(pointer.x, pointer.y);
        if (Math.hypot(ux, uy + 46) < REACH && uy < 4) target = { x: ux, y: uy, what: "pointer" };
      }
      if (!target) for (const f of flies) {
        const [ux, uy] = toUnits(f.x, f.y);
        if (Math.hypot(ux, uy + 46) < REACH - 4) { target = { x: ux, y: uy, what: f }; break; }
      }
      if (target) Object.assign(swipe, { on: true, t0: t, side: PAW, tx: target.x, ty: target.y, what: target.what });
    }
    pose.paw = null;
    if (swipe.on) {
      const u = t - swipe.t0;
      if (swipe.what === "pointer" && u < 0.16) { const [ux, uy] = toUnits(pointer.x, pointer.y); swipe.tx = ux; swipe.ty = uy; }
      if (swipe.what && swipe.what !== "pointer" && u < 0.16) { const [ux, uy] = toUnits(swipe.what.x, swipe.what.y); swipe.tx = ux; swipe.ty = uy; }
      const sx = swipe.side * 10, sy = -44;
      let dx = swipe.tx - sx, dy = swipe.ty - sy;
      const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const reach = Math.min(L, 46);
      const rest = [swipe.side * 9, -4];
      const cocked = [sx + dx * 18, sy + dy * 18 - 6];
      const strike = [sx + dx * reach, sy + dy * reach];
      let p;
      if (u < 0.16) p = mix(rest, cocked, ease(u / 0.16));
      else if (u < 0.27) p = mix(cocked, strike, ease((u - 0.16) / 0.11));
      else if (u < 0.34) p = strike;
      else if (u < 0.62) p = mix(strike, rest, ease((u - 0.34) / 0.28));
      else { swipe.on = false; swipe.cool = t + 0.45; p = null; }
      if (p) {
        p[0] = clamp(p[0], BOX.x0 - MAX_LUNGE + 4, BOX.x1 + MAX_LUNGE - 4); p[1] = Math.max(p[1], BOX.y0 + 4);
        pose.paw = { side: swipe.side, x: p[0], y: p[1] };
        pose.earL = pose.earR = -0.16;
        state = "swipe";
        if (u > 0.26 && u < 0.3 && swipe.what && swipe.what !== "pointer") swipe.what.flee = t; // butterfly escapes
      }
    }

    // butterflies: roam the whole screen (awake or asleep), flee from a paw, shed a little code dust
    const top = textBottom + 10, floor = catY - 8 * S, midY = (top + floor) / 2;
    for (const f of flies) {
      if (!f.ready) { f.x = W * (0.2 + 0.2 * f.i); f.y = top + (floor - top) * (0.2 + 0.18 * (f.i % 2)); f.ready = true; }
      const gx = W * 0.5 + noise(t * 0.09 + f.seed, f.seed) * W * 0.46;
      const gy = midY + noise(t * 0.11 + f.seed, f.seed + 3) * (floor - top) * 0.5;
      let ax = (gx - f.x) * 1.5, ay = (gy - f.y) * 1.5;
      ax += Math.sin(t * 6.3 + f.phase) * 46 * S / 3; ay += Math.cos(t * 8.7 + f.phase) * 66 * S / 3;
      if (t - f.flee < 0.9) { const [hx2, hy2] = headPoint(0, -70); const d = Math.hypot(f.x - hx2, f.y - hy2) || 1; ax += (f.x - hx2) / d * 900; ay += -700; }
      f.vx = (f.vx + ax * dt) * Math.pow(0.18, dt); f.vy = (f.vy + ay * dt) * Math.pow(0.18, dt);
      f.x = clamp(f.x + f.vx * dt, 14, W - 14); f.y = clamp(f.y + f.vy * dt, top, floor);
      if (R() < dt * 2.4) dust.push({ x: f.x, y: f.y, age: 0, life: 0.9, ch: CH[Math.floor(R() * CH.length)], c: f.c.dust });
    }
    // z z Z rising from the sleeping cat
    if (asleep && pose.lie > 0.9) {
      zAcc += dt;
      if (zAcc > 1.1) { zAcc = 0; zzz.push({ x: catX - 10 * S, y: catY - 42 * S, age: 0, life: 3.2, big: R() < 0.4 }); }
    }
    for (let i = zzz.length - 1; i >= 0; i--) { const z = zzz[i]; z.age += dt; z.x += 9 * dt * (S / 3); z.y -= 16 * dt * (S / 3); if (z.age > z.life) zzz.splice(i, 1); }
    for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.age += dt; d.y += 14 * dt; if (d.age > d.life) dust.splice(i, 1); }

    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.age += dt; p.vy += 520 * dt; p.vx *= Math.pow(0.4, dt);
      p.x += p.vx * dt; p.y = Math.min(catY + 2 * S, p.y + p.vy * dt);
      if (p.age > p.life) burst.splice(i, 1);
    }
    if (stateEl.textContent !== state) stateEl.textContent = state;
  }

  function typeStep(t) {
    if (t < study.next || t < study.pauseUntil) return;
    if (!study.li) newNoteLine();
    const txt = NOTES[study.note];
    if (study.ci >= txt.length) {                      // line done: pause, read it, start the next one
      study.caret && study.caret.remove();
      study.li = null; study.ci = 0; study.note = (study.note + 1) % NOTES.length;
      study.pauseUntil = t + 0.7 + R() * 0.6; study.look = study.pauseUntil;
      return;
    }
    const ch = txt[study.ci++];
    study.text.textContent += ch;
    // alternate paws; left paw owns the left half of the keyboard
    const left = (study.paw ^= 1) === 1;
    const row = ch === " " ? 3 : Math.floor(R() * 3);
    const col = ch === " " ? 5 + Math.floor(R() * 2) : left ? Math.floor(R() * 6) : 6 + Math.floor(R() * 6);
    study.glow[row * KB.cols + col] = 1;
    if (left) study.lastL = t; else study.lastR = t;
    study.next = t + 0.075 + R() * 0.11;
    if (R() < 0.05) { study.pauseUntil = t + 0.6 + R() * 0.9; if (R() < 0.6) study.look = study.pauseUntil; } // thinking
    measureText();
  }
  function newNoteLine() {
    study.li = document.createElement("li");
    study.text = document.createElement("span");
    study.caret = document.createElement("span");
    study.caret.className = "tcaret";
    study.li.append(study.text, study.caret);
    out.appendChild(study.li);
    while (out.childElementCount > MAX_LINES) out.firstElementChild.remove();
    measureText();
  }

  // keyboard in perspective, in front of the cat; pressed keys light up; the paws tap on the top rows
  function drawKeyboard(t, dt) {
    const k = ease(pose.kb || 0);
    if (k <= 0.01) return;
    const P = (x, y) => [catX + x * S, catY + (y + (1 - k) * 14) * S];
    const top = -13, bot = 6, tw = 27, bw = 37;
    const at = (u, v) => { const w = lerp(tw, bw, v); return P(-w + 2 * w * u, lerp(top, bot, v)); };
    ctx.save();
    ctx.globalAlpha = k;
    // case
    let a = at(0, 0), b = at(1, 0), c = at(1, 1), d = at(0, 1);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1] + 2.4 * S); ctx.lineTo(d[0], d[1] + 2.4 * S); ctx.closePath();
    ctx.fillStyle = "#070b09"; ctx.fill();
    ctx.lineWidth = Math.max(1, S * 0.35); ctx.strokeStyle = "rgba(166,255,208,0.45)"; ctx.stroke();
    // keys
    for (let r = 0; r < KB.rows; r++) for (let q = 0; q < KB.cols; q++) {
      const i = r * KB.cols + q;
      if (r === 3 && q > 3 && q < 8 && q !== 4) continue;          // space bar is one long key
      const q1 = r === 3 && q === 4 ? 8 : q + 1;
      const v0 = (r + 0.14) / KB.rows, v1 = (r + 0.86) / KB.rows, u0 = (q + 0.12) / KB.cols, u1 = (q1 - 0.12) / KB.cols;
      const p0 = at(u0, v0), p1 = at(u1, v0), p2 = at(u1, v1), p3 = at(u0, v1);
      const gl = r === 3 && q === 4 ? Math.max(study.glow[i], study.glow[i + 1], study.glow[i + 2]) : study.glow[i];
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath();
      ctx.fillStyle = `rgba(166,255,208,${0.05 + gl * 0.65})`; ctx.fill();
      ctx.strokeStyle = `rgba(166,255,208,${0.22 + gl * 0.5})`; ctx.lineWidth = Math.max(0.6, S * 0.18); ctx.stroke();
    }
    for (let i = 0; i < study.glow.length; i++) study.glow[i] = Math.max(0, study.glow[i] - dt / 0.18);
    // paws: black like the cat, outlined like its edge; each one dips when it presses a key
    for (const side of [-1, 1]) {
      const last = side < 0 ? study.lastL : study.lastR;
      const press = clamp(1 - (t - last) / 0.13, 0, 1);
      const lift = Math.sin(Math.PI * press);
      const px = side * 11, py = -16 + 5 * lift + (1 - k) * 14;
      const [x, y] = [catX + px * S, catY + py * S];
      ctx.beginPath();
      ctx.moveTo(x - 4.6 * S, catY + (-30 + (1 - k) * 14) * S); ctx.lineTo(x - 4.6 * S, y);
      ctx.moveTo(x + 4.6 * S, catY + (-30 + (1 - k) * 14) * S); ctx.lineTo(x + 4.6 * S, y);
      ctx.strokeStyle = "rgba(166,255,208,0.35)"; ctx.lineWidth = Math.max(1, S * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, 5.6 * S, 4 * S, 0, 0, TAU);
      ctx.fillStyle = "#030504"; ctx.fill();
      ctx.strokeStyle = "rgba(166,255,208,0.85)"; ctx.lineWidth = Math.max(1, S * 0.4); ctx.stroke();
      for (const tdx of [-2.6, 0, 2.6]) { ctx.beginPath(); ctx.arc(x + tdx * S, y + 1.6 * S, 0.7 * S, 0, TAU); ctx.fillStyle = "rgba(166,255,208,0.5)"; ctx.fill(); }
    }
    ctx.restore();
  }

  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }

  function drawFlies(t) {
    ctx.font = `${Math.max(7, cell * 0.8)}px ui-monospace, Consolas, monospace`;
    ctx.textBaseline = "middle";
    for (const d of dust) {
      ctx.globalAlpha = 0.45 * (1 - d.age / d.life);
      ctx.fillStyle = d.c;
      ctx.fillText(d.ch, d.x, d.y);
    }
    ctx.globalAlpha = 1;
    const u = S;
    for (const f of flies) {
      const flap = 0.22 + 0.78 * Math.abs(Math.sin(t * (t - f.flee < 0.9 ? 26 : 15) + f.phase));
      const tilt = clamp(f.vx / (200 * u / 3), -0.5, 0.5);
      const fill = f.c.fill, edge = f.c.edge;
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(tilt);
      ctx.shadowColor = f.c.glow; ctx.shadowBlur = 8;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(side * 2.9 * u * flap, -0.9 * u, 3.0 * u * flap, 2.3 * u, side * 0.5, 0, TAU);
        ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = Math.max(0.8, u * 0.22); ctx.strokeStyle = edge; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(side * 2.0 * u * flap, 1.5 * u, 2.0 * u * flap, 1.6 * u, -side * 0.4, 0, TAU);
        ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(0, -2.2 * u); ctx.lineTo(0, 2.6 * u);
      ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1, u * 0.45); ctx.lineCap = "round"; ctx.stroke();
      ctx.restore();
    }
  }

  function spawnBurst(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + R() * Math.PI, sp = 80 + R() * 180;
      burst.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.7 + R() * 0.6, ch: CH[Math.floor(R() * CH.length)] });
    }
  }
  function drawZzz() {
    ctx.textBaseline = "middle";
    for (const z of zzz) {
      const k = z.age / z.life;
      ctx.globalAlpha = Math.sin(Math.PI * k) * 0.85;
      ctx.font = `${Math.round((z.big ? 15 : 11) * (0.7 + k * 0.6) * S / 3)}px ui-monospace, Consolas, monospace`;
      ctx.fillStyle = "#a6ffd0";
      ctx.fillText(z.big ? "Z" : "z", z.x, z.y);
    }
    ctx.globalAlpha = 1;
  }
  function drawBurst() {
    ctx.font = `${Math.max(9, cell)}px ui-monospace, Consolas, monospace`;
    ctx.textBaseline = "middle";
    for (const p of burst) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life) * 0.85;
      ctx.fillStyle = "#a6ffd0";
      ctx.fillText(p.ch, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- layout: fit and centre the cat inside the screen ---------------- */
  let W = 0, H = 0, dpr = 1, statusH = 0;
  function layout() {
    const r = screen.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    for (const c of [cv, rain]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const pr = screen.querySelector(".prompt").getBoundingClientRect();
    promptH = pr.bottom - r.top + 4 + 22; // the cat always leaves room for one output line
    measureText();
    // usable area: below the prompt line, inside a margin; the cat box includes room for the lunge
    const m = Math.max(12, W * 0.04);
    const top = promptH + m * 0.6, bottom = H - m * 0.7, left = m, right = W - m;
    const boxW = BOX.x1 - BOX.x0 + MAX_LUNGE * 2, boxH = BOX.y1 - BOX.y0 + 40; // +40: air for the butterflies
    S = Math.min((right - left) / boxW, (bottom - top) / boxH);
    // horizontally centre the visual mass (body + tail), sit on the screen floor
    const midUnits = (BOX.x0 + BOX.x1) / 2;
    catX = (left + right) / 2 - midUnits * S;
    catY = bottom - (BOX.y1) * S;
    cell = clamp((BOX.y1 - BOX.y0) * S / 46, 5, 11);
    gx0 = Math.floor(catX + (BOX.x0 - MAX_LUNGE) * S - cell * 2);
    gy0 = Math.floor(catY + (BOX.y0 - 12) * S - cell * 2);
    gw = Math.ceil(((BOX.x1 - BOX.x0 + MAX_LUNGE * 2) * S + cell * 4) / cell);
    gh = Math.ceil(((BOX.y1 - BOX.y0 + 12) * S + cell * 4) / cell);
    mask.width = gw; mask.height = gh; cover = new Float32Array(gw * gh);
    buildRain();
    render(clock, true);
  }

  function render(t, force) {
    sampleMask();
    drawRain(t, force);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#030504"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(rain, 0, 0, W, H);
    const fg = ctx.createRadialGradient(catX, catY, 0, catX, catY, 60 * S);
    fg.addColorStop(0, "rgba(47,191,121,0.08)"); fg.addColorStop(1, "rgba(47,191,121,0)");
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
    drawCat(t);
    drawEyes();
    drawKeyboard(t, lastDt);
    drawFlies(t);
    drawZzz();
    drawBurst();
  }

  let clock = 0, last = 0, raf = 0, running = false, paused = false, visible = true, uiT = 0, lastDt = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    clock += dt; lastDt = dt;
    update(clock, dt);
    render(clock, false);
    if (clock - uiT > 0.5) { uiT = clock; tick(); }
  }
  function tick() { glyphEl.textContent = glyphCount.toLocaleString("en-US"); }
  function setRunning() {
    const should = visible && !paused && !reduce.matches && !document.hidden;
    if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }

  /* ---------------- input ---------------- */
  function toScreen(e) {
    const r = screen.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  stage.addEventListener("pointermove", (e) => {
    const [x, y] = toScreen(e);
    if (pointer.in) pointer.speed = Math.max(pointer.speed, Math.hypot(x - pointer.x, y - pointer.y) * 60);
    pointer.x = x; pointer.y = y; pointer.in = true; pointer.last = clock;
    pointer.fine = e.pointerType === "mouse" && matchMedia("(pointer: fine)").matches;
    const sr = stage.getBoundingClientRect();
    laser.style.transform = `translate(${e.clientX - sr.left}px, ${e.clientY - sr.top}px)`;
    laser.classList.toggle("on", pointer.fine && !e.target.closest("a, button"));
    if (!running) { update(clock, 0.05); render(clock, false); }
  });
  stage.addEventListener("pointerleave", () => { pointer.in = false; laser.classList.remove("on"); });
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("a, button, form")) return;
    if (asleep) { choose("awake", "you clicked. the cat wakes up."); return; }
    if (studying) return; // busy: no pounce while typing
    const [x, y] = toScreen(e);
    pointer.x = x; pointer.y = y; pointer.in = true; pointer.last = clock;
    if (!pounce && !reduce.matches) pounce = { t: clock, x, y, dir: clamp((x - catX) / (W * 0.4), -1, 1), burst: false };
  });

  /* ---------------- terminal: help, sleep, wake ... ---------------- */
  const form = document.getElementById("term"), input = document.getElementById("cmd"), out = document.getElementById("out");
  const MAX_LINES = 4;
  const history = []; let hIdx = 0;
  function measureText() {
    const r = screen.getBoundingClientRect(), o = out.getBoundingClientRect(), p = form.getBoundingClientRect();
    textBottom = Math.max(p.bottom, out.childElementCount ? o.bottom : 0) - r.top + 6;
  }
  function line(text, cls) {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    if (Array.isArray(text)) text.forEach(([t, c]) => { const sp = document.createElement("span"); if (c) sp.className = c; sp.textContent = t; li.appendChild(sp); });
    else li.textContent = text;
    out.appendChild(li);
    while (out.childElementCount > MAX_LINES) out.firstElementChild.remove();
    measureText();
    if (!running) render(clock, true);
  }
  // ---- schedule (Minh's time, GMT+7): 12–22 study, 22–05 sleep, 05–12 awake ----
  const TZ = "Asia/Ho_Chi_Minh";
  let schedule = "auto", slot = null; // schedule: auto | awake | study | sleep
  function nowHM() {
    try {
      const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      return { h: +p.find((x) => x.type === "hour").value, m: +p.find((x) => x.type === "minute").value };
    } catch (e) { const d = new Date(Date.now() + 7 * 3600e3); return { h: d.getUTCHours(), m: d.getUTCMinutes() }; }
  }
  const slotFor = (h) => (h >= 12 && h < 22 ? "study" : h >= 22 || h < 5 ? "sleep" : "awake");
  const hhmm = ({ h, m }) => String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");

  function current() { return asleep ? "sleep" : studying ? "study" : "awake"; }
  function enter(state, instant) {
    if (state !== "study" && studying) { studying = false; if (study.caret) study.caret.remove(); study.li = null; }
    if (state !== "sleep" && asleep) asleep = false;
    if (state === "sleep" && !asleep) { asleep = true; pounce = null; swipe.on = false; zAcc = 0.8; }
    if (state === "study" && !studying) { studying = true; pounce = null; swipe.on = false; study.next = clock + (instant ? 0.2 : 0.6); study.li = null; study.ci = 0; }
    if (instant) { pose.lie = asleep ? 1 : 0; pose.kb = studying ? 1 : 0; }
  }
  function setSchedule(m) {
    schedule = m;
    pick(["s-auto", "s-awake", "s-study", "s-sleep"], "s-" + m);
  }
  const SAY = {
    study: "$ ./study --topic ai-security",
    sleep: "cat: curls up and closes its eyes... zzz",
    awake: "cat: stretches. awake and watching.",
  };
  // manual change: from a command, a click or the buttons; stays until "auto"
  function choose(state, msg) {
    setSchedule(state);
    if (current() === state) return line(state === "sleep" ? "the cat is already asleep. zzz" : state === "study" ? "the cat is already studying." : "the cat is already awake.");
    if (current() === "study" && state === "sleep") line("cat: closes the notes...");
    enter(state);
    line(msg || SAY[state], state === "study" ? "cmd" : undefined);
  }
  function goAuto(quietIfSame) {
    setSchedule("auto");
    const t = nowHM(), want = slotFor(t.h);
    slot = want;
    const was = current();
    enter(want);
    if (!quietIfSame || was !== want) line(`auto: ${hhmm(t)} GMT+7 → ${want === "awake" ? "awake" : want}`);
  }
  function clockTick() {
    const t = nowHM();
    clockEl.textContent = hhmm(t);
    const want = slotFor(t.h);
    if (schedule === "auto" && want !== slot) {          // crossed 05:00, 12:00 or 22:00 while the page is open
      slot = want; enter(want); line(`auto: ${hhmm(t)} GMT+7 → ${want}`);
    }
  }
  const COMMANDS = {
    help: () => { line("help whoami study stop sleep wake auto schedule pounce clear"); line("(also: học, ngủ, dậy)", "cmd"); },
    study: () => choose("study"),
    stop: () => { if (current() === "study") choose("awake", "cat: saves the notes. back to watching."); else line("nothing to stop."); },
    auto: () => goAuto(false),
    schedule: () => { line("12–22 study · 22–05 sleep · 05–12 awake (GMT+7)"); line(`now: ${schedule === "auto" ? "auto" : "manual: " + schedule}. type auto to follow it`, "cmd"); },
    hobbies: () => line("gaming · music · road trips"),
    whoami: () => line([["Nguyễn Tuấn Minh", "vi"], [", security student · AI security"]]),
    sleep: () => choose("sleep"),
    wake: () => choose("awake"),
    pounce: () => {
      if (asleep) return line("the cat is asleep. try: wake", "err");
      if (studying) return line("the cat is busy studying. try: stop", "err");
      pounce = { t: clock, x: catX + 60 * S, y: catY - 10 * S, dir: 1, burst: false }; line("cat: pounce!");
    },
    clear: () => { out.textContent = ""; measureText(); },
    sudo: () => line("permission denied: the cat has root.", "err"),
  };
  const ALIAS = { "?": "help", "ngủ": "sleep", "ngu": "sleep", "nap": "sleep", "cat sleep": "sleep", "./cat --sleep": "sleep",
    "học": "study", "hoc": "study", "code": "study", "./study": "study", "dừng": "stop",
    "lịch": "schedule", "tự động": "auto",
    "dậy": "wake", "day": "wake", "wake up": "wake", "cat wake": "wake", "./cat --wake": "wake", "ls": "help" };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = input.value.trim().slice(0, 40);
    input.value = "";
    if (!raw) return;
    history.push(raw); hIdx = history.length;
    line("$ " + raw, "cmd");
    const key = raw.toLowerCase();
    const name = ALIAS[key] || key.split(/\s+/)[0];
    const fn = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
    if (fn) fn(); else line(`command not found: ${raw.split(/\s+/)[0]}. try: help`, "err");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && hIdx > 0) { input.value = history[--hIdx]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ""; e.preventDefault(); }
  });

  /* ---------------- controls ---------------- */
  const pick = (ids, on) => ids.forEach((id) => document.getElementById(id).setAttribute("aria-pressed", String(id === on)));
  const bPause = document.getElementById("pause");
  bPause.addEventListener("click", () => {
    paused = !paused;
    bPause.setAttribute("aria-pressed", String(paused));
    bPause.textContent = paused ? "Play" : "Pause";
    setRunning();
  });
  if (reduce.matches) bPause.hidden = true;
  for (const m of ["auto", "awake", "study", "sleep"]) {
    document.getElementById("s-" + m).addEventListener("click", () => { if (m === "auto") goAuto(false); else choose(m); });
  }

  new ResizeObserver(() => layout()).observe(screen);
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; setRunning(); }).observe(stage);
  document.addEventListener("visibilitychange", setRunning);
  reduce.addEventListener("change", () => { setRunning(); render(clock, true); });

  layout();
  {
    const t = nowHM(); slot = slotFor(t.h);
    clockEl.textContent = hhmm(t);
    // ?cat=awake|study|sleep pins a state (used to render the social preview and the no-JS poster)
    const forced = new URLSearchParams(location.search).get("cat");
    if (["awake", "study", "sleep"].includes(forced)) { setSchedule(forced); enter(forced, true); line(`$ ./cat --${forced}`, "cmd"); }
    else { enter(slot, true); line(`auto: ${hhmm(t)} GMT+7 → ${slot}`, "cmd"); }
  }
  setInterval(clockTick, 1000);                         // the clock runs even when the animation is paused
  update(0, 0.016);
  render(0, true);
  tick();
  setRunning();
})();
