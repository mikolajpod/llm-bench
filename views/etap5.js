// Etap 5 view — RTX 3090, backend 2.64, new 20-prompt suite (copy of views/etap4.js;
// prompts come from data.prompts, not window.DATA.prompts which is the Etap 3/4 set).
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
    const txt = Number.isInteger(grade) ? grade : grade.toFixed(1);  // regrade v2: cell grade = mean of samples
    return `<span class="grade-pill" style="background:${gradeColor(grade)};color:${textOnGrade(grade)}">${txt}</span>`;
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
          ${s.grade != null ? `<span class="lbl">ocena:</span>${cellGradePill(s.grade)}` : ""}
          <span class="lbl" style="margin-left:auto">${s.finish_reason || ""}</span>
        </div>
        ${s.grade_note ? `<div class="muted" style="font-size:12px; margin: 4px 0 6px">${escapeHtml(s.grade_note)}</div>` : ""}
        ${reasoning ? html`
          <details class="sample-reasoning">
            <summary>reasoning trace (${reasoning.length} znaków)</summary>
            <div style="margin-top: 6px">${escapeHtml(reasoning)}</div>
          </details>` : ""}
        <div class="sample-content">${escapeHtml(s.content)}</div>
      </div>
    `;
  }

  window.renderEtap5 = function (root) {
    const e4 = window.DATA.etap5;
    const models = window.DATA.models;
    const prompts = e4.prompts;
    const baseMeta = e4.model_configs;
    const fileMeta = Object.fromEntries(models.map(m => [m.model_key, m]));
    const promptMeta = Object.fromEntries(prompts.map(p => [p.prompt_id, p]));
    const graded = e4.graded_stages || { no_thinking: true, with_thinking: true };

    function syntheticAll() {
      const lb = [];
      const matrix = {};
      for (const st of ["no_thinking", "with_thinking"]) {
        const tag = st === "no_thinking" ? "NT" : "WT";
        for (const row of (e4[st]?.leaderboard || [])) {
          const k = `${row.model}@${tag}`;
          lb.push({ ...row, model: k });
          matrix[k] = e4[st].matrix[row.model];
        }
      }
      lb.sort((a, b) => b.avg_grade - a.avg_grade);
      return { leaderboard: lb, matrix };
    }
    const allStage = syntheticAll();
    function getStageData(s) { return s === "all" ? allStage : e4[s]; }

    function decomposeKey(k) {
      const m = k.match(/^(.+)@(NT|WT)$/);
      if (m) return { model: m[1], stage: m[2] === "NT" ? "no_thinking" : "with_thinking" };
      return null;
    }

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

    const DEFAULT_DIR = {
      avg_grade: "desc", median_decode_tps: "desc",
      median_predicted_n: "desc", median_wall_seconds: "asc",
    };
    const state = { stage: APP_STATE.get("stage", "no_thinking"), sortBy: "avg_grade", sortDir: "desc",
                    vbX: APP_STATE.get("vbX", "mean_wall_seconds"), vbZoom: APP_STATE.get("vbZoom", false) };
    // Verbosity axis: wall = what you wait (engine speed × answer length + prefill); tokens = length alone.
    const VB = {
      mean_wall_seconds: {
        label: "czas na odpowiedź [s] (średnia, skala log)",
        sub: "średnia ocena vs średni czas odpowiedzi = gadatliwość × szybkość silnika",
        fmt: v => `${v.toFixed(1)} s/odp.`,
        extra: r => ` · ${r.mean_predicted_n} tok/odp. · ${Math.round(r.median_decode_tps || 0)} t/s · trunc ${Math.round(100 * r.trunc_rate)}%`,
      },
      mean_predicted_n: {
        label: "tokenów na odpowiedź (średnia, skala log)",
        sub: "średnia ocena vs średnia długość odpowiedzi (z myśleniem) — sama gadatliwość, bez sprzętu",
        fmt: v => `${Math.round(v)} tok/odp.`,
        extra: r => ` · ${r.mean_wall_seconds?.toFixed(1)} s/odp. · trunc ${Math.round(100 * r.trunc_rate)}%`,
      },
      median_decode_tps: {
        label: "decode tokens/s (mediana, skala log)",
        sub: "średnia ocena vs szybkość generowania — sam silnik × model, bez długości odpowiedzi",
        fmt: v => `${Math.round(v)} t/s`, frontier: "high",
        extra: r => ` · ${r.mean_predicted_n} tok/odp. · ${r.mean_wall_seconds?.toFixed(1)} s/odp.`,
      },
    };

    function setSort(key) {
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
      <h1 class="section-title">Etap 5 — RTX 3090</h1>
      <p class="section-sub">
        <strong>Hardware:</strong> RTX 3090 24 GB · llama-server 2.64 natywnie, zamrożony layout/ctx per model (bez <code>--fit</code>), KV f16.
        <strong>Prompty:</strong> nowy zestaw ${prompts.length} promptów (8 z Etapu 4 + 12 nowych z ocenami maszynowymi), max_tokens 16000.
        <strong>Zakres:</strong> ${e4.no_thinking.leaderboard.length} wpisów no_thinking,
        ${e4.with_thinking.leaderboard.length} with_thinking × 5 sampli; sampler producenta.
        Muse-Glimmer nie ma wyłącznika thinking — <span class="mono">@low</span> to <code>reasoning_strength=low</code> (WT).
        Nanbeige NT bez longctx (19 promptów), Olmo-3-Think N=3.
        <strong>Oceny (2026-11-04):</strong> ślepa ocena Sonnet 5.5 wg <code>eval_etap5/benchmark_criteria_v3.md</code> v3.1
        + sprawdzenia maszynowe (pytest z mutantami, PostgreSQL 16, javac doclint, testy Java, liczenie słów, longctx);
        ocena komórki = <strong>średnia próbek</strong>. Kontrole (gemma-4-12b NT, gemma-4-e4b WT) w każdej z 7 paczek.
        <strong>Paczka 7 (2026-11-06):</strong> Qwen3.8-Flash-Next na silniku <strong>Strata 0.1.56</strong> (wpisy <span class="mono">strata/…</span>: IQ2_XS, Swift 1.5, Coder IQ1_M; low-RAM, KV int8, MTP) — WT na <code>reasoning_effort=medium</code> (domyślny xhigh nie mieści się w 16k), Swift na domyślnym.
        <strong>all</strong> łączy NT i WT. Klik w nazwę modelu lub komórkę → szczegóły.
      </p>

      <div class="e3-grid">
        <section class="panel">
          <h2>Leaderboard <span class="panel-sub" id="lb-sub"></span></h2>
          <div id="lb-container"></div>
        </section>
        <section class="panel">
          <h2>Quality vs Speed / Gadatliwość <span class="panel-sub" id="vb-sub"></span></h2>
          <div style="display:flex; gap: var(--space-3); margin-bottom: var(--space-3); flex-wrap:wrap">
            <div class="stage-switch" id="vb-switch">
              <button data-x="mean_wall_seconds">czas / odpowiedź</button>
              <button data-x="mean_predicted_n">tokenów / odpowiedź</button>
              <button data-x="median_decode_tps">decode tok/s</button>
            </div>
            <div class="stage-switch">
              <button id="vb-zoom" title="rozciągnij wykres 2× w pionie">zoom 2×</button>
            </div>
          </div>
          <div id="vb-container"></div>
        </section>
        <section class="panel">
          <h2>Heatmap model × prompt <span class="panel-sub">klik na komórkę → odpowiedzi modelu</span></h2>
          <div class="heatmap-wrap" id="hm-container"></div>
        </section>
        <section class="panel">
          <h2>Obcięte odpowiedzi (TRUNC) model × prompt <span class="panel-sub">liczba sampli, które doszły do max_tokens · kolor = udział w komórce · Σ = suma · klik → odpowiedzi</span></h2>
          <div class="heatmap-wrap" id="tr-container"></div>
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

    document.getElementById("subnav").innerHTML = `
      <div class="stage-switch" id="stage-switch">
        <button data-stage="no_thinking">no_thinking</button>
        <button data-stage="with_thinking">with_thinking${graded.with_thinking ? "" : " ⏳"}</button>
        <button data-stage="all">all${graded.with_thinking ? "" : " ⏳"}</button>
      </div>
    `;
    const switchEl = document.getElementById("stage-switch");
    for (const b of switchEl.querySelectorAll("button")) b.classList.toggle("active", b.dataset.stage === state.stage);
    for (const btn of switchEl.querySelectorAll("button")) {
      btn.addEventListener("click", () => {
        state.stage = btn.dataset.stage;
        APP_STATE.set("stage", state.stage);
        for (const b of switchEl.querySelectorAll("button")) b.classList.toggle("active", b === btn);
        renderAll();
      });
    }

    const vbSwitch = document.getElementById("vb-switch");
    for (const b of vbSwitch.querySelectorAll("button")) b.classList.toggle("active", b.dataset.x === state.vbX);
    for (const btn of vbSwitch.querySelectorAll("button")) {
      btn.addEventListener("click", () => {
        state.vbX = btn.dataset.x;
        APP_STATE.set("vbX", state.vbX);
        for (const b of vbSwitch.querySelectorAll("button")) b.classList.toggle("active", b === btn);
        renderAll();
      });
    }
    const vbZoom = document.getElementById("vb-zoom");
    vbZoom.classList.toggle("active", !!state.vbZoom);
    vbZoom.addEventListener("click", () => {
      state.vbZoom = !state.vbZoom;
      APP_STATE.set("vbZoom", state.vbZoom);
      vbZoom.classList.toggle("active", state.vbZoom);
      renderAll();
    });

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
      let realModel = modelKey, realStage = state.stage;
      if (state.stage === "all") {
        const d = decomposeKey(modelKey);
        if (d) { realModel = d.model; realStage = d.stage; }
      }
      document.getElementById("drawer-body").innerHTML = `<div class="loading">wczytywanie odpowiedzi…</div>`;
      drawer.classList.add("open");
      backdrop.classList.add("show");
      loadDetail(e4, realStage, realModel)
        .then(() => renderCellDrawer(modelKey, promptId))
        .catch(e => { document.getElementById("drawer-body").innerHTML = `<div class="loading">błąd: ${e.message}</div>`; });
    }

    function renderCellDrawer(modelKey, promptId) {
      let realModel = modelKey, realStage = state.stage;
      if (state.stage === "all") {
        const d = decomposeKey(modelKey);
        if (d) { realModel = d.model; realStage = d.stage; }
      }
      const cell = ((e4[realStage]?.matrix || {})[realModel] || {})[promptId];
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
          <span>${cellGradePill(cell.grade)} ocena (średnia próbek)</span>
          ${cell.grade_median != null ? `<span class="muted">mediana ${cell.grade_median} · ≥8: ${Math.round(100 * (cell.grade_pass_rate || 0))}%</span>` : ""}
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
      let realModel = modelKey, realStage = state.stage;
      if (state.stage === "all") {
        const d = decomposeKey(modelKey);
        if (d) { realModel = d.model; realStage = d.stage; }
      }
      const stage = realStage;
      const m = modelMeta[modelKey];
      const cfg = baseMeta[realModel] || {};
      const diskModel = cfg.file_model_key ? fileMeta[cfg.file_model_key] : null;
      const stageMatrix = e4[stage]?.matrix?.[realModel] || {};

      document.getElementById("drawer-title").innerHTML =
        `<span style="font-size:13px; color:var(--fg-3)">${stage}</span>
         <span style="margin: 0 8px; color:var(--fg-3)">·</span>
         <span style="font-weight:600">${m?.short_name || modelKey}</span>
         <span style="margin: 0 8px; color:var(--fg-3)">·</span>
         <span class="muted">wszystkie prompty</span>`;

      const runtimeBlock = `
        <div class="drawer-grade-note" style="border-left-color: var(--accent)">
          <div style="font-weight:600; margin-bottom: 6px">Runtime config (Etap 5)</div>
          <div style="display:grid; grid-template-columns: 160px 1fr; gap: 4px var(--space-3); font-size:12px">
            ${diskModel ? `<div class="muted">plik na dysku</div><div><span class="mono">${escapeHtml(diskModel.display_name)}</span> · <span class="muted">${escapeHtml(diskModel.quant)}</span></div>` : ""}
            ${diskModel ? `<div class="muted">params</div><div><span class="mono">${escapeHtml(diskModel.params_str || "?")}</span> · <span class="muted">arch ${escapeHtml(diskModel.arch)}</span></div>` : ""}
            <div class="muted">thinking</div><div class="mono">${escapeHtml(cfg.thinking_mode || "—")}</div>
            <div class="muted">-ngl</div><div class="mono">${cfg.ngl ?? "—"}</div>
            ${cfg.n_cpu_moe != null ? `<div class="muted">--n-cpu-moe</div><div class="mono">${cfg.n_cpu_moe}</div>` : ""}
            <div class="muted">-c (ctx)</div><div class="mono">${cfg.ctx_used ?? "—"}</div>
            ${cfg.template_kwargs ? `<div class="muted">template kwargs</div><div class="mono" style="font-size:11px">${escapeHtml(JSON.stringify(cfg.template_kwargs))}</div>` : ""}
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
          ${prompts.map(p => ({ p, cell: stageMatrix[p.prompt_id] })).map(({ p, cell }) => `
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
        r.addEventListener("click", () => openCellDrawer(modelKey, r.dataset.prompt));
      });

      drawer.classList.add("open");
      backdrop.classList.add("show");
    }

    function renderPlaceholder(title, msg) {
      document.getElementById("lb-sub").textContent = "";
      document.getElementById("lb-container").innerHTML =
        `<div class="loading" style="padding:40px 24px; text-align:left; line-height:1.6">
           <div style="font-size:15px; font-weight:600; margin-bottom:8px">${title}</div>
           <div class="muted">${msg}</div>
         </div>`;
      document.getElementById("vb-container").innerHTML =
        `<div class="loading" style="padding:24px" class="muted">—</div>`;
      document.getElementById("hm-container").innerHTML =
        `<div class="loading" style="padding:24px" class="muted">—</div>`;
    }

    function renderAll() {
      const stage = state.stage;
      // WT and synthetic "all" are placeholders until WT is graded.
      if ((stage === "with_thinking" || stage === "all") && !graded.with_thinking) {
        const what = stage === "all" ? "Widok „all” (NT + WT łącznie)" : "Scena with_thinking";
        renderPlaceholder(
          `${what} — oceny WT jeszcze nie gotowe ⏳`,
          `Bieg with_thinking został wykonany (odpowiedzi w <code>result_etap4_with_thinking.jsonl</code>), ` +
          `ale ocena manualna 0–10 dla tej sceny jest w kolejnym kroku. ` +
          `Na razie dostępna jest scena <strong>no_thinking</strong> — przełącz w panelu wyżej.`
        );
        return;
      }
      const data = getStageData(stage);
      const sorted = sortLeaderboard(data.leaderboard);
      const sortLabel = `${state.sortBy} ${state.sortDir === "asc" ? "↑" : "↓"}`;
      document.getElementById("lb-sub").textContent =
        `${sorted.length} modeli · sort: ${sortLabel}`;
      const sortedData = { leaderboard: sorted, matrix: data.matrix };
      renderLeaderboard(document.getElementById("lb-container"), sorted, modelMeta, {
        onClickModel: openModelDrawer,
        onSortClick: setSort,
        currentSort: state.sortBy,
        currentDir: state.sortDir,
      });
      const vb = VB[state.vbX];
      document.getElementById("vb-sub").textContent = vb.sub;
      renderScatter(document.getElementById("vb-container"), sorted, modelMeta, {
        onClickModel: openModelDrawer, xKey: state.vbX, xLabel: vb.label, xFmt: vb.fmt,
        xLog: true, frontier: vb.frontier || "low", tooltipExtra: vb.extra,
        hScale: state.vbZoom ? 2 : 1,
      });
      renderHeatmap(document.getElementById("hm-container"), sortedData, modelMeta, prompts, { onClick: openCellDrawer });
      renderTruncHeatmap(document.getElementById("tr-container"), sortedData, modelMeta, prompts, { onClick: openCellDrawer });
    }

    renderAll();
  };
})();
