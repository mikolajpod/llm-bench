// KV cache view (2026-11-22) — KV-cache quantization study on Etap 5 models (RTX 3090, own llama.cpp b11840 = LMS 2.64).
// Layer 1: KLD vs f16 (llama-perplexity, uniform method). Layer 2: long-context task (8 auto-checked questions,
// 32k–256k, 3 haystacks, NT) + WT control. Data: window.DATA.kvq (build_kvq_data.py). Report: eval_kvq/*_report.md.
// Colours: f16 = blue, q8_0 = aqua, q4_0 = orange (first three categorical slots, validated all-pairs on the dark panel);
// no rotation = dashed; noise floor / NT = grey. Sequential = one blue ramp, diverging = red ↔ grey ↔ blue.
(function () {
  const html = String.raw;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SVG_NS = "http://www.w3.org/2000/svg";
  function el(t, a = {}, p = null) {
    const e = document.createElementNS(SVG_NS, t);
    for (const [k, v] of Object.entries(a)) if (v != null) e.setAttribute(k, String(v));
    if (p) p.appendChild(e);
    return e;
  }
  const COL = { f16: "#3987e5", q8_0: "#199e70", q4_0: "#d95926", grey: "#8a919c", bf16: "#8a919c" };
  const KVNAME = { f16: "f16", q8_0: "q8_0", q8_0_norot: "q8_0 bez rotacji", q4_0: "q4_0", q4_0_norot: "q4_0 bez rotacji" };
  const CTXL = { "16384": "16k", "32768": "32k", "65536": "64k", "131072": "128k" };
  const SIZE2CTX = { "32k": "32768", "64k": "65536", "128k": "131072" };
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const f1 = v => v == null ? "–" : v.toFixed(1);
  const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(1);

  // ── tooltip (one shared div) ──
  let TIP = null;
  function tipOn(node, fn) {
    node.addEventListener("mousemove", e => {
      if (!TIP) { TIP = document.createElement("div"); TIP.className = "kvq-tip"; document.body.appendChild(TIP); }
      TIP.innerHTML = fn(); TIP.style.display = "block";
      const w = TIP.offsetWidth, h = TIP.offsetHeight;
      TIP.style.left = Math.min(e.clientX + 14, innerWidth - w - 8) + "px";
      TIP.style.top = (e.clientY + 14 + h > innerHeight ? e.clientY - h - 10 : e.clientY + 14) + "px";
    });
    node.addEventListener("mouseleave", () => { if (TIP) TIP.style.display = "none"; });
  }

  // ── colour ramps ──
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(",")})`; };
  const SEQ = ["#0d366b", "#104281", "#184f95", "#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef", "#9ec5f4", "#b7d3f6", "#cde2fb"];
  function seq(t) {           // 0..1 → dark (recedes) .. light
    t = Math.max(0, Math.min(1, t)) * (SEQ.length - 1);
    const i = Math.min(SEQ.length - 2, Math.floor(t));
    return mix(SEQ[i], SEQ[i + 1], t - i);
  }
  const seqText = t => t > 0.62 ? "#0a0a0a" : "#e7ebf2";
  function div(t) {           // -1..1 → red .. grey .. blue
    t = Math.max(-1, Math.min(1, t));
    return t >= 0 ? (t < 0.6 ? mix("#383835", "#3987e5", t / 0.6) : mix("#3987e5", "#9ec5f4", (t - 0.6) / 0.4))
                  : (-t < 0.6 ? mix("#383835", "#e66767", -t / 0.6) : mix("#e66767", "#f4b0b0", (-t - 0.6) / 0.4));
  }
  const divText = t => Math.abs(t) > 0.75 ? "#0a0a0a" : "#e7ebf2";

  // ── layer-2 index: stage|model|kv|size → {hay: [records]} (ok records only; truncated = score 0) ──
  function indexL2(D) {
    const I = {};
    for (const r of D.l2) {
      if (!r.ok) continue;
      const k = [r.stage, r.m, r.kv, r.size].join("|");
      ((I[k] = I[k] || {})[r.hay] = I[k][r.hay] || []).push(r);
    }
    return I;
  }
  function cell(I, stage, m, kv, size, hays = null) {
    const g = I[[stage, m, kv, size].join("|")];
    if (!g) return null;
    const hs = Object.entries(g).filter(([h]) => !hays || hays.includes(+h))
      .map(([h, rs]) => ({ hay: +h, mean: mean(rs.map(r => r.score)), rs }));
    if (!hs.length) return null;
    const ms = hs.map(h => h.mean);
    return { mean: mean(ms), min: Math.min(...ms), max: Math.max(...ms), hays: hs };
  }
  function cellTip(D, m, kv, size, c, stage) {
    const fails = {};
    let n = 0, tr = 0;
    for (const h of c.hays) for (const r of h.rs) { n++; if (r.trunc) tr++; for (const q of r.fails) fails[q] = (fails[q] || 0) + 1; }
    return `<b>${esc(D.labels[m] || m)}</b> · ${size} · ${KVNAME[kv] || kv} · ${stage === "with_thinking" ? "z myśleniem" : "bez myślenia"}<br>` +
      `średnia ${c.mean.toFixed(2)} / 8 (stogi z wagą 1)<br>` +
      c.hays.map(h => `stóg ${h.hay}: ${h.rs.map(r => r.trunc ? "0✂" : r.score).join(", ")}`).join("<br>") +
      (tr ? `<br>ucięte na limicie: ${tr}/${n}` : "") +
      `<br><span class="muted">błędy: ${Object.entries(fails).sort().map(([q, k]) => `${q}×${k}`).join(" ") || "brak"}</span>`;
  }

  // ── small-multiple line chart ──
  function lineSM(box, o) {
    const W = 300, H = 196, P = { l: 40, r: 10, t: 22, b: 26 };
    const pw = W - P.l - P.r, ph = H - P.t - P.b;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", class: "kvq-sm" }, box);
    const X = i => P.l + 14 + (o.xs.length === 1 ? (pw - 28) / 2 : i / (o.xs.length - 1) * (pw - 28));
    const [y0, y1] = o.y.dom;
    const tr = o.y.log ? v => Math.log10(v) : v => v;
    const Y = v => P.t + ph - (tr(Math.max(v, y0)) - tr(y0)) / (tr(y1) - tr(y0)) * ph;
    el("text", { x: P.l, y: 14, class: "kvq-sm-title" }, svg).textContent = o.title;
    for (const t of o.y.ticks) {
      el("line", { x1: P.l, x2: W - P.r, y1: Y(t), y2: Y(t), stroke: "#23282f", "stroke-dasharray": "2 4" }, svg);
      el("text", { x: P.l - 5, y: Y(t) + 3.5, "text-anchor": "end", class: "sc-axis-text", "font-size": 10 }, svg).textContent = o.y.fmt(t);
    }
    o.xs.forEach((x, i) => el("text", { x: X(i), y: H - 8, "text-anchor": "middle", class: "sc-axis-text", "font-size": 10 }, svg).textContent = x);
    if (o.ref != null) el("line", { x1: P.l, x2: W - P.r, y1: Y(o.ref), y2: Y(o.ref), stroke: COL.grey, "stroke-width": 1.5, opacity: 0.8 }, svg);
    for (const s of o.series) {
      const pts = s.points.map((p, i) => p && p.y != null ? { ...p, i } : null).filter(Boolean);
      if (s.band) {
        const b = pts.filter(p => p.lo != null);
        if (b.length > 1) el("path", { d: b.map((p, k) => `${k ? "L" : "M"}${X(p.i)},${Y(p.hi)}`).join("") +
          b.slice().reverse().map(p => `L${X(p.i)},${Y(p.lo)}`).join("") + "Z", fill: s.color, opacity: 0.16 }, svg);
      }
      if (!s.noLine && pts.length > 1) el("path", { d: pts.map((p, k) => `${k ? "L" : "M"}${X(p.i)},${Y(p.y)}`).join(""), fill: "none",
        stroke: s.color, "stroke-width": 2, "stroke-dasharray": s.dash ? "5 4" : null, opacity: s.dash ? 0.85 : 1 }, svg);
      for (const p of pts) {
        const g = el("g", { class: "sc-point" }, svg);
        if (s.whisk && p.lo != null) el("line", { x1: X(p.i), x2: X(p.i), y1: Y(p.lo), y2: Y(p.hi), stroke: s.color, "stroke-width": 1.5, opacity: 0.7 }, g);
        el("circle", { cx: X(p.i), cy: Y(p.y), r: 10, fill: "transparent" }, g);
        el("circle", { cx: X(p.i), cy: Y(p.y), r: s.ring ? 4.5 : 3.5, fill: s.ring ? "#181b21" : s.color, stroke: s.ring ? s.color : "#181b21",
                       "stroke-width": 2 }, g);
        if (p.tip) tipOn(g, p.tip);
      }
    }
  }

  // ── heatmap table (rows × cols) ──
  function heat(box, rows, cols, fn, opt = {}) {
    const t = document.createElement("table");
    t.className = "kvq-heat";
    t.innerHTML = `<thead><tr><th></th>${cols.map(c => `<th>${esc(c.label || c)}</th>`).join("")}</tr></thead>`;
    const tb = document.createElement("tbody");
    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<th>${esc(r.label)}</th>`;
      for (const c of cols) {
        const td = document.createElement("td");
        const v = fn(r, c);
        if (!v) { td.textContent = "–"; td.className = "kvq-na"; }
        else {
          td.textContent = v.text; td.style.background = v.bg; td.style.color = v.fg;
          if (v.tip) tipOn(td, v.tip);
        }
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    box.innerHTML = ""; box.appendChild(t);
    if (opt.note) box.insertAdjacentHTML("beforeend", `<p class="muted kvq-note">${opt.note}</p>`);
  }

  function switcher(box, opts, cur, onChange) {
    box.className = "stage-switch kvq-switch";
    box.innerHTML = opts.map(([k, l]) => `<button data-k="${k}">${l}</button>`).join("");
    const sync = v => box.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.k === v));
    sync(cur);
    box.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { sync(b.dataset.k); onChange(b.dataset.k); }));
  }
  const legend = items => items.map(([c, l, dash]) =>
    `<span><svg width="22" height="10"><line x1="1" x2="21" y1="5" y2="5" stroke="${c}" stroke-width="2.5" ${dash ? 'stroke-dasharray="4 3"' : ""}/></svg> ${l}</span>`).join("");

  window.renderKVQ = function (root) {
    const D = window.DATA.kvq;
    if (!D) { root.innerHTML = `<div class="loading">brak data/kvq.js — uruchom build_app_data.py</div>`; return; }
    const I = indexL2(D);
    const ORDER = D.order, lab = m => D.labels[m] || m;
    const st = { kldMode: APP_STATE.get("kvqKld", "x"), heat: APP_STATE.get("kvqHeat", "f16") };

    root.innerHTML = html`
      <h1 class="section-title">KV cache — kwantyzacja pamięci kontekstu a użyteczny kontekst</h1>
      <p class="section-sub">
        Pamięć KV (klucze i wartości uwagi dla każdego tokena kontekstu) rośnie liniowo z długością; q8_0 zajmuje ~½, q4_0 ~¼ pamięci f16.
        Pytanie: <strong>ile jakości kosztuje kwantyzacja KV i jak długi kontekst jest naprawdę użyteczny</strong>.
        <strong>RTX 3090</strong>, własny build llama.cpp b11840 (bit-identyczny z LM Studio 2.64), flash attention, 18–22.11.2026.
        Rotacja Hadamarda jest w llama.cpp domyślnie włączona dla kwantyzowanego KV (f16 jej nie ma); wariant „bez rotacji” = <code>LLAMA_ATTN_ROT_DISABLE=1</code>.
        <strong>Warstwa 1 (KLD):</strong> rozbieżność rozkładu następnego tokena względem f16, ostatnie 4096 pozycji × 2 fragmenty przy każdej długości;
        podłoga szumu = bf16. <strong>Warstwa 2 (zadanie):</strong> fikcyjne archiwum z 8 pytaniami sprawdzanymi automatycznie, 32k–256k,
        3 różne stogi, tryb bez myślenia (+ kontrola z myśleniem). Raporty: <code>eval_kvq/kld_report.md</code>, <code>eval_kvq/l2_report.md</code>.
      </p>
      <div class="e3-grid">
        <section class="panel">
          <h2>Wnioski</h2>
          <ul class="kvq-concl">
            <li><b>q8_0 ≈ f16.</b> KLD na poziomie podłogi szumu do 64k (1,1–3× przy 128k); w zadaniu różnica ≤ 0,7 pkt na każdej długości do 256k.</li>
            <li><b>q4_0: bezpieczne do 128k, przy 256k zależnie od modelu.</b> KLD 2,5–22× podłogi, zwykle płaskie z długością.
                W zadaniu (wszystkie 12 modeli, 3 stogi) Qwen3.8, Qwen3.6, Groot, Gemma 26B, Gemma 12B i Qwen3.5 9B bez straty;
                E4B i Gemma 26B QAT najwyżej −0,7; Qwen3-Coder i Gemma 31B ~−0,7 przy 64k/256k; <b>Lightning −1,2 przy 256k</b> — jedyny model,
                którego KLD przy q4 rośnie z długością (3,3 → 16× podłogi). Obie warstwy wskazują ten sam model.</li>
            <li><b>Rotacja:</b> przy q4 zawsze pomaga w KLD (+6–185%); przy q8 przy 128k lekko szkodzi (11/12 modeli), ale w zadaniu nie widać żadnej różnicy.</li>
            <li><b>Długość (f16, 3 stogi):</b> Gemma 31B, Qwen3.8, Qwen3.6, Groot i Gemma 26B bez trendu do 256k; Gemma 12B, Muse i E4B wyraźnie słabną;
                sam stóg zmienia wynik o 1–3 pkt, więc pojedyncze komórki czytaj ostrożnie.</li>
            <li><b>Myślenie</b> podnosi poziom (Qwen3.6, Lightning ~+2 pkt), ale efekt q4 jest taki sam jak bez myślenia — tryb bez myślenia dobrze mierzy wpływ KV.
                Wyjątek: Qwen3.8 z myśleniem przepisuje log do liczenia i wyczerpuje limit 16k.</li>
            <li><b>Praktyka:</b> na dużych modelach mniejszy KV mieści cały model na GPU — przy 128k generowanie z q4 jest 7× (Qwen3.8) i 36× (Gemma 31B) szybsze niż z f16.
                Przy długich odpowiedziach to q8/q4 decyduje, czy duży kontekst jest w ogóle użyteczny.
                Gdy f16 się mieści, q4 nic nie przyspiesza: wczytywanie bez zmian, generowanie o 9–41% wolniejsze (najwięcej szybkie MoE).</li>
          </ul>
          <p class="muted kvq-note">Rekomendacja: f16, gdy się mieści → q8_0 (z domyślną rotacją), gdy nie → q4_0 do 128k; przy 256k q4 tylko na modelach,
            które to wytrzymują (Qwen3.8, Qwen3.6, Groot, Gemma 26B, Gemma 12B, Qwen3.5 9B), nigdy na Lightningu.</p>
        </section>

        <section class="panel">
          <h2>1 · KLD względem f16 w funkcji długości <span class="panel-sub" id="kq-kld-sub"></span></h2>
          <div class="kvq-ctrl"><div id="kq-kld-sw"></div><div class="legend-row" id="kq-kld-leg"></div></div>
          <div class="kvq-sm-grid" id="kq-kld"></div>
          <p class="muted kvq-note">Wąsy = ±SE z logu llama-perplexity (2 ciągłe fragmenty, więc SE zaniża niepewność). Muse: KLD na tych samych wagach co @low.</p>
        </section>

        <section class="panel">
          <h2>2 · Zysk z rotacji Hadamarda <span class="panel-sub">KLD bez rotacji ÷ z rotacją − 1; niebieski = rotacja pomaga, czerwony = szkodzi</span></h2>
          <div class="kvq-two">
            <div><h3 class="kvq-h3">q8_0</h3><div id="kq-rot8"></div></div>
            <div><h3 class="kvq-h3">q4_0</h3><div id="kq-rot4"></div></div>
          </div>
          <h3 class="kvq-h3" style="margin-top:14px">Kwantyzacja wag a podłoga szumu (16k)</h3>
          <div id="kq-wq"></div>
        </section>

        <section class="panel">
          <h2>3 · Zadanie: wynik /8 dla modelu i długości <span class="panel-sub" id="kq-heat-sub"></span></h2>
          <div class="kvq-ctrl"><div id="kq-heat-sw"></div></div>
          <div id="kq-heat"></div>
        </section>

        <section class="panel">
          <h2>4 · Użyteczny kontekst: krzywe długości <span class="panel-sub">bez myślenia · linia = średnia 3 stogów, pasmo = zakres między stogami · kółka = z myśleniem</span></h2>
          <div class="legend-row">${legend([[COL.f16, "f16"], [COL.q8_0, "q8_0 (1 stóg)"], [COL.q4_0, "q4_0", true]])}
            <span><svg width="14" height="12"><circle cx="7" cy="6" r="4.5" fill="#181b21" stroke="${COL.f16}" stroke-width="2"/></svg> z myśleniem (2 stogi × 2 seedy)</span></div>
          <div class="kvq-sm-grid" id="kq-len"></div>
        </section>

        <section class="panel">
          <h2>5 · Czy KLD przewiduje stratę w zadaniu? <span class="panel-sub">punkt = model × długość; oś X: KLD (log), oś Y: wynik kwantyzacji − wynik f16</span></h2>
          <div class="legend-row">${legend([[COL.q8_0, "q8_0 (stóg 11)"], [COL.q4_0, "q4_0 (3 stogi)"]])}</div>
          <div id="kq-sc"></div>
        </section>

        <section class="panel">
          <h2>6 · Z myśleniem a bez <span class="panel-sub">ten sam stóg (11 i 21), szary = bez myślenia, kolor = z myśleniem; ✂ = odpowiedzi ucięte na limicie 16k</span></h2>
          <div id="kq-wt"></div>
          <p class="muted kvq-note">Pominięte: Gemma 31B i Qwen3.8 z f16 przy 128k — nie mieszczą się w całości na GPU i generują 0,5–2,5 tok/s (godziny na jedną odpowiedź z myśleniem).</p>
        </section>

        <section class="panel">
          <h2>7 · Praktyka: czas wczytania promptu i prędkość generowania <span class="panel-sub">bez myślenia, stóg 11, seed 43, domyślne zegary (bez blokady P3)</span></h2>
          <div class="kvq-ctrl"><div id="kq-pr-sw"></div><div class="legend-row">${legend([[COL.f16, "f16"], [COL.q8_0, "q8_0"], [COL.q4_0, "q4_0"]])}</div></div>
          <div class="kvq-two">
            <div><h3 class="kvq-h3">wczytanie promptu [min]</h3><div id="kq-pp"></div></div>
            <div><h3 class="kvq-h3">generowanie [tok/s]</h3><div id="kq-tg"></div></div>
          </div>
          <p class="muted kvq-note">„GPU” = cały model w VRAM (<code>-ngl -1</code>); „częściowo” = część warstw lub ekspertów na CPU — wtedy uwaga dla tych warstw liczy się na procesorze po całym kontekście.</p>
        </section>

        <section class="panel">
          <h2>8 · Które pytania psuje długi kontekst <span class="panel-sub">f16, bez myślenia, wszystkie modele, stogi i seedy: odsetek poprawnych</span></h2>
          <div id="kq-q"></div>
        </section>
      </div>`;

    // ── 1. KLD small multiples ──
    function renderKLD() {
      const mode = st.kldMode;  // "x" = multiple of noise floor, "abs" = absolute KLD
      const vars = [["q8_0", false], ["q8_0_norot", true], ["q4_0", false], ["q4_0_norot", true]];
      const box = document.getElementById("kq-kld"); box.innerHTML = "";
      document.getElementById("kq-kld-sub").textContent = mode === "x" ? "wielokrotność podłogi szumu (bf16), skala log" : "KLD bezwzględne, skala log";
      document.getElementById("kq-kld-leg").innerHTML = legend([[COL.q8_0, "q8_0"], [COL.q8_0, "q8_0 bez rotacji", true], [COL.q4_0, "q4_0"],
        [COL.q4_0, "q4_0 bez rotacji", true], [COL.grey, mode === "x" ? "podłoga szumu (1×)" : "bf16 (podłoga szumu)"]]);
      const y = mode === "x"
        ? { log: true, dom: [0.5, 60], ticks: [1, 3, 10, 30], fmt: v => v + "×" }
        : { log: true, dom: [1e-4, 1], ticks: [1e-4, 1e-3, 1e-2, 1e-1, 1], fmt: v => v >= 0.1 ? String(v) : v.toExponential(0).replace("e-", "e−") };
      for (const m of ORDER) {
        const K = D.kld[m]; if (!K) continue;
        const floor = c => K.bf16?.[c]?.[0];
        const val = (v, c) => { const r = K[v]?.[c]; if (!r) return null; return mode === "x" ? r[0] / floor(c) : r[0]; };
        const series = vars.map(([v, dash]) => ({
          color: COL[v.replace("_norot", "")], dash, whisk: true,
          points: D.kld_ctx.map(c => {
            const r = K[v]?.[c]; if (!r) return null;
            const f = mode === "x" ? floor(c) : 1;
            return { y: r[0] / f, lo: Math.max(1e-6, (r[0] - r[1]) / f), hi: (r[0] + r[1]) / f,
              tip: () => `<b>${esc(lab(m))}</b> · ${CTXL[c]} · ${KVNAME[v]}<br>KLD ${r[0].toFixed(5)} ± ${r[1].toFixed(5)}` +
                `<br>${(r[0] / floor(c)).toFixed(1)}× podłogi (bf16 ${floor(c).toFixed(5)})<br>ten sam top-1: ${r[2].toFixed(2)}% · p99 ${r[3].toFixed(4)}` };
          }) }));
        if (mode === "abs") series.unshift({ color: COL.grey, points: D.kld_ctx.map(c => K.bf16?.[c] ? { y: K.bf16[c][0],
          tip: () => `<b>${esc(lab(m))}</b> · ${CTXL[c]} · bf16 (podłoga szumu)<br>KLD ${K.bf16[c][0].toFixed(5)}` } : null) });
        const d = document.createElement("div"); box.appendChild(d);
        lineSM(d, { title: lab(m), xs: D.kld_ctx.map(c => CTXL[c]), y, ref: mode === "x" ? 1 : null, series });
      }
    }
    switcher(document.getElementById("kq-kld-sw"), [["x", "× podłoga szumu"], ["abs", "KLD bezwzględne"]], st.kldMode,
      v => { st.kldMode = v; APP_STATE.set("kvqKld", v); renderKLD(); });
    renderKLD();

    // ── 2. rotation gain heatmaps + weight-quant table ──
    for (const [bits, id] of [["q8_0", "kq-rot8"], ["q4_0", "kq-rot4"]]) {
      heat(document.getElementById(id), ORDER.map(m => ({ m, label: lab(m) })), D.kld_ctx.map(c => ({ c, label: CTXL[c] })), (r, c) => {
        const K = D.kld[r.m], a = K?.[bits]?.[c.c], b = K?.[bits + "_norot"]?.[c.c];
        if (!a || !b) return null;
        const g = (b[0] / a[0] - 1) * 100, t = Math.max(-1, Math.min(1, g / 100));
        return { text: (g > 0 ? "+" : "") + Math.round(g) + "%", bg: div(t), fg: divText(t),
          tip: () => `<b>${esc(lab(r.m))}</b> · ${c.label} · ${bits}<br>z rotacją ${a[0].toFixed(5)} ± ${a[1].toFixed(5)}<br>bez rotacji ${b[0].toFixed(5)} ± ${b[1].toFixed(5)}` };
      });
    }
    {
      const rows = D.weight_pairs.map(([hi, lo]) => {
        const f = (m, v) => D.kld[m]?.[v]?.["16384"]?.[0];
        return `<tr><td>${esc(lab(hi))} → ${esc(lab(lo).split(" ").pop())}</td>
          <td style="text-align:right">${f(hi, "bf16").toFixed(5)} → ${f(lo, "bf16").toFixed(5)} (×${(f(lo, "bf16") / f(hi, "bf16")).toFixed(1)})</td>
          <td style="text-align:right">${f(hi, "q4_0").toFixed(4)} → ${f(lo, "q4_0").toFixed(4)}</td></tr>`;
      }).join("");
      document.getElementById("kq-wq").innerHTML = `<table class="quant-contrasts"><thead><tr><th>wagi</th><th>podłoga szumu (bf16)</th><th>KLD q4_0</th></tr></thead>
        <tbody>${rows}</tbody></table><p class="muted kvq-note">Słabsza kwantyzacja wag podnosi podłogę szumu (2–6×), a bezwzględny przyrost od q4 KV jest podobny
        — dlatego „wielokrotność podłogi” trzeba porównywać przy tej samej kwantyzacji wag.</p>`;
    }

    // ── 3. task heatmap ──
    const H11 = [11], HALL = [11, 21, 31];
    function renderHeat() {
      const mode = st.heat;
      const sub = { f16: "f16 · bez myślenia · średnia 3 stogów", q8_0: "q8_0 · bez myślenia · tylko stóg 11 (3 seedy)",
        q4_0: "q4_0 · bez myślenia · średnia 3 stogów", d4: "q4_0 − f16 · te same stogi", d8: "q8_0 − f16 · stóg 11",
        wt: "z myśleniem · stogi 11 i 21 × 2 seedy · tylko 32k i 128k" }[mode];
      document.getElementById("kq-heat-sub").textContent = sub;
      const cols = D.sizes.map(s => ({ s, label: s }));
      heat(document.getElementById("kq-heat"), ORDER.map(m => ({ m, label: lab(m) })), cols, (r, c) => {
        if (mode === "d4" || mode === "d8") {
          const kv = mode === "d4" ? "q4_0" : "q8_0", hs = mode === "d4" ? HALL : H11;
          const a = cell(I, "no_thinking", r.m, kv, c.s, hs), b = cell(I, "no_thinking", r.m, "f16", c.s, hs);
          if (!a || !b) return null;
          const d = a.mean - b.mean, t = Math.max(-1, Math.min(1, d / 2));
          return { text: sgn(d), bg: div(t), fg: divText(t),
            tip: () => cellTip(D, r.m, kv, c.s, a, "no_thinking") + `<br>f16: ${b.mean.toFixed(2)} → różnica ${sgn(d)}` };
        }
        const stage = mode === "wt" ? "with_thinking" : "no_thinking", kv = mode === "wt" ? "f16" : mode;
        const x = cell(I, stage, r.m, kv, c.s, mode === "q8_0" ? H11 : null);
        if (!x) return null;
        const t = (x.mean - 1.5) / 6;   // observed range ~1.5–7.5 → full ramp
        return { text: f1(x.mean), bg: seq(t), fg: seqText(t), tip: () => cellTip(D, r.m, kv, c.s, x, stage) };
      }, { note: {
          wt: "Z myśleniem zmierzone tylko 4 modele (f16; q4 w panelu 6). Puste = nie mierzone lub pominięte.",
          q8_0: "q8_0 zmierzone dla 4 modeli, które nie mieszczą f16 w VRAM, i Lightninga (32k–256k) oraz dla 3 modeli z testu rotacji (64k i 128k). Puste = nie mierzone.",
          d8: "q8_0 zmierzone dla 4 modeli, które nie mieszczą f16 w VRAM, i Lightninga (32k–256k) oraz dla 3 modeli z testu rotacji (64k i 128k). Puste = nie mierzone.",
          d4: "Czerwony = q4 gorzej, niebieski = lepiej. Pojedynczy stóg zmienia wynik o ±1–2 pkt, więc różnice do ~0,7 to szum. E4B i Muse mają natywnie maks. 128k.",
        }[mode] || "Kolor: jasny = lepiej. Najedź na komórkę: wyniki każdego stogu i seeda oraz pytania z błędami. E4B i Muse mają natywnie maks. 128k." });
    }
    switcher(document.getElementById("kq-heat-sw"), [["f16", "f16"], ["q8_0", "q8_0"], ["q4_0", "q4_0"], ["d4", "q4 − f16"], ["d8", "q8 − f16"], ["wt", "z myśleniem"]],
      st.heat, v => { st.heat = v; APP_STATE.set("kvqHeat", v); renderHeat(); });
    renderHeat();

    // ── 4. length curves ──
    {
      const box = document.getElementById("kq-len");
      for (const m of ORDER) {
        const mk = (stage, kv, hays, extra = {}) => ({ ...extra, color: COL[kv], points: D.sizes.map(s => {
          const c = cell(I, stage, m, kv, s, hays); if (!c) return null;
          return { y: c.mean, lo: c.min, hi: c.max, tip: () => cellTip(D, m, kv, s, c, stage) }; }) });
        const series = [mk("no_thinking", "f16", null, { band: true }), mk("no_thinking", "q4_0", HALL, { dash: true }),
          mk("no_thinking", "q8_0", H11, { noLine: false, dash: false }), mk("with_thinking", "f16", null, { ring: true, noLine: true }),
          mk("with_thinking", "q4_0", null, { ring: true, noLine: true })];
        series[2].points = series[2].points.map(p => p && { ...p, lo: null });  // q8: single haystack, no band
        if (!series.some(s => s.points.some(Boolean))) continue;
        const d = document.createElement("div"); box.appendChild(d);
        lineSM(d, { title: lab(m), xs: D.sizes, y: { log: false, dom: [0, 8], ticks: [0, 2, 4, 6, 8], fmt: String }, series });
      }
    }

    // ── 5. KLD vs task scatter ──
    {
      const pts = [];
      for (const m of ORDER) for (const s of ["32k", "64k", "128k"]) for (const [kv, hs] of [["q8_0", H11], ["q4_0", HALL]]) {
        const a = cell(I, "no_thinking", m, kv, s, hs), b = cell(I, "no_thinking", m, "f16", s, hs);
        const k = D.kld[m]?.[kv]?.[SIZE2CTX[s]];
        if (a && b && k) pts.push({ m, s, kv, x: k[0], y: a.mean - b.mean, xf: k[0] / D.kld[m].bf16[SIZE2CTX[s]][0] });
      }
      const W = 900, H = 340, P = { l: 52, r: 20, t: 14, b: 40 }, pw = W - P.l - P.r, ph = H - P.t - P.b;
      const box = document.getElementById("kq-sc");
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", class: "scatter-svg", style: "max-width:1000px" }, box);
      const lx0 = -4, lx1 = 0, X = v => P.l + (Math.log10(v) - lx0) / (lx1 - lx0) * pw;
      const y0 = -2.5, y1 = 1.5, Y = v => P.t + (y1 - v) / (y1 - y0) * ph;
      for (let e = lx0; e <= lx1; e++) {
        el("line", { x1: X(10 ** e), x2: X(10 ** e), y1: P.t, y2: H - P.b, stroke: "#23282f", "stroke-dasharray": "2 4" }, svg);
        el("text", { x: X(10 ** e), y: H - P.b + 16, "text-anchor": "middle", class: "sc-axis-text" }, svg).textContent = e === 0 ? "1" : `1e${e}`.replace("-", "−");
      }
      for (let v = -2; v <= 1; v++) {
        el("line", { x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v), stroke: v === 0 ? COL.grey : "#23282f", "stroke-dasharray": v === 0 ? null : "2 4", opacity: v === 0 ? 0.7 : 1 }, svg);
        el("text", { x: P.l - 8, y: Y(v) + 4, "text-anchor": "end", class: "sc-axis-text" }, svg).textContent = v > 0 ? "+" + v : String(v).replace("-", "−");
      }
      el("text", { x: P.l + pw / 2, y: H - 6, "text-anchor": "middle", class: "sc-axis-title" }, svg).textContent = "KLD względem f16 (skala log)";
      el("text", { x: -P.t - ph / 2, y: 14, "text-anchor": "middle", class: "sc-axis-title", transform: "rotate(-90)" }, svg).textContent = "różnica wyniku [pkt /8]";
      const jit = p => (p.s === "32k" ? -3 : p.s === "128k" ? 3 : 0);
      for (const p of pts) {
        const g = el("g", { class: "sc-point" }, svg);
        const cx = X(p.x), cy = Y(p.y) + jit(p);
        el("circle", { cx, cy, r: 10, fill: "transparent" }, g);
        el("circle", { cx, cy, r: 4.5, fill: COL[p.kv], stroke: "#181b21", "stroke-width": 2, opacity: 0.9 }, g);
        if (p.y <= -0.9) el("text", { x: cx + 7, y: cy + 4, class: "sc-label", "font-size": 10 }, g).textContent = `${lab(p.m).split(" ").slice(0, 2).join(" ")} ${p.s}`;
        tipOn(g, () => `<b>${esc(lab(p.m))}</b> · ${p.s} · ${p.kv}<br>KLD ${p.x.toFixed(5)} (${p.xf.toFixed(1)}× podłogi)<br>wynik − f16: ${sgn(p.y)}`);
      }
      box.insertAdjacentHTML("beforeend", `<p class="muted kvq-note">Korelacja jest słaba: do KLD ~0,05 różnice mieszczą się w szumie zadania (±0,7).
        Wyraźne straty pojawiają się dopiero przy najwyższych KLD (Lightning q4) i przy 256k, dla którego KLD nie mierzono.</p>`);
    }

    // ── 6. WT vs NT dumbbell ──
    {
      const rows = [];
      const wtModels = ORDER.filter(m => D.l2.some(r => r.stage === "with_thinking" && r.m === m));
      for (const m of wtModels) for (const kv of ["f16", "q4_0"]) for (const s of ["32k", "128k"]) {
        const w = cell(I, "with_thinking", m, kv, s), n = cell(I, "no_thinking", m, kv, s, [11, 21]);
        rows.push({ m, kv, s, w, n });
      }
      const W = 900, RH = 22, P = { l: 250, r: 70, t: 22, b: 30 }, H = P.t + P.b + rows.length * RH, pw = W - P.l - P.r;
      const box = document.getElementById("kq-wt");
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", class: "scatter-svg", style: "max-width:1000px" }, box);
      const X = v => P.l + v / 8 * pw;
      for (let v = 0; v <= 8; v += 2) {
        el("line", { x1: X(v), x2: X(v), y1: P.t - 6, y2: H - P.b, stroke: "#23282f", "stroke-dasharray": "2 4" }, svg);
        el("text", { x: X(v), y: H - P.b + 16, "text-anchor": "middle", class: "sc-axis-text" }, svg).textContent = v;
      }
      rows.forEach((r, i) => {
        const y = P.t + i * RH + RH / 2;
        if (i % 4 === 0) el("text", { x: 8, y: y + 4, class: "sc-axis-title", "font-size": 12 }, svg).textContent = lab(r.m);
        el("text", { x: P.l - 10, y: y + 4, "text-anchor": "end", class: "sc-axis-text" }, svg).textContent = `${r.kv} · ${r.s}`;
        if (!r.w) { el("text", { x: X(0) + 4, y: y + 4, class: "sc-axis-text", "font-style": "italic" }, svg).textContent = "pominięte (0,5–2,5 tok/s)"; }
        if (r.n && r.w) el("line", { x1: X(r.n.mean), x2: X(r.w.mean), y1: y, y2: y, stroke: COL[r.kv], "stroke-width": 2, opacity: 0.5 }, svg);
        for (const [c, stage, fill] of [[r.n, "no_thinking", COL.grey], [r.w, "with_thinking", COL[r.kv]]]) {
          if (!c) continue;
          const g = el("g", { class: "sc-point" }, svg);
          el("circle", { cx: X(c.mean), cy: y, r: 10, fill: "transparent" }, g);
          el("circle", { cx: X(c.mean), cy: y, r: 5, fill, stroke: "#181b21", "stroke-width": 2 }, g);
          tipOn(g, () => cellTip(D, r.m, r.kv, r.s, c, stage));
        }
        if (r.w) {
          const tr = r.w.hays.reduce((k, h) => k + h.rs.filter(x => x.trunc).length, 0), n = r.w.hays.reduce((k, h) => k + h.rs.length, 0);
          if (tr) el("text", { x: W - P.r + 8, y: y + 4, class: "sc-axis-text" }, svg).textContent = `✂ ${tr}/${n}`;
        }
      });
    }

    // ── 7. practical: prefill minutes / decode tok/s ──
    function renderPractical(size) {
      const rec = (m, kv) => D.l2.find(r => r.stage === "no_thinking" && r.m === m && r.kv === kv && r.size === size && r.hay === 11 && r.seed === 43 && r.ok && r.clk !== false);
      const kvs = ["f16", "q8_0", "q4_0"];
      const models = ORDER.filter(m => rec(m, "f16"));
      for (const [id, val, fmt, label] of [["kq-pp", r => r.pn / r.pp / 60, v => v < 10 ? v.toFixed(1) : Math.round(v), "min"],
                                           ["kq-tg", r => r.tg, v => v < 10 ? v.toFixed(1) : Math.round(v), "tok/s"]]) {
        const items = [];
        for (const m of models) for (const kv of kvs) { const r = rec(m, kv); if (r && val(r)) items.push({ m, kv, r, v: val(r) }); }
        const W = 640, BH = 12, GAP = 3, P = { l: 165, r: 120, t: 6, b: 10 };
        let y = P.t; const pos = [];
        for (const m of models) { const its = items.filter(i => i.m === m); its.forEach((it, k) => pos.push({ ...it, y: y + k * (BH + GAP) })); y += its.length * (BH + GAP) + 8; }
        const H = y + P.b, vmax = Math.max(...items.map(i => i.v)), X = v => v / vmax * (W - P.l - P.r);
        const box = document.getElementById(id); box.innerHTML = "";
        const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", class: "scatter-svg" }, box);
        let last = null;
        for (const p of pos) {
          if (p.m !== last) { el("text", { x: P.l - 8, y: p.y + BH, "text-anchor": "end", class: "sc-axis-text", "font-size": 12 }, svg).textContent = lab(p.m); last = p.m; }
          const g = el("g", { class: "sc-point" }, svg);
          el("rect", { x: P.l, y: p.y - 1, width: W - P.l, height: BH + 2, fill: "transparent" }, g);
          el("rect", { x: P.l, y: p.y, width: Math.max(2, X(p.v)), height: BH, rx: 2, fill: COL[p.kv] }, g);
          el("text", { x: P.l + X(p.v) + 5, y: p.y + BH - 1, class: "sc-axis-text", "font-size": 11 }, g).textContent =
            `${fmt(p.v)}${p.r.ngl === "-1" && !p.r.ot ? "" : " · częściowo"}`;
          tipOn(g, () => `<b>${esc(lab(p.m))}</b> · ${size} · ${p.kv}<br>prompt ${p.r.pn} tok · wczytanie ${Math.round(p.r.pp)} tok/s = ${(p.r.pn / p.r.pp / 60).toFixed(1)} min` +
            `<br>generowanie ${p.r.tg ? p.r.tg.toFixed(1) : "–"} tok/s<br>rozmieszczenie: -ngl ${p.r.ngl}${p.r.ot ? " + eksperci na CPU" : ""} · VRAM ${p.r.vram} MiB`);
        }
      }
    }
    switcher(document.getElementById("kq-pr-sw"), [["128k", "128k"], ["256k", "256k"]], APP_STATE.get("kvqPr", "128k"),
      v => { APP_STATE.set("kvqPr", v); renderPractical(v); });
    renderPractical(APP_STATE.get("kvqPr", "128k"));

    // ── 8. per-question pass rate ──
    {
      const cnt = {};
      for (const r of D.l2) {
        if (!r.ok || r.stage !== "no_thinking" || r.kv !== "f16") continue;
        for (const q of Object.keys(D.questions)) {
          const k = q + "|" + r.size; cnt[k] = cnt[k] || [0, 0];
          cnt[k][1]++; if (!r.fails.includes(q) && !r.trunc) cnt[k][0]++;
        }
      }
      heat(document.getElementById("kq-q"), Object.entries(D.questions).map(([q, t]) => ({ q, label: `${q} · ${t}` })),
        D.sizes.map(s => ({ s, label: s })), (r, c) => {
          const v = cnt[r.q + "|" + c.s]; if (!v) return null;
          const t = v[0] / v[1];
          return { text: Math.round(100 * t) + "%", bg: seq(t), fg: seqText(t), tip: () => `${r.q} · ${c.s}: ${v[0]}/${v[1]} poprawnych` };
        }, { note: "Długi kontekst psuje głównie śledzenie zmian w czasie (q2, q4, q8), a nie samo wyszukanie (q3, q7). q6 (liczenie) jest na dnie przy każdej długości — nie rozróżnia modeli." });
    }
  };
})();
