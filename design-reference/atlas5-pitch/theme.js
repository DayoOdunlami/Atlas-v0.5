(function () {
  const KEY = "atlas5-pitch-theme";
  const root = document.documentElement;
  const btn = document.getElementById("theme-toggle");

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    if (btn) btn.textContent = theme === "dark" ? "Light mode" : "Dark mode";
    try {
      localStorage.setItem(KEY, theme);
    } catch (_) {}
  }

  const stored = (function () {
    try {
      return localStorage.getItem(KEY);
    } catch (_) {
      return null;
    }
  })();

  if (stored === "dark" || stored === "light") {
    apply(stored);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    apply("dark");
  }

  if (btn) {
    btn.addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(next);
    });
  }
})();
