// Drafters view (2026-11-17) — speculative decoding on Etap 5 models (RTX 3090, b2.64):
// MTP / DFlash / DSpark vs no drafter. Grade vs time per answer and vs GPU energy per answer,
// for any prompt subset (shared PromptFilter). Data: window.DATA.drafters (build_app_data.build_drafters),
// prompts from window.DATA.etap5.prompts. Old MTP tab (RTX 3060, Etap 4) lives in a collapsed history block.
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

  // categorical slots 1-3 (dark steps), validated on the dark surface; grey = no drafter
  const COL = { mtp: "#3987e5", dflash: "#d95926", dspark: "#199e70", base: "#8a919c" };
  const NAME = { mtp: "MTP", dflash: "DFlash", dspark: "DSpark" };
  const short = m => m.replace(/^[^/]+\//, "");
  const sum = a => a.reduce((x, y) => x + y, 0);

  // ── aggregation over a prompt subset ──
  function aggBase(row, ids) {
    const ps = Object.entries(row).filter(([pid]) => ids.has(pid)).map(([, v]) => v);
    const gs = ps.filter(p => p.g != null).map(p => p.g);
    if (!gs.length || !ps.length) return null;
    const btok = sum(ps.map(p => p.btok)), bwall = sum(ps.map(p => p.bwall));
    const etok = sum(ps.map(p => p.etok)), e = sum(ps.map(p => p.e));
    const tok = sum(ps.map(p => p.tok)) / ps.length;
    if (!bwall) return null;
    const tps = btok / bwall;
    const jt = etok && etok / btok >= 0.9 ? e / etok : null;  // energy only with >=90% power-log coverage
    return { grade: sum(gs) / gs.length, n: gs.length, tok, tps, wall: tok / tps, jt, j: jt ? tok * jt : null };
  }

  function aggSpec(v, ids, b) {
    const ps = Object.entries(v.p).filter(([pid]) => ids.has(pid)).map(([, x]) => x);
    if (!ps.length || !b) return null;
    const tok = sum(ps.map(x => x[0])), wall = sum(ps.map(x => x[1]));
    const withE = ps.filter(x => x[2] != null);
    const jt = withE.length ? sum(withE.map(x => x[2])) / sum(withE.map(x => x[0])) : null;
    const dn = sum(ps.map(x => x[3])), da = sum(ps.map(x => x[4]));
    const tps = tok / wall;
    return { grade: b.grade, tps, wall: b.tok / tps, jt, j: jt ? b.tok * jt : null,
             speed: tps / b.tps, acc: dn ? da / dn : null, eRatio: jt && b.jt ? jt / b.jt : null, nP: ps.length };
  }

  // ── scatter: grey = no drafter, colour = drafter variant, line base→variant, Pareto front ──
  function scatter(container, pts, xKey, xLabel, xFmt) {
    const W = 900, H = 560, PAD = { l: 56, r: 24, t: 26, b: 48 };
    const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
    const P = pts.filter(p => p[xKey] != null && isFinite(p[xKey]) && p[xKey] > 0);
    container.innerHTML = "";
    if (!P.length) { container.innerHTML = `<div class="loading">brak danych dla tego wyboru</div>`; return; }
    const xs = P.map(p => p[xKey]), ys = P.map(p => p.grade);
    const steps = [];
    for (let d = 0.1; d <= 1e7; d *= 10) for (const m of [1, 2, 5]) steps.push(Math.round(d * m * 10) / 10);
    const lo = steps.filter(s => s <= Math.min(...xs)).pop(), hi = steps.find(s => s >= Math.max(...xs));
    const l0 = Math.log10(lo), l1 = Math.log10(hi);
    const X = x => PAD.l + (Math.log10(x) - l0) / (l1 - l0) * pw;
    const yMin = Math.max(0, Math.floor(Math.min(...ys) - 0.5)), yMax = Math.min(10, Math.ceil(Math.max(...ys) + 0.3));
    const Y = y => PAD.t + ph - (y - yMin) / (yMax - yMin) * ph;
    const svg = el("svg", { class: "scatter-svg", viewBox: `0 0 ${W} ${H}`, width: "100%", style: "overflow:visible" }, container);
    el("line", { x1: PAD.l, x2: W - PAD.r, y1: H - PAD.b, y2: H - PAD.b, class: "sc-axis" }, svg);
    el("line", { x1: PAD.l, x2: PAD.l, y1: PAD.t, y2: H - PAD.b, class: "sc-axis" }, svg);
    for (const v of steps.filter(s => s >= lo && s <= hi)) {
      const x = X(v);
      el("line", { x1: x, x2: x, y1: PAD.t, y2: H - PAD.b, stroke: "#23282f", "stroke-dasharray": "2 4" }, svg);
      el("text", { x, y: H - PAD.b + 16, "text-anchor": "middle", class: "sc-axis-text" }, svg).textContent =
        v >= 1000 ? `${v / 1000}k` : String(v);
    }
    const yStep = yMax - yMin > 4 ? 1 : 0.5;
    for (let v = yMin; v <= yMax + 1e-9; v += yStep) {
      const y = Y(v);
      el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, stroke: "#23282f", "stroke-dasharray": "2 4" }, svg);
      el("text", { x: PAD.l - 8, y: y + 4, "text-anchor": "end", class: "sc-axis-text" }, svg).textContent = String(v);
    }
    el("text", { x: PAD.l + pw / 2, y: H - 10, "text-anchor": "middle", class: "sc-axis-title" }, svg).textContent = xLabel;
    el("text", { x: -PAD.t - ph / 2, y: 16, "text-anchor": "middle", class: "sc-axis-title", transform: "rotate(-90)" }, svg)
      .textContent = "średnia ocena (Etap 5)";

    // Pareto front: walking from the cheap end, keep points that beat every cheaper point on grade
    let best = -Infinity;
    const front = [];
    for (const p of P.slice().sort((a, b) => a[xKey] - b[xKey] || b.grade - a.grade)) {
      if (p.grade > best + 1e-9) { front.push(p); best = p.grade; }
    }
    const fset = new Set(front);
    el("path", { d: front.map((p, i) => (i ? `H${X(p[xKey])}V${Y(p.grade)}` : `M${X(p[xKey])},${Y(p.grade)}`)).join(""),
                 fill: "none", stroke: "#6aa6ff", "stroke-width": 1.5, "stroke-dasharray": "6 4", opacity: 0.7 }, svg);

    // base→variant connectors (same grade, so horizontal)
    for (const p of P.filter(p => p.base && p.base[xKey] != null)) {
      el("line", { x1: X(p.base[xKey]), x2: X(p[xKey]), y1: Y(p.grade), y2: Y(p.grade), stroke: COL[p.method],
                   "stroke-width": 2, opacity: 0.55 }, svg);
    }
    const order = P.slice().sort((a, b) => (a.method ? 1 : 0) - (b.method ? 1 : 0));
    const groups = [];
    for (const p of order) {
      const g = el("g", { class: "sc-point" }, svg);
      const cx = X(p[xKey]), cy = Y(p.grade);
      el("title", {}, g).textContent = p.tip(xKey) + (fset.has(p) ? " · front Pareto" : "");
      el("circle", { cx, cy, r: 11, fill: "transparent" }, g);  // hit target
      el("circle", { cx, cy, r: p.method ? 5 : 4, fill: p.method ? COL[p.method] : COL.base,
                     opacity: p.method ? 0.95 : 0.55, stroke: "#0f1115", "stroke-width": 2 }, g);
      groups.push({ p, g, cx, cy });
    }
    // labels: drafter points and front points first, greedy de-collision, the rest on hover
    const FS = 9.5, CW = FS * 0.56, placed = [];
    const hit = b => placed.some(q => b.x1 < q.x2 && b.x2 > q.x1 && b.y1 < q.y2 && b.y2 > q.y1);
    for (const { cx, cy } of groups) placed.push({ x1: cx - 5, x2: cx + 5, y1: cy - 5, y2: cy + 5 });  // dots are obstacles
    const score = p => (p.method ? 3 : 0) + (p.hasSpec ? 2 : 0) + (fset.has(p) ? 1 : 0);
    const prio = groups.slice().sort((a, b) => score(b.p) - score(a.p));
    for (const { p, g, cx, cy } of prio) {
      const want = p.method || p.hasSpec || fset.has(p);
      if (!p.method) {  // model names: rotated 45° clockwise from the dot (user 2026-11-17), no de-collision
        const tx = cx + 5, ty = cy + 7;
        el("text", { x: tx, y: ty, transform: `rotate(45 ${tx} ${ty})`, "text-anchor": "start",
                     class: "sc-label" + (want ? "" : " sc-label-hidden"), "font-size": FS,
                     "paint-order": "stroke", stroke: "#0f1115", "stroke-width": 3, "stroke-linejoin": "round" }, g)
          .textContent = p.label;
        g.addEventListener("mouseenter", () => { svg.appendChild(g); g.classList.add("hl"); });
        g.addEventListener("mouseleave", () => g.classList.remove("hl"));
        continue;
      }
      let chosen = null;
      for (const [side, dy] of [["r", 0], ["l", 0], ["r", -10], ["r", 10], ["l", -10], ["l", 10], ["r", -19], ["l", -19], ["r", 19], ["l", 19]]) {
        const w = p.label.length * CW, tx = side === "r" ? cx + 8 : cx - 8;
        const b = { side, tx, ly: cy + dy, x1: side === "r" ? tx : tx - w, x2: side === "r" ? tx + w : tx,
                    y1: cy + dy - FS, y2: cy + dy + 3 };
        if (b.x1 < PAD.l || b.x2 > W - PAD.r || b.y1 < PAD.t || b.y2 > H - PAD.b) continue;
        if (!hit(b)) { chosen = b; break; }
      }
      const b = chosen || { side: "r", tx: cx + 8, ly: cy };
      if (chosen && want) placed.push(chosen);
      if (chosen && want && b.ly !== cy) el("line", { x1: cx, y1: cy, x2: b.tx, y2: b.ly - 3, class: "sc-leader" }, g);
      el("text", { x: b.tx, y: b.ly + 3, "text-anchor": b.side === "r" ? "start" : "end",
                   class: "sc-label" + (chosen && want ? "" : " sc-label-hidden"), "font-size": FS,
                   "paint-order": "stroke", stroke: "#0f1115", "stroke-width": 3, "stroke-linejoin": "round" }, g)
        .textContent = p.label;
      g.addEventListener("mouseenter", () => { svg.appendChild(g); g.classList.add("hl"); });
      g.addEventListener("mouseleave", () => g.classList.remove("hl"));
    }
  }

  window.renderDrafters = function (root) {
    const D = window.DATA.drafters;
    const prompts = window.DATA.etap5?.prompts || [];
    if (!D) { root.innerHTML = `<div class="loading">brak data/drafters.js — uruchom build_app_data.py</div>`; return; }
    const state = { stage: APP_STATE.get("drStage", "with_thinking"), pf: APP_STATE.get("drPF", "all") };
    if (!["no_thinking", "with_thinking"].includes(state.stage)) state.stage = "with_thinking";

    root.innerHTML = html`
      <h1 class="section-title">Drafters — spekulatywne dekodowanie na modelach Etapu 5</h1>
      <p class="section-sub">
        Mały model albo dodatkowa „głowa” zgaduje kilka następnych tokenów, duży model sprawdza je w jednym przebiegu.
        Ostatnie słowo zawsze ma duży model, więc jakość się nie zmienia; zmienia się czas i energia.
        <strong>RTX 3090</strong>, llama-server b2.64, mem P3 + rdzeń ≤1000 MHz, ekran zablokowany, 16–17.11.2026.
        <strong>Pomiar z drafterem:</strong> 22 prompty × seed 43. <strong>Bez draftera:</strong> rekordy Etapu 5 (5 seedów).
        <strong>Ocena</strong> = ocena Etapu 5 (drafter nie zmienia rozkładu; sprawdzone ślepą oceną na Muse, paczka 20).
        <strong>Czas na odpowiedź</strong> = średnia liczba tokenów odpowiedzi z Etapu 5 ÷ tokeny/s (z prefill).
        <strong>Energia</strong> = moc GPU z nvidia-smi (sama karta), J/odpowiedź = tokeny × J/token.
        Wybór promptów (góra) przelicza wszystko: oceny, czasy, energię, front Pareto i tabelę.
      </p>
      <div class="legend-row" id="dr-legend"></div>
      <div class="e3-grid">
        <section class="panel">
          <h2>Ocena vs czas na odpowiedź <span class="panel-sub" id="dr-sub-w"></span></h2>
          <div id="dr-wall"></div>
        </section>
        <section class="panel">
          <h2>Ocena vs energia GPU na odpowiedź <span class="panel-sub" id="dr-sub-j"></span></h2>
          <div id="dr-energy"></div>
        </section>
        <section class="panel">
          <h2>Warianty z drafterem <span class="panel-sub" id="dr-sub-t"></span></h2>
          <div id="dr-table"></div>
          <p class="muted" style="font-size:12px; margin-top:8px">
            Akceptacja = trafione ÷ zgadywane tokeny. Przy DFlash blok jest długi (Muse: 16), więc niska akceptacja nie musi znaczyć braku zysku.
            n = maks. liczba zgadywanych tokenów, wybrana w krótkim sweepie (2 prompty). Przy pojedynczym prompcie prędkość z drafterem
            pochodzi z jednego przebiegu, a długość odpowiedzi ze średniej 5 seedów — wynik orientacyjny.
          </p>
        </section>
        <section class="panel">
          <h2>Metody</h2>
          <table class="quant-contrasts" style="width:100%">
            <thead><tr><th>metoda</th><th>skąd zgadywanie</th><th>jak zgaduje</th><th>flaga llama.cpp</th><th>uwagi</th></tr></thead>
            <tbody>
              <tr><td><span style="color:${COL.mtp}">●</span> <b>MTP</b></td><td>warstwa trenowana razem z modelem: w GGUF (Qwen, Nemotron, Groot) albo osobny plik <code>mtp-*.gguf</code> (Gemma 4)</td><td>token po tokenie, n = 2–4</td><td><code>draft-mtp</code></td><td>uczona razem z modelem → dobrze w każdym języku</td></tr>
              <tr><td><span style="color:${COL.dflash}">●</span> <b>DFlash / DFlash2</b></td><td>osobny mały model (arch. <code>dflash</code>) na stanach ukrytych dużego</td><td>cały blok naraz (Gemma/Muse 16, Qwen 8)</td><td><code>draft-dflash</code></td><td>zależy od danych treningowych; społecznościowe (z-lab, Anbeeld) słabe na polskim bez myślenia</td></tr>
              <tr><td><span style="color:${COL.dspark}">●</span> <b>DSpark</b></td><td>wariant DFlash (blok 7, <code>sample_from_anchor</code>)</td><td>blok od „kotwicy”</td><td><code>draft-dspark</code></td><td>na Qwen3.8 nigdzie nie wygrał</td></tr>
              <tr><td><b>EAGLE3</b></td><td>mała głowa na stanach ukrytych</td><td>drzewo kandydatów</td><td><code>draft-eagle3</code></td><td>dla modeli Etapu 5 tylko vLLM/SGLang, bez GGUF</td></tr>
              <tr><td><b>draft-simple</b></td><td>zwykły mały model z tej samej rodziny</td><td>token po tokenie</td><td><code>draft-simple</code></td><td>nie testowane</td></tr>
              <tr><td><b>ngram</b></td><td>powtórzenia z promptu / odpowiedzi</td><td>kopiowanie</td><td><code>ngram-*</code></td><td>bez modelu; pomaga przy przepisywaniu tekstu; nie testowane</td></tr>
            </tbody>
          </table>
        </section>
        <section class="panel">
          <h2>Dostępność (17.11.2026) i wnioski</h2>
          <table class="quant-contrasts" style="width:100%">
            <thead><tr><th>model</th><th>MTP</th><th>DFlash / DSpark (GGUF)</th><th>status</th></tr></thead>
            <tbody>
              <tr><td>Gemma 4 31B / 26B / 12B</td><td>✓ osobny plik unsloth</td><td>DFlash (Anbeeld)</td><td>zmierzone</td></tr>
              <tr><td>Gemma 4 E4B, 26B QAT</td><td>✓</td><td>—</td><td>MTP zmierzone</td></tr>
              <tr><td>Qwen3.6 35B-A3B</td><td>✓ w GGUF</td><td>DFlash2 (aminya)</td><td>zmierzone</td></tr>
              <tr><td>Qwen3.8 27B</td><td>✓ w GGUF</td><td>DFlash2 (z-lab), DSpark (Anbeeld)</td><td>zmierzone</td></tr>
              <tr><td>Muse Glimmer 30B</td><td>—</td><td>DFlash oficjalny (meta-models)</td><td>zmierzone + ocenione (paczka 20)</td></tr>
              <tr><td>Qwen3.5 9B</td><td>✓ osobny GGUF unsloth (inna kwantyzacja niż w Etapie 5)</td><td>DFlash tylko „GGUF-Test”</td><td>MTP zmierzone</td></tr>
              <tr><td>Nemotron Lightning 30B</td><td>✓ w GGUF — <b>spowalnia</b></td><td>tylko NVFP4</td><td>—</td></tr>
              <tr><td>Groot 19B-A3B</td><td>✓ w GGUF</td><td>—</td><td>MTP zmierzone</td></tr>
              <tr><td>Spark-X2.6 4B</td><td>—</td><td>DSpark oficjalny</td><td>nie ładuje się w llama.cpp z LMS (2.64/2.67/2.73)</td></tr>
              <tr><td>Nanbeige · Qwen3-Coder · Mistral Small</td><td>—</td><td>tylko safetensors / vLLM</td><td>brak GGUF</td></tr>
            </tbody>
          </table>
          <ul style="font-size:13px; color:var(--fg-2); margin-top:10px; line-height:1.55">
            <li><b>Ma MTP → używaj MTP.</b> Działa na wszystkim; największy zysk na gęstych Gemmach (31B: ×2,3 NT, ×2,6 WT).</li>
            <li><b>DFlash społecznościowy bez myślenia</b> opłaca się tylko do kodu; na polskim tekście bywa wolniejszy niż bez draftera (Gemma 26B ×0,6).
                <b>Z myśleniem</b> ta słabość znika (rozumowanie po angielsku) i na Gemmie 26B / Qwenach DFlash jest minimalnie lepszy od MTP.</li>
            <li><b>Oficjalny DFlash Muse</b> działa równo na wszystkim (×2,0–2,2) i nie obniżył ocen (ślepa ocena: @low 8,41 / high 8,91 vs średnia Etapu 5 8,02 / 8,51).</li>
            <li><b>Tekst nie jest identyczny</b> z Etapem 5 (NT 34/220, WT 0/220 bit w bit): sprawdzanie kilku tokenów naraz zmienia zaokrąglenia
                i przy prawie równych kandydatach wybór się rozjeżdża — efekt jak inny seed, nie spadek jakości. Przy n=1 tekst bywa identyczny (test „gips”: 6/6).</li>
            <li><b>Energia</b> spada mniej więcej tyle, ile rośnie prędkość — karta pracuje w tym samym stanie (P3).</li>
          </ul>
        </section>
        <section class="panel">
          <details>
            <summary style="cursor:pointer; font-weight:600">Historia: dawny widok MTP (RTX 3060, Etap 4) i test „gips”</summary>
            <div style="margin-top:12px">
              <p><b>Test „gips” (17.11.2026, 3090):</b> czy spadek prędkości MTP w czacie LM Studio (Qwen3.6, n=1, akceptacja ~45%) mógł wynikać
              z głupiego pytania po polsku („ile gipsu daje sie do chleba, żeby był najlepszy”)? <b>Nie.</b> Przy n=1 akceptacja 69–74% (NT) i 76–80% (WT),
              MTP przyspiesza (64 → 71–73 t/s). Dla porównania literacki polish_creative_pl: n=1 58–65% (NT), n=2 45–50%.
              Przyczyna dawnego spadku leżała gdzie indziej (ustawienia/wersja LMS na 3060 z ekspertami na CPU).</p>
              <div id="dr-legacy"></div>
            </div>
          </details>
        </section>
      </div>`;

    document.getElementById("subnav").innerHTML = html`
      <div class="stage-switch" id="dr-stage">
        <button data-stage="no_thinking">no_thinking</button>
        <button data-stage="with_thinking">with_thinking</button>
      </div>
      <div class="pf-wrap" id="dr-pf"></div>`;
    const sw = document.getElementById("dr-stage");
    const syncStage = () => sw.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.stage === state.stage));
    syncStage();
    sw.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      state.stage = b.dataset.stage; APP_STATE.set("drStage", state.stage); syncStage(); render();
    }));
    PromptFilter.select(document.getElementById("dr-pf"), prompts, state.pf, v => {
      state.pf = v; APP_STATE.set("drPF", v); render();
    });
    document.getElementById("dr-legend").innerHTML =
      `<span><b style="color:${COL.base}">●</b> bez draftera (Etap 5)</span>` +
      ["mtp", "dflash", "dspark"].map(k => `<span><b style="color:${COL[k]}">●</b> ${NAME[k]}</span>`).join("") +
      `<span class="muted">kreska = ten sam model bez → z drafterem · niebieska przerywana = front Pareto · najedź na punkt po szczegóły</span>`;

    try { window.renderMTP(document.getElementById("dr-legacy")); } catch (e) { /* legacy view optional */ }

    const fmtS = v => v >= 100 ? `${Math.round(v)} s` : `${v.toFixed(1)} s`;
    const fmtJ = v => v >= 10000 ? `${(v / 1000).toFixed(1)} kJ` : `${Math.round(v)} J`;

    function render() {
      const st = state.stage, ids = PromptFilter.ids(prompts, state.pf);
      const what = PromptFilter.label(prompts, state.pf);
      const base = D.base[st] || {}, specs = D.spec[st] || [];
      const B = {};
      for (const [m, row] of Object.entries(base)) {
        const b = aggBase(row, ids);
        if (b) B[m] = b;
      }
      const pts = [];
      const withSpec = new Set(specs.map(v => v.model));
      for (const [m, b] of Object.entries(B)) {
        pts.push({ ...b, model: m, label: short(m), method: null, hasSpec: withSpec.has(m),
          tip: () => `${m} · bez draftera · ocena ${b.grade.toFixed(2)} · ${fmtS(b.wall)}/odp. · ${b.tps.toFixed(1)} t/s` +
                     (b.j ? ` · ${fmtJ(b.j)}/odp. · ${b.jt.toFixed(2)} J/tok` : " · energia: brak pokrycia logu mocy") });
      }
      const rows = [];
      for (const v of specs) {
        const b = B[v.model];
        const s = aggSpec(v, ids, b);
        if (!s) continue;
        const lbl = `${short(v.model)} · ${NAME[v.method]}${v.n}`;
        const p = { ...s, model: v.model, method: v.method, label: `${NAME[v.method]}${v.n}`, base: b,
          tip: () => `${lbl} · ocena ${s.grade.toFixed(2)} (Etap 5) · ${fmtS(s.wall)}/odp. (bez: ${fmtS(b.wall)}) · ` +
                     `${s.tps.toFixed(1)} t/s ×${s.speed.toFixed(2)}` + (s.acc != null ? ` · akceptacja ${Math.round(100 * s.acc)}%` : "") +
                     (s.j ? ` · ${fmtJ(s.j)}/odp.` + (b.j ? ` (bez: ${fmtJ(b.j)})` : "") : "") };
        pts.push(p);
        rows.push({ v, s, b });
      }
      document.getElementById("dr-sub-w").textContent = `${st} · ${what} · skala log`;
      document.getElementById("dr-sub-j").textContent = `${st} · ${what} · skala log · tylko modele z logiem mocy`;
      document.getElementById("dr-sub-t").textContent = `${st} · ${what}`;
      scatter(document.getElementById("dr-wall"), pts, "wall", "czas na odpowiedź [s] (skala log)", fmtS);
      scatter(document.getElementById("dr-energy"), pts, "j", "energia GPU na odpowiedź [J] (skala log)", fmtJ);

      rows.sort((a, b) => a.v.model.localeCompare(b.v.model) || a.v.method.localeCompare(b.v.method));
      const cls = x => x == null ? "" : (x < 0.98 ? "color:var(--bad)" : x > 1.02 ? "color:var(--good)" : "");
      const fx = x => x == null ? "—" : "×" + x.toFixed(2);
      document.getElementById("dr-table").innerHTML = rows.length ? html`
        <table class="quant-contrasts" style="width:100%">
          <thead><tr><th>model</th><th>metoda</th><th style="text-align:right">ocena</th>
            <th style="text-align:right">t/s bez → z</th><th style="text-align:right">przyspieszenie</th>
            <th style="text-align:right">akceptacja</th><th style="text-align:right">czas/odp. bez → z</th>
            <th style="text-align:right">J/token bez → z</th><th style="text-align:right">J/odp. bez → z</th></tr></thead>
          <tbody>${rows.map(({ v, s, b }) => `
            <tr><td>${esc(short(v.model))}${D.notes && v.model.includes("qwen3.5-9b") ? ` <span class="muted" title="${esc(D.notes["qwen3.5-9b"])}">*</span>` : ""}</td>
              <td><span style="color:${COL[v.method]}">●</span> ${NAME[v.method]} n${v.n}</td>
              <td style="text-align:right">${s.grade.toFixed(2)}</td>
              <td style="text-align:right">${b.tps.toFixed(1)} → ${s.tps.toFixed(1)}</td>
              <td style="text-align:right; font-weight:600; ${cls(s.speed)}">${fx(s.speed)}</td>
              <td style="text-align:right">${s.acc == null ? "—" : Math.round(100 * s.acc) + "%"}</td>
              <td style="text-align:right">${fmtS(b.wall)} → ${fmtS(s.wall)}</td>
              <td style="text-align:right">${b.jt ? b.jt.toFixed(2) : "—"} → ${s.jt ? s.jt.toFixed(2) : "—"}</td>
              <td style="text-align:right">${b.j ? fmtJ(b.j) : "—"} → ${s.j ? fmtJ(s.j) : "—"}</td></tr>`).join("")}
          </tbody></table>` : `<div class="loading">brak wariantów z drafterem dla tego wyboru</div>`;
    }
    render();
  };
})();
