// Models view — all GGUF LLMs on disk, pure static info.
// Runtime config (ngl, n_cpu_moe, ctx_used, sampler) lives in experiment views.
(function () {
  const html = String.raw;

  function fmtCtx(n) {
    if (!n) return "—";
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1).replace(".0", "") + "M";
    if (n >= 1024) return (n / 1024).toFixed(0) + "K";
    return String(n);
  }


  function expUsageBadge(m) {
    if (!m.used_by_experiments || !m.used_by_experiments.length) {
      return `<span class="tag" title="brak runów z tym modelem">unused</span>`;
    }
    const exps = [...new Set(m.used_by_experiments.map(e => e.experiment))];
    return exps.map(e =>
      `<span class="tag" style="background:rgba(76,209,129,0.12); color:var(--good); border-color:rgba(76,209,129,0.4)" title="testowany w eksperymencie ${e}">exp ${e}</span>`
    ).join("");
  }

  function modelCard(m) {
    const ownerTag = m.is_unsloth
      ? `<span class="tag unsloth">unsloth</span>` : "";
    const offline = m.on_disk === false;
    const offlineTag = offline
      ? `<span class="tag" style="background:rgba(153,153,153,0.14); color:var(--muted); border-color:rgba(153,153,153,0.4)" title="plik GGUF nieobecny na dysku — karta odtworzona z cache (metadane z ostatniego skanu). Wyniki eksperymentów pozostają aktualne.">offline</span>`
      : "";
    const quirkTags = (m.quirk_tags || []).map(t => {
      const titles = {
        PLE: "Per-Layer Embeddings — część wag siedzi na CPU/RAM, ładowane just-in-time per warstwę. Tłumaczy różnicę między liczbą parametrów na dysku a 'effective' rozmiarem (E4B przy 7.5B fizycznych).",
        MTP: "Multi-Token Prediction — dodatkowe głowy predykcyjne (jak w DeepSeek-V3). Bez flag w llama-server siedzą bez ruchu; przy włączeniu self-speculative decoding mogą dać ~1.5-2× szybsze decode.",
        "inline-think": "Model rozumujący na bazie qwen2 (brak natywnego kanału reasoning) — wypluwa <think>…</think> inline w content. Backend 2.22 (common_chat_parse) wywala wtedy HTTP 500 na części próbek; fix = reasoning_format=none w requeście.",
        "hybrid-conv": "Hybryda LFM2: większość warstw to double-gated short-conv (LIV), tylko nieliczne to GQA attention. KV cache rośnie wyłącznie na warstwach attention — stąd bardzo mały KV/token mimo dużego modelu.",
      };
      return `<span class="tag quirk" title="${titles[t] || t}">${t}</span>`;
    }).join("");
    const moeBlock = m.n_experts ? html`
      <div class="card-stat"><span class="k">experts</span><span class="v">${m.n_experts} · aktywnych ${m.n_active_experts}</span></div>
    ` : "";

    // Sliding-window models (Gemma 4 etc.): KV/token is the INITIAL growth rate;
    // most layers cap at the window so KV @ ctx is far below ctx × KV/token.
    // Show init→effective and explain, so the two numbers aren't read as a bug.
    const kvCapped = m.kv_capped;
    const kvTokVal = kvCapped && m.kv_per_token_eff_q8_human
      ? `${m.kv_per_token_q8_human} → ${m.kv_per_token_eff_q8_human}`
      : (m.kv_per_token_q8_human || "—");
    const kvTokTitle = kvCapped
      ? `Sliding window (okno ${m.sliding_window} tok): wzrost początkowy ${m.kv_per_token_q8_human}/tok spada do ~${m.kv_per_token_eff_q8_human}/tok przy ctx natywnym, bo warstwy sliding przestają rosnąć po zapełnieniu okna. Dlatego ctx × KV/token ≠ KV @ ctx natywny.`
      : `Bajty KV cache na token (Q8), suma po warstwach attention. Dla modeli dense: KV @ ctx = ctx × KV/token.`;
    const kvCtxTitle = kvCapped
      ? `Realne KV przy ctx natywnym z uwzględnieniem capów sliding-window — NIE ctx × KV/token.`
      : `KV cache przy ctx natywnym (= ctx × KV/token dla modeli bez sliding window).`;
    const kvTokLabel = kvCapped ? "KV/token @Q8 (init→eff)" : "KV/token @Q8";

    return html`
      <div class="card" data-family="${m.family}" data-model="${m.model_key}" ${offline ? 'data-offline="1" style="opacity:0.72"' : ""}>
        <div class="card-title">
          <span class="family-bar" style="background:${m.family_color}"></span>
          <span class="name">${m.display_name}</span>
          ${ownerTag}${offlineTag}${quirkTags}${expUsageBadge(m)}
        </div>
        <div class="muted mono" style="font-size:11px">${m.model_key}</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2px var(--space-3); margin-top: 8px">
          <div class="card-stat"><span class="k">family</span><span class="v">${m.family}</span></div>
          <div class="card-stat"><span class="k">params</span><span class="v">${m.params_str || "?"}</span></div>
          <div class="card-stat"><span class="k">quant</span><span class="v mono">${m.quant}</span></div>
          <div class="card-stat"><span class="k">size</span><span class="v">${m.file_size_human}</span></div>
          <div class="card-stat"><span class="k">arch</span><span class="v mono">${m.arch}</span></div>
          <div class="card-stat"><span class="k">layers</span><span class="v">${m.n_layers ?? "—"}</span></div>
          <div class="card-stat" style="grid-column: 1 / -1"><span class="k">attention</span><span class="v">${m.attention_label || "—"}</span></div>
          <div class="card-stat"><span class="k">heads (Q/KV)</span><span class="v">${m.n_heads ?? "—"} / ${m.n_kv_heads ?? "—"}</span></div>
          <div class="card-stat"><span class="k">head_dim</span><span class="v">${m.head_dim ?? "—"}</span></div>
          ${moeBlock}
          <div class="card-stat"><span class="k">ctx natywny</span><span class="v">${fmtCtx(m.ctx_native)}</span></div>
          <div class="card-stat"><span class="k">embedding</span><span class="v">${m.embedding_length ?? "—"}</span></div>
          <div class="card-stat"><span class="k">${kvTokLabel}</span><span class="v" title="${kvTokTitle}">${kvTokVal}</span></div>
          <div class="card-stat"><span class="k">KV @ ctx natywny</span><span class="v" title="${kvCtxTitle}">${m.kv_at_ctx_native_q8_human || "—"}</span></div>
        </div>
        <details class="card-detail">
          <summary>metadane</summary>
          <div style="margin-top: 8px;">
            <div class="card-stat"><span class="k">deklaracja GGUF</span><span class="v mono">${m.size_label || "—"}</span></div>
            <div class="card-stat"><span class="k">liczba parametrów</span><span class="v mono">${m.params_count ? m.params_count.toLocaleString() : "—"}</span></div>
            <div class="card-stat" style="grid-column: 1 / -1"><span class="k">path</span></div>
            <div class="mono muted" style="font-size: 10.5px; word-break: break-all">${m.file_path}</div>
          </div>
        </details>
      </div>
    `;
  }

  window.renderModels = function (root) {
    const models = window.DATA.models;
    const families = [...new Set(models.map(m => m.family))].sort();

    const usedCount = models.filter(m => m.used_by_experiments.length).length;

    root.innerHTML = html`
      <h1 class="section-title">Models</h1>
      <p class="section-sub">
        ${models.length} GGUF LLM-ów wykrytych w <code>~\\.lmstudio\\models</code>
        (pomijając mmproj-* / CLIP). ${usedCount} z nich jest aktualnie używanych
        w eksperymentach; pozostałe leżą do dyspozycji na kolejne edycje.
        Wszystkie metadane są wyciągnięte z plików GGUF; liczba parametrów to dokładna suma
        wymiarów wszystkich tensorów modelu. Karty oznaczone <em>offline</em> to modele
        skasowane z dysku — metadane pochodzą z ostatniego skanu (cache), a ich wyniki
        eksperymentów pozostają aktualne.
      </p>

      <div class="controls">
        <label>family</label>
        <select id="family-filter">
          <option value="">wszystkie</option>
          ${families.map(f => `<option value="${f}">${f}</option>`).join("")}
        </select>
        <label>provider</label>
        <select id="quant-filter">
          <option value="">wszystkie</option>
          <option value="unsloth">tylko unsloth</option>
          <option value="non-unsloth">bez unsloth</option>
        </select>
        <label>usage</label>
        <select id="usage-filter">
          <option value="">wszystkie</option>
          <option value="used">użyte w eksperymentach</option>
          <option value="unused">jeszcze nieużywane</option>
        </select>
        <label>dysk</label>
        <select id="disk-filter">
          <option value="">wszystkie</option>
          <option value="ondisk">na dysku</option>
          <option value="offline">offline (skasowane)</option>
        </select>
        <label>sortuj</label>
        <select id="sort">
          <option value="params_desc">params ↓</option>
          <option value="params_asc">params ↑</option>
          <option value="size_desc">rozmiar ↓</option>
          <option value="size_asc">rozmiar ↑</option>
          <option value="kv_desc">KV/token ↓</option>
          <option value="name_asc">nazwa A→Z</option>
          <option value="name_desc">nazwa Z→A</option>
          <option value="default">domyślnie</option>
        </select>
        <input type="text" id="search" placeholder="szukaj…" style="flex: 1; min-width: 200px">
      </div>

      <div class="cards" id="cards"></div>
    `;

    const familySel = document.getElementById("family-filter");
    const quantSel = document.getElementById("quant-filter");
    const usageSel = document.getElementById("usage-filter");
    const diskSel = document.getElementById("disk-filter");
    const sortSel = document.getElementById("sort");
    const search = document.getElementById("search");
    const cardsEl = document.getElementById("cards");

    function rerender() {
      const fam = familySel.value;
      const quant = quantSel.value;
      const usage = usageSel.value;
      const disk = diskSel.value;
      const sort = sortSel.value;
      const q = search.value.trim().toLowerCase();

      let xs = models.slice();
      if (fam) xs = xs.filter(m => m.family === fam);
      if (quant === "unsloth") xs = xs.filter(m => m.is_unsloth);
      if (quant === "non-unsloth") xs = xs.filter(m => !m.is_unsloth);
      if (usage === "used") xs = xs.filter(m => m.used_by_experiments.length);
      if (usage === "unused") xs = xs.filter(m => !m.used_by_experiments.length);
      if (disk === "ondisk") xs = xs.filter(m => m.on_disk !== false);
      if (disk === "offline") xs = xs.filter(m => m.on_disk === false);
      if (q) xs = xs.filter(m =>
        m.model_key.toLowerCase().includes(q) ||
        m.display_name.toLowerCase().includes(q) ||
        m.arch.toLowerCase().includes(q) ||
        (m.params_str || "").toLowerCase().includes(q)
      );
      const nameOf = m => (m.model_key.split("/").pop() || m.model_key).toLowerCase();
      const sorters = {
        size_desc: (a, b) => b.file_size_bytes - a.file_size_bytes,
        size_asc:  (a, b) => a.file_size_bytes - b.file_size_bytes,
        params_desc: (a, b) => (b.params_count || 0) - (a.params_count || 0),
        params_asc:  (a, b) => (a.params_count || 0) - (b.params_count || 0),
        kv_desc: (a, b) => (b.kv_per_token_q8_bytes || 0) - (a.kv_per_token_q8_bytes || 0),
        name_asc:  (a, b) => nameOf(a).localeCompare(nameOf(b)),
        name_desc: (a, b) => nameOf(b).localeCompare(nameOf(a)),
      };
      if (sorters[sort]) xs.sort(sorters[sort]);
      cardsEl.innerHTML = xs.map(modelCard).join("");
    }

    familySel.addEventListener("change", rerender);
    quantSel.addEventListener("change", rerender);
    usageSel.addEventListener("change", rerender);
    diskSel.addEventListener("change", rerender);
    sortSel.addEventListener("change", rerender);
    search.addEventListener("input", rerender);
    sortSel.value = "params_desc";
    rerender();
  };
})();
