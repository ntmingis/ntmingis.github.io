/*
 * BLACK CAT // CYBER WORLD: intro sequence, quest menu, optional sound.
 *
 * The page works without this file: the scene then shows its final state
 * (cat seated and typing, name visible) and the top bar below it navigates.
 */
(function () {
  "use strict";
  var root = document.documentElement;
  var intro = document.querySelector(".intro");
  var menu = document.getElementById("quest-menu");
  if (!intro || !menu) return;
  window.__introStarted = true;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var term = intro.querySelector("[data-term]");
  var stage = intro.querySelector(".stage");
  var skipBtn = intro.querySelector("[data-skip]");
  var replayBtn = intro.querySelector("[data-replay]");
  var soundBtn = intro.querySelector("[data-sound]");
  var questBtn = intro.querySelector("[data-open-menu]");
  var items = Array.prototype.slice.call(menu.querySelectorAll(".hud-item"));
  var STEPS = ["s-boot", "s-on", "s-arrive", "s-type", "s-reveal", "s-ready"];
  // ms from start: boot → screen on → cat arrives → typing → name → quest button
  var TIMELINE = [[0, "s-boot"], [1100, "s-on"], [1300, "s-arrive"], [2400, "s-type"],
                  [2700, "s-reveal"], [3900, "s-ready"], [4400, "done"]];
  var timers = [];
  var away = false;

  questBtn.hidden = false;

  // ---------- sound: Web Audio blips, off by default, only after a click ----------
  var AC = window.AudioContext || window.webkitAudioContext;
  var sfx = { on: false, ctx: null, noise: null };
  function tone(freq, dur, when, vol) {
    if (!sfx.on || !sfx.ctx || away) return;
    var t = sfx.ctx.currentTime + (when || 0);
    var o = sfx.ctx.createOscillator(), g = sfx.ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.03, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(sfx.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function keyClick() {
    if (!sfx.on || !sfx.ctx || away) return;
    var src = sfx.ctx.createBufferSource(), f = sfx.ctx.createBiquadFilter(), g = sfx.ctx.createGain();
    src.buffer = sfx.noise;
    f.type = "bandpass";
    f.frequency.value = 1800 + Math.random() * 900;
    g.gain.value = 0.05;
    src.connect(f);
    f.connect(g);
    g.connect(sfx.ctx.destination);
    src.start();
  }
  function chord(notes, step) {
    notes.forEach(function (n, i) { tone(n, 0.09, i * (step || 0.06)); });
  }
  if (AC && soundBtn) {
    soundBtn.hidden = false;
    soundBtn.addEventListener("click", function () {
      if (!sfx.ctx) {
        sfx.ctx = new AC();
        var len = Math.floor(sfx.ctx.sampleRate * 0.025);
        sfx.noise = sfx.ctx.createBuffer(1, len, sfx.ctx.sampleRate);
        var data = sfx.noise.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      sfx.on = !sfx.on;
      if (sfx.on && sfx.ctx.state === "suspended") sfx.ctx.resume();
      soundBtn.setAttribute("aria-pressed", String(sfx.on));
      soundBtn.querySelector("[data-sound-label]").textContent = sfx.on ? "On" : "Off";
      if (sfx.on) chord([523, 784]);
    });
  }

  // ---------- CRT terminal (decorative text only) ----------
  var LINES = ["cyber-world:~$ whoami", "> minh // black cat", "> class: sec learner", "> mood : curious"];
  var PROMPT = "cyber-world:~$ ";
  var COMMANDS = ["explore", "ls quests/", "cat skills.txt", "./next_quest.sh"];
  var termTimer = null;
  var termWanted = false;

  function render(lines, current) {
    term.textContent = lines.concat([current]).join("\n");
    var cursor = document.createElement("span");
    cursor.className = "cursor";
    cursor.textContent = "_";
    term.appendChild(cursor);
  }
  function stopTerm() { clearTimeout(termTimer); termTimer = null; }
  function showTermFinal() { stopTerm(); render(LINES, PROMPT + COMMANDS[0]); }
  // Types the intro lines (unless skipLines), then keeps cycling a few commands.
  function runTerm(skipLines) {
    stopTerm();
    termWanted = true;
    if (reduce) return showTermFinal();
    var done = skipLines ? LINES.slice() : [], li = 0, ci = 0, cmd = 0;
    var phase = skipLines ? "type" : "lines";
    function tick() {
      var delay;
      if (phase === "lines") {
        var line = LINES[li];
        ci++;
        render(done, line.slice(0, ci));
        keyClick();
        delay = 30;
        if (ci >= line.length) { done.push(line); li++; ci = 0; delay = 140; if (li >= LINES.length) phase = "type"; }
      } else {
        var text = COMMANDS[cmd % COMMANDS.length];
        if (phase === "type") {
          ci++;
          keyClick();
          delay = 95;
          if (ci >= text.length) { phase = "erase"; delay = 2800; }
        } else {
          ci--;
          delay = 45;
          if (ci <= 0) { ci = 0; phase = "type"; cmd++; delay = 600; }
        }
        render(done, PROMPT + text.slice(0, ci));
      }
      termTimer = setTimeout(tick, delay);
    }
    tick();
  }

  // ---------- ambient: twinkling stars in the window, floating dust ----------
  function spawn(container, list) {
    if (!container) return;
    container.textContent = "";
    list.forEach(function (vars) {
      var s = document.createElement("span");
      Object.keys(vars).forEach(function (k) { s.style.setProperty("--" + k, vars[k]); });
      container.appendChild(s);
    });
  }
  function pct(v, of) { return (v / of * 100).toFixed(2) + "%"; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  if (!reduce) {
    spawn(intro.querySelector("[data-stars]"), [[30, 13], [38, 22], [44, 12], [50, 17], [58, 10], [27, 20], [81, 27], [61, 28]]
      .map(function (p) { return { x: pct(p[0], 192), y: pct(p[1], 108), t: rand(2.8, 5.5).toFixed(2) + "s", d: rand(-5, 0).toFixed(2) + "s" }; }));
    var colors = ["#c9bbf5", "#9ff0cf", "#f7a8c8"];
    var dust = [];
    for (var i = 0; i < 14; i++) {
      dust.push({ x: pct(rand(20, 175), 192), y: pct(rand(25, 95), 108), c: colors[i % 3],
                  t: rand(7, 13).toFixed(2) + "s", d: rand(-12, 0).toFixed(2) + "s", dx: rand(-3, 3).toFixed(2) + "cqw" });
    }
    spawn(intro.querySelector("[data-dust]"), dust);
  }
  function bootPixels() {
    var list = [], c = ["#7ff5d2", "#c9bbf5", "#f7a8c8"];
    for (var i = 0; i < 18; i++) {
      list.push({ x: rand(8, 92).toFixed(1) + "%", y: rand(10, 90).toFixed(1) + "%", c: c[i % 3], d: rand(0, .8).toFixed(2) + "s" });
    }
    spawn(intro.querySelector("[data-boot-pixels]"), list);
  }

  // ---------- opening sequence ----------
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function step(name) {
    if (name === "done") return finish(false);
    intro.classList.add(name);
    if (name === "s-on") chord([262, 392, 523], 0.08);
    if (name === "s-type") runTerm(false);
  }
  function play() {
    clearTimers();
    stopTerm();
    STEPS.forEach(function (c) { intro.classList.remove(c); });
    term.textContent = "";
    bootPixels();
    root.classList.add("intro-play");
    void intro.offsetWidth; // restart CSS animations on replay
    replayBtn.hidden = true;
    TIMELINE.forEach(function (t) { timers.push(setTimeout(function () { step(t[1]); }, t[0])); });
  }
  function finish(skipped) {
    clearTimers();
    var hadFocus = document.activeElement === skipBtn;
    root.classList.remove("intro-play");
    STEPS.forEach(function (c) { intro.classList.remove(c); });
    try { sessionStorage.setItem("introSeen", "1"); } catch (e) { /* storage blocked */ }
    replayBtn.hidden = reduce;
    if (skipped || !termWanted) runTerm(true);
    if (hadFocus) questBtn.focus();
  }
  skipBtn.addEventListener("click", function () { finish(true); });
  replayBtn.addEventListener("click", function () {
    if (menu.open) return;
    play();
    skipBtn.focus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root.classList.contains("intro-play")) finish(true);
  });

  if (root.classList.contains("intro-play")) play();
  else runTerm(true);

  // ---------- pause when the scene is off-screen or the tab is hidden ----------
  function setAway(v) {
    if (v === away) return;
    away = v;
    intro.classList.toggle("is-away", away);
    if (away) stopTerm();
    else if (termWanted && !root.classList.contains("intro-play")) runTerm(true);
  }
  var visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      setAway(!visible || document.hidden);
    }).observe(intro);
  }
  document.addEventListener("visibilitychange", function () { setAway(!visible || document.hidden); });

  // ---------- depth: gentle parallax for mouse users ----------
  if (!reduce && window.matchMedia("(pointer: fine)").matches) {
    var raf = 0, mx = 0, my = 0;
    intro.addEventListener("pointermove", function (e) {
      mx = e.clientX / window.innerWidth * 2 - 1;
      my = e.clientY / window.innerHeight * 2 - 1;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = 0;
        stage.style.setProperty("--mx", mx.toFixed(3));
        stage.style.setProperty("--my", my.toFixed(3));
      });
    });
    intro.addEventListener("pointerleave", function () {
      stage.style.setProperty("--mx", 0);
      stage.style.setProperty("--my", 0);
    });
  }

  // ---------- quest menu (modal dialog: hidden until the button is pressed) ----------
  var native = typeof menu.showModal === "function";
  function openMenu() {
    if (menu.open) return;
    menu.classList.remove("closing");
    intro.classList.add("menu-open");
    if (native) menu.showModal(); else menu.setAttribute("open", "");
    items[0].focus();
    chord([440, 660, 880]);
  }
  function closeMenu(then) {
    if (!menu.open) return;
    intro.classList.remove("menu-open");
    function done() {
      menu.classList.remove("closing");
      if (native) menu.close(); else menu.removeAttribute("open");
      if (then) then(); else questBtn.focus();
    }
    chord([660, 440]);
    if (reduce) return done();
    menu.classList.add("closing");
    setTimeout(done, 200);
  }
  questBtn.addEventListener("click", openMenu);
  menu.querySelector("[data-close-menu]").addEventListener("click", function () { closeMenu(); });
  menu.addEventListener("cancel", function (e) { e.preventDefault(); closeMenu(); }); // Esc
  menu.addEventListener("close", function () { intro.classList.remove("menu-open"); menu.classList.remove("closing"); });
  menu.addEventListener("click", function (e) { if (e.target === menu) closeMenu(); }); // backdrop
  menu.addEventListener("keydown", function (e) {
    var i = items.indexOf(document.activeElement), n = -1;
    if (e.key === "ArrowDown") n = (i + 1) % items.length;
    else if (e.key === "ArrowUp") n = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = items.length - 1;
    else if (e.key === "Escape" && !native) { e.preventDefault(); closeMenu(); }
    if (n >= 0) { e.preventDefault(); items[n].focus(); }
  });
  items.forEach(function (a) {
    a.addEventListener("focus", function () { tone(1200, 0.03, 0, 0.02); });
    a.addEventListener("click", function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab etc.
      e.preventDefault();
      var id = a.getAttribute("href").slice(1);
      var target = document.getElementById(id);
      chord([880, 1320], 0.05);
      if (target.classList.contains("reveal")) { // settle the scroll-reveal so the jump lands exactly
        target.style.transition = "opacity .5s ease";
        target.classList.add("in");
      }
      closeMenu(function () {
        if (location.hash === "#" + id) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
        else location.hash = id;
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
    });
  });
})();
