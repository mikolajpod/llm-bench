// Experiment 3 view — leaderboard + heatmap + scatter + drill-down drawer
(function () {
  const html = String.raw;

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function cellGradePill(grade) {
    if (grade == null) return `<span class="grade-pill" style="background:#2a313c">—</span>`;
    return `<span class="grade-pill" style="background:${gradeColor(grade)};color:${textOnGrade(grade)}">${grade}</span>`;
  }

  function sampleBlock(s) {
    const reasoning = s.reasoning && s.reasoning.trim();
    return html`
      <div class="sample-block">
        <div class="sample-head">
          <span><strong>sample ${s.sample_idx}</strong></span>
          <span class="lbl">seed:</span><span class="mono">${s.seed}</span>
          <span class="lbl">temp:</span><span class="mono">${s.temperature}</span>
          <span class="lbl">decode:</span><span class="mono">${s.decode_tok_per_s} t/s</span>
          <span class="lbl">tokenów:</span><span class="mono">${s.predicted_n}</span>
          <span class="lbl">prompt:</span><span class="mono">${s.prompt_n}</span>
          <span class="lbl">wall:</span><span class="mono">${s.wall_seconds}s</span>
          ${s.trunc_flag ? `<span class="tag bad">${s.trunc_flag}</span>` : ""}
          <span class="lbl" style="margin-left:auto">${s.finish_reason || ""}</span>
        </div>
        ${reasoning ? html`
          <details class="sample-reasoning">
            <summary>reasoning trace (${reasoning.length} znaków)</summary>
            <div style="margin-top: 6px">${escapeHtml(reasoning)}</div>
          </details>` : ""}
        <div class="sample-content">${escapeHtml(s.content)}</div>
      </div>
    `;
  }

  window.renderExperiment3 = function (root) {
    const e3 = window.DATA.experiment3;
    const models = window.DATA.models;
    const prompts = window.DATA.prompts;
    // Per-models.py-key runtime config + display info (short_name, family, color, flags).
    const baseMeta = e3.model_configs;
    // Disk-scanned static model entries, keyed by file_model_key (used for full GGUF specs).
    const fileMeta = Object.fromEntries(models.map(m => [m.model_key, m]));
    const promptMeta = Object.fromEntries(prompts.map(p => [p.prompt_id, p]));

    // Synthetic "all" stage: each (model, stage) gets its own row keyed by
    // "<model>@NT" / "<model>@WT". Aggregations stay per-(model, stage).
    function syntheticAll() {
      const lb = [];
      const matrix = {};
      for (const st of ["no_thinking", "with_thinking"]) {
        const tag = st === "no_thinking" ? "NT" : "WT";
        for (const row of e3[st].leaderboard) {
          const k = `${row.model}@${tag}`;
          lb.push({ ...row, model: k });
          matrix[k] = e3[st].matrix[row.model];
        }
      }
      lb.sort((a, b) => b.avg_grade - a.avg_grade);
      return { leaderboard: lb, matrix };
    }
    const allStage = syntheticAll();

    // Return effective stage data (real for NT/WT, synthetic for "all").
    function getStageData(s) {
      return s === "all" ? allStage : e3[s];
    }

    // Decompose a synthetic "all" key back to (modelKey, realStage).
    function decomposeKey(k) {
      const m = k.match(/^(.+)@(NT|WT)$/);
      if (m) return { model: m[1], stage: m[2] === "NT" ? "no_thinking" : "with_thinking" };
      return null;
    }

    // modelMeta that understands synthetic keys (adds stage tag to short_name).
    const modelMeta = new Proxy(baseMeta, {
      get(target, key) {
        if (key in target) return target[key];
        if (typeof key !== "string") return undefined;
        const d = decomposeKey(key);
        if (!d) return undefined;
        const base = target[d.model];
        if (!base) return undefined;
        const tag = d.stage === "no_thinking" ? "NT" : "WT";
        return { ...base, short_name: `${base.short_name} · ${tag}` };
      },
    });

    // Default sort direction per column (overridden by user clicks toggling).
    const DEFAULT_DIR = {
      avg_grade:           "desc",
      median_decode_tps:   "desc",
      median_predicted_n:  "desc",
      median_wall_seconds: "asc",
    };
    const state = { stage: "no_thinking", sortBy: "avg_grade", sortDir: "desc" };

    function setSort(key) {
      // Click on the active column toggles direction; on inactive switches to its default.
      if (state.sortBy === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortBy = key;
        state.sortDir = DEFAULT_DIR[key] || "desc";
      }
      renderAll();
    }

    function sortLeaderboard(lb) {
      const sgn = state.sortDir === "asc" ? 1 : -1;
      const k = state.sortBy;
      return lb.slice().sort((a, b) => {
        const av = a[k], bv = b[k];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sgn * (av - bv);
      });
    }

    root.innerHTML = html`
      <h1 class="section-title">Experiment 3 — wyniki</h1>
      <p class="section-sub">
        <strong>Hardware:</strong> RTX 3060 12 GB · llama-server natywnie (bez LM Studio SDK).
        <strong>Zakres:</strong> ${e3.no_thinking.leaderboard.length} modeli w no_thinking,
        ${e3.with_thinking.leaderboard.length} w with_thinking, 20 promptów × 3 sample każdy
        (różne seedy 42/43/44). Oceny manualne 0–10 per (model, prompt, stage)
        wg <code>eval_3060/benchmark_criteria.md</code>.
        Klik w nazwę modelu lub komórkę → szczegóły.
      </p>


      <div class="e3-grid">
        <section class="panel">
          <h2>Leaderboard <span class="panel-sub" id="lb-sub"></span></h2>
          <div id="lb-container"></div>
        </section>

        <section class="panel">
          <h2>Quality vs Speed <span class="panel-sub">średnia ocena vs decode tokens/s</span></h2>
          <div id="sc-container"></div>
        </section>

        <section class="panel">
          <h2>Heatmap model × prompt <span class="panel-sub">klik na komórkę → odpowiedzi modelu</span></h2>
          <div class="heatmap-wrap" id="hm-container"></div>
        </section>
      </div>

      <div class="backdrop" id="backdrop"></div>
      <aside class="drawer" id="drawer">
        <div class="drawer-head">
          <h2 id="drawer-title">…</h2>
          <button class="drawer-close" id="drawer-close" aria-label="zamknij">×</button>
        </div>
        <div class="drawer-body" id="drawer-body"></div>
      </aside>
    `;

    // Sticky subnav (outside main, populated by this view; cleared by router on view change).
    document.getElementById("subnav").innerHTML = `
      <div class="stage-switch" id="stage-switch">
        <button data-stage="no_thinking" class="active">no_thinking</button>
        <button data-stage="with_thinking">with_thinking</button>
        <button data-stage="all">all</button>
      </div>
    `;
    const switchEl = document.getElementById("stage-switch");
    for (const btn of switchEl.querySelectorAll("button")) {
      btn.addEventListener("click", () => {
        state.stage = btn.dataset.stage;
        for (const b of switchEl.querySelectorAll("button")) b.classList.toggle("active", b === btn);
        renderAll();
      });
    }

    const drawer = document.getElementById("drawer");
    const backdrop = document.getElementById("backdrop");
    function closeDrawer() {
      drawer.classList.remove("open");
      backdrop.classList.remove("show");
    }
    document.getElementById("drawer-close").addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
    });

    function openCellDrawer(modelKey, promptId) {
      // In "all" mode, modelKey is synthetic — decompose to look up real cell.
      let realModel = modelKey, realStage = state.stage;
      if (state.stage === "all") {
        const d = decomposeKey(modelKey);
        if (d) { realModel = d.model; realStage = d.stage; }
      }
      const cell = ((e3[realStage]?.matrix || {})[realModel] || {})[promptId];
      const p = promptMeta[promptId];
      const m = modelMeta[modelKey];
      const stage = realStage;
      if (!cell || !p) return;

      document.getElementById("drawer-title").innerHTML =
        `<span style="font-size:13px; color:var(--fg-3)">${stage}</span>
         <span style="margin: 0 8px; color:var(--fg-3)">·</span>
         <span style="font-weight:600">${m?.short_name || modelKey}</span>
         <span style="margin: 0 8px; color:var(--fg-3)">·</span>
         <span class="mono">${promptId}</span>`;

      document.getElementById("drawer-body").innerHTML = `
        <div class="drawer-prompt">${escapeHtml(p.prompt)}</div>
        <div style="display:flex; gap: var(--space-3); margin-bottom: var(--space-3); flex-wrap:wrap">
          <span>${cellGradePill(cell.grade)} ocena</span>
          ${cell.median_decode_tps ? `<span class="muted">${cell.median_decode_tps.toFixed(1)} t/s med.</span>` : ""}
          ${cell.median_predicted_n ? `<span class="muted">${cell.median_predicted_n} tok wygen. (med.)</span>` : ""}
          ${cell.any_truncated ? `<span class="tag bad">truncated</span>` : ""}
          <span class="muted">${cell.n_samples} sample(s)</span>
        </div>
        ${cell.note ? `<div class="drawer-grade-note"><strong>nota oceniającego:</strong> ${escapeHtml(cell.note)}</div>` : ""}
        ${cell.samples.map(sampleBlock).join("")}
      `;

      drawer.classList.add("open");
      backdrop.classList.add("show");
    }

    function openModelDrawer(modelKey) {
      // Resolve synthetic keys for "all" mode.
      let realModel = modelKey, realStage = state.stage;
      if (state.stage === "all") {
        const d = decomposeKey(modelKey);
        if (d) { realModel = d.model; realStage = d.stage; }
      }
      const stage = realStage;
      const m = modelMeta[modelKey];
      const cfg = baseMeta[realModel] || {};
      const diskModel = cfg.file_model_key ? fileMeta[cfg.file_model_key] : null;
      const stageMatrix = e3[stage]?.matrix?.[realModel] || {};

      document.getElementById("drawer-title").innerHTML =
        `<span style="font-size:13px; color:var(--fg-3)">${stage}</span>
         <span style="margin: 0 8px; color:var(--fg-3)">·</span>
         <span style="font-weight:600">${m?.short_name || modelKey}</span>
         <span style="margin: 0 8px; color:var(--fg-3)">·</span>
         <span class="muted">wszystkie prompty</span>`;

      const promptList = prompts.map(p => ({ p, cell: stageMatrix[p.prompt_id] }));

      const runtimeBlock = `
        <div class="drawer-grade-note" style="border-left-color: var(--accent)">
          <div style="font-weight:600; margin-bottom: 6px">Runtime config (Experiment 3)</div>
          <div style="display:grid; grid-template-columns: 160px 1fr; gap: 4px var(--space-3); font-size:12px">
            ${diskModel ? `<div class="muted">plik na dysku</div><div><span class="mono">${escapeHtml(diskModel.display_name)}</span> · <span class="muted">${escapeHtml(diskModel.quant)}</span></div>` : ""}
            ${diskModel ? `<div class="muted">params</div><div><span class="mono">${escapeHtml(diskModel.params_str || "?")}</span> · <span class="muted">arch ${escapeHtml(diskModel.arch)}</span></div>` : ""}
            <div class="muted">thinking</div><div class="mono">${escapeHtml(cfg.thinking_mode || "—")}</div>
            <div class="muted">-ngl</div><div class="mono">${cfg.ngl ?? "—"}</div>
            ${cfg.n_cpu_moe != null ? `<div class="muted">--n-cpu-moe</div><div class="mono">${cfg.n_cpu_moe}</div>` : ""}
            <div class="muted">-c (ctx)</div><div class="mono">${cfg.ctx_used ?? "—"}</div>
            ${cfg.sampler_override ? `<div class="muted">sampler override</div><div class="mono" style="font-size:11px">${escapeHtml(JSON.stringify(cfg.sampler_override))}</div>` : ""}
            ${diskModel ? `<div class="muted">file_path</div><div class="mono muted" style="font-size:10.5px; word-break:break-all">${escapeHtml(diskModel.file_path)}</div>` : ""}
          </div>
        </div>
      `;

      document.getElementById("drawer-body").innerHTML = `
        ${runtimeBlock}
        <div style="margin: var(--space-3) 0; color: var(--fg-3); font-size: 12px">
          Klik na wiersz, żeby zobaczyć pełne odpowiedzi.
        </div>
        <table style="width:100%; border-collapse: collapse">
          <thead>
            <tr style="text-align:left; color:var(--fg-3); font-size:11px; text-transform:uppercase">
              <th style="padding:6px 8px">prompt</th>
              <th style="padding:6px 8px; text-align:center">ocena</th>
              <th style="padding:6px 8px; text-align:right">tok/s</th>
              <th style="padding:6px 8px; text-align:right">tokenów</th>
              <th style="padding:6px 8px; text-align:center">trunc</th>
            </tr>
          </thead>
          <tbody>
          ${promptList.map(({ p, cell }) => `
            <tr class="row-click" data-prompt="${p.prompt_id}" style="border-top:1px solid var(--border); cursor:pointer">
              <td style="padding:8px"><span class="mono" style="font-size:11px">${p.prompt_id}</span></td>
              <td style="padding:8px; text-align:center">${cellGradePill(cell?.grade)}</td>
              <td style="padding:8px; text-align:right" class="mono">${cell?.median_decode_tps?.toFixed(1) || "—"}</td>
              <td style="padding:8px; text-align:right" class="mono">${cell?.median_predicted_n || "—"}</td>
              <td style="padding:8px; text-align:center">${cell?.any_truncated ? "⚠" : ""}</td>
            </tr>
          `).join("")}
          </tbody>
        </table>
      `;
      document.querySelectorAll("#drawer-body .row-click").forEach(r => {
        // For "all" mode openCellDrawer expects the synthetic key.
        r.addEventListener("click", () => openCellDrawer(modelKey, r.dataset.prompt));
      });

      drawer.classList.add("open");
      backdrop.classList.add("show");
    }

    function renderAll() {
      const stage = state.stage;
      const data = getStageData(stage);
      const sorted = sortLeaderboard(data.leaderboard);
      const sortLabel = `${state.sortBy} ${state.sortDir === "asc" ? "↑" : "↓"}`;
      const rowsLabel = stage === "all"
        ? `${sorted.length} wierszy (model × stage) · sort: ${sortLabel}`
        : `${sorted.length} modeli · sort: ${sortLabel}`;
      document.getElementById("lb-sub").textContent = rowsLabel;
      const sortedData = { leaderboard: sorted, matrix: data.matrix };
      renderLeaderboard(document.getElementById("lb-container"), sorted, modelMeta, {
        onClickModel: openModelDrawer,
        onSortClick: setSort,
        currentSort: state.sortBy,
        currentDir: state.sortDir,
      });
      renderScatter(document.getElementById("sc-container"), sorted, modelMeta, { onClickModel: openModelDrawer });
      renderHeatmap(document.getElementById("hm-container"), sortedData, modelMeta, prompts, { onClick: openCellDrawer });
    }

    renderAll();
  };
})();
