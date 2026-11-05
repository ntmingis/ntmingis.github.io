// Runs in <head> before first paint: apply a saved theme choice (no flash).
// External file, not inline, so the CSP can stay script-src 'self'.
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  try {
    var t = localStorage.getItem("theme");
    if (t === "dark" || t === "light") d.setAttribute("data-theme", t);
  } catch (e) { /* storage blocked: follow the OS setting */ }
})();
