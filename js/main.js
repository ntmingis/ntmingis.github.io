(function () {
  "use strict";
  var P = window.PROFILE || {};
  var root = document.documentElement;

  /* ---------- Profile fields (config.js) ---------- */
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
    linkedin: httpsUrl(P.linkedin, "linkedin.com"),
    github: httpsUrl(P.github, "github.com"),
    cv: cvLink(P.cv),
    projectRepo: httpsUrl(P.projectRepo),
    facebook: httpsUrl(P.facebook, "facebook.com"),
    instagram: httpsUrl(P.instagram, "instagram.com")
  };

  Object.keys(links).forEach(function (key) {
    document.querySelectorAll('a[data-field="' + key + '"]').forEach(function (a) {
      if (links[key]) { a.href = links[key]; a.hidden = false; }
      else { a.removeAttribute("href"); a.hidden = true; }
    });
  });

  var name = clean(P.name);
  if (name) {
    document.querySelectorAll('[data-field="name"]').forEach(function (el) { el.textContent = name; });
  }

  // Certifications render only with a name, an issuer and an https verification link.
  var certs = (Array.isArray(P.certifications) ? P.certifications : []).filter(function (c) {
    return c && clean(c.name) && clean(c.issuer) && httpsUrl(c.verifyUrl);
  });
  var certBox = document.querySelector("[data-certs]");
  var certList = document.querySelector("[data-cert-list]");
  if (certBox && certList && certs.length) {
    certs.forEach(function (c) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = httpsUrl(c.verifyUrl);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = clean(c.name);
      li.appendChild(a);
      li.appendChild(document.createTextNode(" · " + clean(c.issuer) + (clean(c.date) ? " · " + clean(c.date) : "")));
      certList.appendChild(li);
    });
    certBox.hidden = false;
  }

  /* ---------- Theme toggle ---------- */
  var toggle = document.querySelector("[data-theme-toggle]");
  var icon = document.querySelector("[data-theme-icon]");
  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function paintToggle() {
    var t = currentTheme();
    if (icon) icon.textContent = t === "dark" ? "☀" : "☾";
    if (toggle) toggle.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  function setTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch (e) {}
    paintToggle();
  }
  if (toggle) toggle.addEventListener("click", function () { setTheme(currentTheme() === "dark" ? "light" : "dark"); });
  paintToggle();

  /* ---------- Active nav link ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.getAttribute("href") === "#" + e.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) {
      var s = document.querySelector(a.getAttribute("href"));
      if (s) io.observe(s);
    });
  }
})();
