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

  /* ---------- Interactive terminal ----------
   * All output is built with textContent / createElement: visitor input is never
   * parsed as HTML, so the terminal cannot be turned into an XSS sink. */
  var form = document.querySelector("[data-term-form]");
  var out = document.querySelector("[data-term-out]");
  var body = document.querySelector("[data-term-body]");
  var input = document.getElementById("term-input");
  if (!form || !out || !input) return;
  form.hidden = false;

  var PS1 = "minh@cyberworld:~$";
  var history = [], hIndex = 0;

  // A line is a list of [text, className?, href?] segments.
  function line(segs) {
    var p = document.createElement("p");
    segs.forEach(function (s) {
      if (typeof s === "string") s = [s];
      var el;
      if (s[2]) {
        el = document.createElement("a");
        el.href = s[2];
        if (/^https:/.test(s[2])) { el.target = "_blank"; el.rel = "noopener noreferrer"; }
      } else {
        el = document.createElement("span");
      }
      if (s[1]) el.className = s[1];
      el.textContent = s[0];
      p.appendChild(el);
    });
    out.appendChild(p);
  }
  function print(lines) { lines.forEach(function (l) { line(Array.isArray(l) ? l : [l]); }); }
  function jump(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
  }

  var COMMANDS = {
    help: function () {
      print([
        [["commands:", "dim"]],
        "  whoami      who I am",
        "  ls          list sections",
        "  about       about me",
        "  projects    the measured lab (opens it)",
        "  ai          AI security research plan",
        "  education   coursework",
        "  contact     how to reach me",
        "  theme       toggle light / dark",
        "  clear       clear the screen"
      ]);
    },
    whoami: function () {
      print([
        [[name || "Nguyễn Tuấn Minh", "vi"]],
        "Information Security student, FPT University (year 3).",
        "Direction: AI security. Current evidence: one runtime-detection lab."
      ]);
    },
    ls: function () {
      print([[["overview/  projects/  skills/  ai-security/  education/  about/  contact/", "ok"]]]);
    },
    projects: function () {
      print([
        [["[verified] ", "ok"], "Falco + auditd: fileless execution detection in Docker"],
        "  detection 4 → 8 of 11 · unseen 1 → 4 of 7 · 2 FP sources",
        [["  → ", "dim"], ["#projects", "", "#projects"]]
      ]);
      jump("projects");
    },
    ai: function () {
      print([
        [["[planned] ", "warn"], "01 prompt-injection harness (LLM01, LLM07)"],
        [["[planned] ", "warn"], "02 indirect injection via RAG (LLM01, LLM08)"],
        [["[planned] ", "warn"], "03 agent tool abuse vs. runtime detection (LLM06)"],
        [["no results claimed until there is evidence.", "dim"]]
      ]);
      jump("ai-track");
    },
    about: function () {
      print(["Security student. Evidence first; AI security next."]);
      jump("about");
    },
    education: function () {
      print(["FPT University · Information Security · courses marked Passed"]);
      jump("education");
    },
    contact: function () {
      var any = false;
      [["email", "email"], ["linkedin", "linkedin"], ["github", "github"]].forEach(function (k) {
        if (links[k[0]]) { any = true; line([k[1] + ": ", [links[k[0]].replace(/^mailto:/, ""), "", links[k[0]]]]); }
      });
      if (!any) print(["see the contact section below."]);
      jump("contact");
    },
    theme: function (arg) {
      var t = arg === "light" || arg === "dark" ? arg : (currentTheme() === "dark" ? "light" : "dark");
      setTheme(t);
      print(["theme: " + t]);
    },
    clear: function () { out.textContent = ""; },
    sudo: function () {
      print([
        [["visitor is not in the sudoers file. This incident will be reported.", "err"]],
        [["(auditd keeps the login auid across sudo. That is how the Falco lab traced root actions back to the real user.)", "dim"]]
      ]);
    },
    exit: function () { print([[["there is no escape from the cyber world.", "dim"]]]); }
  };
  COMMANDS["cd"] = function (arg) {
    var map = { overview: "summary", summary: "summary", about: "about", skills: "tracks", tracks: "tracks", projects: "projects", "ai-security": "ai-track", ai: "ai-track", education: "education", contact: "contact", "~": "top" };
    var key = (arg || "~").replace(/\/$/, "");
    if (map[key]) jump(map[key]);
    else print([[["cd: no such directory: " + key, "err"]]]);
  };
  COMMANDS["cat"] = function (arg) {
    if (/status/.test(arg || "")) print([[["[verified] ", "ok"], "1 detection lab"], [["[learning] ", "warn"], "AI security"]]);
    else print([[["cat: " + (arg || "") + ": try `ls`", "err"]]]);
  };

  function run(raw) {
    var cmd = raw.trim().slice(0, 40);
    line([[PS1, "ps1"], " " + cmd]);
    if (!cmd) return;
    history.push(cmd); hIndex = history.length;
    var parts = cmd.split(/\s+/);
    var fn = Object.prototype.hasOwnProperty.call(COMMANDS, parts[0].toLowerCase()) ? COMMANDS[parts[0].toLowerCase()] : null;
    if (fn) fn(parts[1]);
    else print([[["command not found: " + parts[0] + ". Try ", "err"], ["help", "ok"]]]);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    run(input.value);
    input.value = "";
    body.scrollTop = body.scrollHeight;
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp" && hIndex > 0) { hIndex--; input.value = history[hIndex]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { hIndex = Math.min(history.length, hIndex + 1); input.value = history[hIndex] || ""; e.preventDefault(); }
  });
  body.addEventListener("click", function (e) {
    if (e.target.tagName !== "A" && !window.getSelection().toString()) input.focus({ preventScroll: true });
  });
})();
