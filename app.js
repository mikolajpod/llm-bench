// app.js — router + dispatcher (classic script, no modules; works on file://)
(function () {
  const VIEW = document.getElementById("view");
  const TABS = document.getElementById("tabs");
  const STATUS = document.getElementById("footer-status");

  const ROUTES = {
    "models": () => window.renderModels(VIEW),
    "experiment3": () => window.renderExperiment3(VIEW),
    "etap4": () => window.renderEtap4(VIEW),
    "quant": () => window.renderQuant(VIEW),
    "mtp": () => window.renderMTP(VIEW),
    "help": () => window.renderHelp(VIEW),
  };
  const DEFAULT_VIEW = "experiment3";

  function currentView() {
    const hash = location.hash.replace(/^#\//, "");
    return ROUTES[hash] ? hash : DEFAULT_VIEW;
  }

  function setActiveTab(name) {
    for (const t of TABS.querySelectorAll(".tab")) {
      t.classList.toggle("active", t.dataset.view === name);
    }
  }

  const SUBNAV = document.getElementById("subnav");
  function route() {
    const v = currentView();
    setActiveTab(v);
    SUBNAV.innerHTML = "";  // views populate this if they want a sticky subnav
    VIEW.innerHTML = `<div class="loading">renderowanie…</div>`;
    STATUS.textContent = `widok: ${v}`;
    try {
      ROUTES[v]();
      STATUS.textContent = `widok: ${v} · gotowe`;
    } catch (e) {
      VIEW.innerHTML = `<div class="loading">błąd: ${e.message}<br><pre style="text-align:left">${(e.stack || "").replace(/</g, "&lt;")}</pre></div>`;
      STATUS.textContent = `błąd: ${e.message}`;
      console.error(e);
    }
  }

  window.addEventListener("hashchange", route);

  function boot() {
    if (!window.DATA || !window.DATA.models || !window.DATA.prompts || !window.DATA.experiment3) {
      VIEW.innerHTML = `<div class="loading">błąd: brak danych. Uruchom <code>build_app_data.py</code>.</div>`;
      STATUS.textContent = "brak danych";
      return;
    }
    if (!location.hash) location.hash = `#/${DEFAULT_VIEW}`;
    else route();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
