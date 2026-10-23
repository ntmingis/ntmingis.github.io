(function () {
  "use strict";
  var P = window.PROFILE || {};

  function clean(v) {
    v = typeof v === "string" ? v.trim() : "";
    return /[\[\]<>]/.test(v) ? "" : v; // ignore leftover [PLACEHOLDER] text
  }
  function httpsUrl(v, host) {
    v = clean(v);
    if (!/^https:\/\/[^\s]+$/i.test(v)) return "";
    if (host) {
      try {
        var h = new URL(v).hostname.replace(/^www\./, "");
        if (h !== host) return "";
      } catch (e) { return ""; }
    }
    return v;
  }
  function email(v) {
    v = clean(v);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
  }
  function cvLink(v) {
    v = clean(v);
    if (/^https:\/\//i.test(v)) return httpsUrl(v);
    return /^[\w./-]+\.pdf$/i.test(v) && v.indexOf("..") === -1 ? v : "";
  }

  var links = {
    email: email(P.email) && "mailto:" + email(P.email),
    github: httpsUrl(P.github, "github.com"),
    linkedin: httpsUrl(P.linkedin, "linkedin.com"),
    cv: cvLink(P.cv),
    projectRepo: httpsUrl(P.projectRepo),
    facebook: httpsUrl(P.facebook, "facebook.com"),
    instagram: httpsUrl(P.instagram, "instagram.com")
  };

  Object.keys(links).forEach(function (key) {
    document.querySelectorAll('a[data-field="' + key + '"]').forEach(function (a) {
      if (links[key]) {
        a.href = links[key];
        a.hidden = false;
      } else {
        a.removeAttribute("href");
        a.hidden = true;
      }
    });
  });

  var name = clean(P.name);
  var nameEl = document.querySelector('[data-field="name"]');
  if (nameEl && name) {
    nameEl.textContent = name;
    nameEl.hidden = false;
    document.title = name + " · Black Cat // Cyber World";
  }

  var aff = [clean(P.major), clean(P.university), clean(P.location)].filter(Boolean).join(" · ");
  var affEl = document.querySelector('[data-field="affiliation"]');
  if (affEl && aff) {
    affEl.textContent = aff;
    affEl.hidden = false;
  }

  // "Read Case Study" opens the details panel before scrolling to it.
  var caseEl = document.getElementById("case-study");
  document.querySelectorAll("[data-open-case]").forEach(function (btn) {
    btn.addEventListener("click", function () { if (caseEl) caseEl.open = true; });
  });
  if (caseEl && location.hash === "#case-study") caseEl.open = true;

  // Theme toggle (preference kept per browser; page works without storage).
  var root = document.documentElement;
  var toggle = document.querySelector(".theme-toggle");
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function stored() { try { return localStorage.getItem("theme"); } catch (e) { return null; } }
  function isDark() {
    var t = root.getAttribute("data-theme");
    return t ? t === "dark" : mq.matches;
  }
  function sync() {
    var dark = isDark();
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.querySelector(".theme-icon").textContent = dark ? "☀" : "☾";
    toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  var s = stored();
  if (s === "dark" || s === "light") root.setAttribute("data-theme", s);
  if (toggle) {
    sync();
    toggle.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* storage blocked */ }
      sync();
    });
    if (mq.addEventListener) mq.addEventListener("change", sync);
  }

  // Gentle reveal on scroll; skipped when reduced motion is requested.
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    // In-page links reveal their target before the browser scrolls to it; the
    // reveal's translateY would otherwise make the jump land 14px short.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      var t = a && document.getElementById(a.getAttribute("href").slice(1));
      if (t && t.classList.contains("reveal")) {
        t.style.transition = "opacity .5s ease";
        t.classList.add("in");
      }
    }, true);
    // Only hide what starts below the fold, so the first screen never flashes empty.
    var fold = window.innerHeight;
    document.querySelectorAll(".section").forEach(function (el) {
      if (el.getBoundingClientRect().top < fold) return;
      el.classList.add("reveal");
      io.observe(el);
    });
  }
})();
