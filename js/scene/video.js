// Video hero: a pre-rendered knight film (see tools/prepare_video.py) with the
// digital-rain canvas composited on top. The rain is dimmed wherever the film
// has content (knight, fire), using a coarse occupancy grid computed offline,
// so the glyphs stay in the dark background and never sit on the figure.

import { Matrix } from "./matrix.js";
import { clamp } from "./util.js";

export function mountVideoScene(host, M, { textEl, stateEl, toggleEl } = {}) {
  const canvas = host.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const params = new URLSearchParams(location.search);
  const frozen = params.has("scene") ? parseFloat(params.get("scene")) : NaN;

  const video = document.createElement("video");
  video.className = "hero-video";
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = true;
  video.disablePictureInPicture = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  video.poster = M.poster;
  video.preload = reduce.matches ? "none" : "auto";
  for (const s of M.sources) {
    const el = document.createElement("source");
    el.src = s.src; el.type = s.type;
    video.appendChild(el);
  }
  host.insertBefore(video, canvas);
  host.classList.add("is-video", "is-live");

  const matrix = new Matrix();
  let w = 0, h = 0, dpr = 1, tier = 2, textBox = null, box = null;
  let raf = 0, playing = false, visible = true, userPaused = !Number.isNaN(frozen), destroyed = false;
  let workAvg = 0, workN = 0;
  const t0 = performance.now();
  const listeners = [];
  const on = (target, ev, fn, o) => { target.addEventListener(ev, fn, o); listeners.push(() => target.removeEventListener(ev, fn, o)); };

  /* -------- occupancy grid (bit-packed, base64 per frame) -------- */
  const T = M.track;
  const cache = new Map();
  function grid(i) {
    if (cache.has(i)) return cache.get(i);
    const bin = atob(T.frames[i]);
    const g = new Uint8Array(T.gw * T.gh);
    for (let k = 0; k < g.length; k++) g[k] = (bin.charCodeAt(k >> 3) >> (k & 7)) & 1;
    if (cache.size > 64) cache.clear();
    cache.set(i, g);
    return g;
  }
  function occupancy(t) {
    const i = clamp(Math.floor(t * T.fps), 0, T.frames.length - 1);
    return grid(i);
  }

  function maskFor(t) {
    const g = occupancy(t);
    return (x, y) => {
      if (!box) return 1;
      const u = (x - box.x) / box.w, v = (y - box.y) / box.h;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return 1;
      const cx = Math.floor(u * T.gw), cy = Math.floor(v * T.gh);
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = cx + dx, Y = cy + dy;
        if (X < 0 || Y < 0 || X >= T.gw || Y >= T.gh) continue;
        sum += g[Y * T.gw + X] * (dx === 0 && dy === 0 ? 2 : 1); n += dx === 0 && dy === 0 ? 2 : 1;
      }
      return 1 - 0.9 * (sum / n);
    };
  }

  // Where the film is actually drawn inside the host (object-fit: cover + object-position).
  function videoBox() {
    const hr = host.getBoundingClientRect(), vr = video.getBoundingClientRect();
    const s = Math.max(vr.width / M.width, vr.height / M.height);
    const pos = getComputedStyle(video).objectPosition.split(" ").map((p) => parseFloat(p) / 100);
    const dw = M.width * s, dh = M.height * s;
    return { x: vr.left - hr.left + (vr.width - dw) * (pos[0] ?? 0.5), y: vr.top - hr.top + (vr.height - dh) * (pos[1] ?? 0.5), w: dw, h: dh };
  }

  function layout() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    if (!matrix.cols.length) tier = w >= 1100 && (navigator.hardwareConcurrency || 8) > 4 ? 2 : w >= 700 ? 1 : 0;
    const budget = [0.9e6, 1.6e6, 2.6e6][tier];
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(budget / (w * h))));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    textBox = null;
    if (textEl) { const t = textEl.getBoundingClientRect(); textBox = { x: t.left - r.left, y: t.top - r.top, w: t.width, h: t.height }; }
    box = videoBox();
    matrix.resize(w, h, dpr, tier);
    render(true);
  }

  function stateAt(t) {
    let name = M.states[0][0];
    for (const [n, s] of M.states) if (t >= s) name = n;
    return name;
  }

  function render(force) {
    const vt = video.currentTime || 0;
    const masks = textBox ? [{ x: textBox.x + textBox.w / 2, y: textBox.y + textBox.h / 2, rx: textBox.w * 0.62, ry: textBox.h * 0.62, k: 0.4 }] : [];
    const clock = Number.isNaN(frozen) ? (performance.now() - t0) / 1000 : 0;
    const m = matrix.render(clock, masks, h, force, null, maskFor(vt));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(m, 0, 0);
    const st = stateAt(vt);
    if (stateEl && stateEl.dataset.state !== st) { stateEl.dataset.state = st; stateEl.textContent = st; }
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const a = performance.now();
    render(false);
    workAvg += performance.now() - a;
    if (++workN === 45) {
      if (workAvg / workN > 9 && tier > 0) { tier--; layout(); }
      workAvg = 0; workN = 0;
    }
  }

  function updateRunning() {
    const should = !destroyed && visible && !userPaused && !reduce.matches && !document.hidden;
    if (should && !playing) {
      playing = true;
      const p = video.play();
      if (p && p.catch) p.catch(() => { /* autoplay refused: poster + rain stay */ });
      raf = requestAnimationFrame(frame);
    } else if (!should && playing) {
      playing = false;
      video.pause();
      cancelAnimationFrame(raf); raf = 0;
      render(true);
    }
    if (toggleEl) {
      toggleEl.hidden = reduce.matches;
      toggleEl.setAttribute("aria-pressed", String(userPaused));
      toggleEl.textContent = userPaused ? "Play scene" : "Pause scene";
    }
  }

  const ro = new ResizeObserver(() => layout());
  ro.observe(host);
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; updateRunning(); });
  io.observe(host);
  on(document, "visibilitychange", updateRunning);
  on(reduce, "change", updateRunning);
  let froze = false;
  const applyFreeze = () => {
    if (Number.isNaN(frozen) || froze || video.readyState < 1) return;
    froze = true;
    video.currentTime = clamp(frozen, 0, M.duration - 0.05);
  };
  on(video, "loadedmetadata", () => { applyFreeze(); layout(); });
  on(video, "canplay", applyFreeze);
  on(video, "seeked", () => render(true));
  if (toggleEl) on(toggleEl, "click", () => { userPaused = !userPaused; updateRunning(); });

  layout();
  applyFreeze();
  updateRunning();

  return {
    get state() { return stateAt(video.currentTime || 0); },
    get time() { return video.currentTime || 0; },
    get tier() { return tier; },
    get glyphs() { return matrix.count || 0; },
    get running() { return playing; },
    get mode() { return "video"; },
    seek(t) { video.currentTime = t; },
    pause() { userPaused = true; updateRunning(); },
    play() { userPaused = false; updateRunning(); },
    destroy() {
      destroyed = true; updateRunning();
      ro.disconnect(); io.disconnect();
      listeners.forEach((off) => off());
      video.removeAttribute("src");
      video.querySelectorAll("source").forEach((s) => s.remove());
      video.load();
      matrix.canvas.width = 0;
      host.classList.remove("is-live");
    },
  };
}
