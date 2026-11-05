// app.js — router + dispatcher (classic script, no modules; works on file://)

// Sample content/reasoning live in data/<exp>/<nt|wt>_NN.js (split_details in build_app_data.py).
// loadDetail injects that script once and merges the texts into the matrix cells in place.
// Returns a Promise; resolves immediately when already merged (or the data was never split).
window.loadDetail = (function () {
  const pending = {};
  return function (data, stage, model) {
    const rel = data.detail_index?.[stage]?.[model];
    if (!rel) return Promise.resolve();
    const key = `${data.detail_name}|${stage}|${model}`;
    if (pending[key]) return pending[key];
    return (pending[key] = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = "data/" + rel;
      el.onload = () => {
        const det = (window.DATA_DETAIL || {})[key] || {};
        const row = data[stage]?.matrix?.[model] || {};
        for (const [pid, arr] of Object.entries(det)) {
          (row[pid]?.samples || []).forEach((s, i) => Object.assign(s, arr[i] || {}));
        }
        delete window.DATA_DETAIL[key];
        resolve();
      };
      el.onerror = () => { delete pending[key]; reject(new Error("nie udało się wczytać " + rel)); };
      document.head.appendChild(el);
    }));
  };
})();

// UI state shared by all views and kept across reloads (stage NT/WT/all, scatter axis, zoom).
// Defined at load time, before any view renders.
window.APP_STATE = (function () {
  const PREFIX = "llmbench.";
  const mem = {};
  return {
    get(k, def) {
      if (k in mem) return mem[k];
      try { const v = localStorage.getItem(PREFIX + k); if (v != null) return (mem[k] = JSON.parse(v)); } catch (e) {}
      return def;
    },
    set(k, v) {
      mem[k] = v;
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {}
    },
  };
})();
(function () {
  const VIEW = document.getElementById("view");
  const TABS = document.getElementById("tabs");
  const STATUS = document.getElementById("footer-status");

  const ROUTES = {
    "models": () => window.renderModels(VIEW),
    "experiment3": () => window.renderExperiment3(VIEW),
    "etap4": () => window.renderEtap4(VIEW),
    "etap5": () => window.renderEtap5(VIEW),
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
