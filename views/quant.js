// Quant study view — 6 gemma-4-12b cells (provider × {std-q4, std-q6, qat-q4}),
// backend 2.22.0. Hero = contrasts panel + 2×3 matrix (the actual point). Below:
// leaderboard / scatter / heatmap for the 6 cells, NT/WT switch, drill-down drawer.
(function () {
  const html = String.raw;
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function gradeBg(g) {
    if (g == null) return "transparent";
    const t = Math.max(0, Math.min(1, g / 10));
    return `rgba(${Math.round(214 - 150 * t)},${Math.round(80 + 140 * t)},90,0.28)`;
  }
  // near-zero contrast = neutral grey; |Δ|≥0.5 starts to mean something
  function deltaColor(d) {
    if (d == null) return "var(--fg-3)";
    const a = Math.abs(d);
    if (a < 0.25) return "var(--fg-3)";
    return d > 0 ? "var(--good)" : "var(--bad, #e0673f)";
  }
  function fmtD(d) { return d == null ? "·" : (d > 0 ? "+" : "") + d.toFixed(2); }

  window.renderQuant = function (root) {
    const q = window.DATA.quant;
    const prompts = window.DATA.prompts;
    const modelMeta = q.model_configs;
    const promptMeta = Object.fromEntries(prompts.map(p => [p.prompt_id, p]));
    const state = { stage: "no_thinking" };

    // ── 2×3 matrix: rows = variant/quant, cols = provider ──
    const byKey = {};
    q.cells.forEach(c => { byKey[`${c.provider}|${c.variant}-${c.quant}`] = c; });
    const ROWS = [["std", "q4", "std · Q4"], ["std", "q6", "std · Q6"], ["qat", "q4", "QAT · Q4"]];
    const PROV = ["vanilla", "unsloth"];
    const matrixHtml = html`
      <table class="quant-matrix">
        <thead><tr><th></th>${PROV.map(p => `<th>${p}</th>`).join("")}</tr></thead>
        <tbody>
          ${ROWS.map(([v, qz, label]) => html`
            <tr>
              <th>${label}</th>
              ${PROV.map(p => {
                const c = byKey[`${p}|${v}-${qz}`];
                if (!c) return `<td>—</td>`;
                return html`<td>
                  <div class="qm-cell">
                    <span class="qm-g" style="background:${gradeBg(c.nt)}" title="no_thinking">${c.nt?.toFixed(2) ?? "·"}</span>
                    <span class="qm-g" style="background:${gradeBg(c.wt)}" title="with_thinking">${c.wt?.toFixed(2) ?? "·"}</span>
                  </div>
                </td>`;
              }).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="muted" style="font-size:11px; margin-top:4px">każda komórka: <b>NT</b> · <b>WT</b> (średnia ocena z 20 promptów)</div>`;

    const contrastsHtml = html`
      <table class="quant-contrasts">
        <thead><tr><th>kontrast (Δ średniej)</th><th>NT</th><th>WT</th></tr></thead>
        <tbody>
          ${q.contrasts.map(c => html`
            <tr>
              <td>${escapeHtml(c.axis)}</td>
              <td style="color:${deltaColor(c.nt)}; text-align:right; font-variant-numeric:tabular-nums">${fmtD(c.nt)}</td>
              <td style="color:${deltaColor(c.wt)}; text-align:right; font-variant-numeric:tabular-nums">${fmtD(c.wt)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    root.innerHTML = html`
      <h1 class="section-title">Quant study — gemma-4-12b</h1>
      <p class="section-sub">
        Factorial 2×3: <strong>provider</strong> (vanilla=lmstudio-community / unsloth) ×
        <strong>wariant</strong> (std-Q4, std-Q6, QAT-Q4), backend <strong>2.22.0</strong>,
        20 promptów × 3 sample × 2 stage'e. Cel: rozdzielić skonfundowany wynik z aneksu Etap 3
        („quant decyduje" — Q5 vs Q4 i inny dostawca naraz).
        <strong>Wniosek: quant, provider i QAT są neutralne na średniej</strong> (kontrasty ≤0.35,
        w granicach szumu oceniania). Halucynacje/błędy na trudnych promptach są realne, ale
        stochastyczne per-prompt — nie systematyczny efekt quantu.
      </p>

      <div class="quant-hero">
        <div class="card">
          <div class="card-title"><span class="name">Macierz 2×3 — średnia ocena</span></div>
          ${matrixHtml}
        </div>
        <div class="card">
          <div class="card-title"><span class="name">Kontrasty (izolowane osie)</span></div>
          ${contrastsHtml}
          <div class="muted" style="font-size:11px; margin-top:6px">
            Δ = a−b. Szare = w szumie (|Δ|&lt;0.25). „unsloth (clean)" to jedyny czysty test QAT
            (std i qat ten sam schemat UD-Q4_K_XL).
          </div>
        </div>
      </div>

      <div class="section-block">
        <h2 class="block-title">Leaderboard <span id="q-lb-sub" class="muted"></span></h2>
        <div id="lb-container"></div>
      </div>
      <div class="section-block">
        <h2 class="block-title">Quality vs Speed <span class="muted" style="font-size:12px">średnia ocena vs decode tok/s (mediana) — tok/s orientacyjne, ISSUES #5</span></h2>
        <div id="sc-container"></div>
      </div>
      <div class="section-block">
        <h2 class="block-title">Heatmap ocen (model × prompt)</h2>
        <div class="heatmap-wrap" id="hm-container"></div>
      </div>

      <aside class="drawer" id="drawer">
        <div class="drawer-head">
          <h2 id="drawer-title">…</h2>
          <button class="drawer-close" id="drawer-close" aria-label="zamknij">×</button>
        </div>
        <div class="drawer-body" id="drawer-body"></div>
      </aside>`;

    document.getElementById("subnav").innerHTML = `
      <div class="stage-switch" id="stage-switch">
        <button data-stage="no_thinking" class="active">no_thinking</button>
        <button data-stage="with_thinking">with_thinking</button>
      </div>`;
    const switchEl = document.getElementById("stage-switch");
    for (const btn of switchEl.querySelectorAll("button")) {
      btn.addEventListener("click", () => {
        state.stage = btn.dataset.stage;
        for (const b of switchEl.querySelectorAll("button")) b.classList.toggle("active", b === btn);
        renderCharts();
      });
    }

    const drawer = document.getElementById("drawer");
    document.getElementById("drawer-close").addEventListener("click", () => drawer.classList.remove("open"));

    function openModelDrawer(modelKey) {
      const m = modelMeta[modelKey] || {};
      const mat = (q[state.stage].matrix || {})[modelKey] || {};
      document.getElementById("drawer-title").innerHTML =
        `<span style="font-size:13px; color:var(--fg-3)">${state.stage}</span>
         <span style="margin:0 8px; color:var(--fg-3)">·</span>
         <span style="font-weight:600">${escapeHtml(m.short_name || modelKey)}</span>`;
      const rows = prompts.map(p => {
        const cell = mat[p.prompt_id] || {};
        const g = cell.grade;
        return html`<tr>
          <td class="mono" style="font-size:11px">${p.prompt_id}</td>
          <td style="text-align:center; background:${gradeBg(g)}">${g ?? "·"}</td>
          <td>${cell.any_truncated ? '<span class="tag">TRUNC</span> ' : ""}${escapeHtml(cell.note || "")}</td>
        </tr>`;
      }).join("");
      document.getElementById("drawer-body").innerHTML = html`
        <table class="drawer-grades">
          <thead><tr><th>prompt</th><th>ocena</th><th>nota</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      drawer.classList.add("open");
    }

    function openCellDrawer(modelKey, promptId) {
      const m = modelMeta[modelKey] || {};
      const cell = ((q[state.stage].matrix || {})[modelKey] || {})[promptId];
      const p = promptMeta[promptId];
      if (!cell || !p) return;
      document.getElementById("drawer-title").innerHTML =
        `<span style="font-size:13px; color:var(--fg-3)">${state.stage}</span>
         <span style="margin:0 8px; color:var(--fg-3)">·</span>
         <span style="font-weight:600">${escapeHtml(m.short_name || modelKey)}</span>
         <span style="margin:0 8px; color:var(--fg-3)">·</span>
         <span class="mono">${promptId}</span>`;
      const samples = (cell.samples || []).map(s => html`
        <div class="sample">
          <div class="sample-meta muted">sample ${s.sample_idx} · seed ${s.seed} · ${s.predicted_n} tok ${s.trunc_flag ? `· <span class="tag">${s.trunc_flag}</span>` : ""}</div>
          ${s.reasoning ? `<details><summary class="muted">reasoning</summary><div style="margin-top:6px; white-space:pre-wrap">${escapeHtml(s.reasoning.slice(0, 1200))}</div></details>` : ""}
          <div class="sample-content" style="white-space:pre-wrap">${escapeHtml(s.content)}</div>
        </div>`).join("");
      document.getElementById("drawer-body").innerHTML = html`
        <div class="drawer-prompt">${escapeHtml(p.prompt.slice(0, 600))}${p.prompt.length > 600 ? " […]" : ""}</div>
        <div style="margin:8px 0"><b>ocena ${cell.grade ?? "·"}/10</b>${cell.note ? ` — ${escapeHtml(cell.note)}` : ""}</div>
        ${samples}`;
      drawer.classList.add("open");
    }

    function renderCharts() {
      const data = q[state.stage];
      const sorted = [...data.leaderboard].sort((a, b) => b.avg_grade - a.avg_grade);
      document.getElementById("q-lb-sub").textContent = `· ${sorted.length} cel · ${state.stage}`;
      renderLeaderboard(document.getElementById("lb-container"), sorted, modelMeta, { onClickModel: openModelDrawer });
      renderScatter(document.getElementById("sc-container"), sorted, modelMeta, { onClickModel: openModelDrawer });
      renderHeatmap(document.getElementById("hm-container"), { leaderboard: sorted, matrix: data.matrix }, modelMeta, prompts, { onClick: openCellDrawer });
    }
    renderCharts();
  };
})();
