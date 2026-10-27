// MTP view — speculative decoding (Multi-Token Prediction): speed + GPU energy per token.
// Data: window.DATA.mtp from build_app_data.build_mtp() (eval_etap4/temp/mtp_energy_*.json
// + llamacpp-standalone/results*.json). Static text = LM Studio UI observations (not measured
// by the harness) and methodology caveats.
(function () {
  const html = String.raw;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = d => d == null ? "·" : (d > 0 ? "+" : "") + (d * 100).toFixed(0) + "%";
  const x = s => s == null ? "·" : "×" + s.toFixed(2);
  const good = (v, higherIsBetter) => v == null ? "var(--fg-3)"
    : (Math.abs(v - (higherIsBetter ? 1 : 0)) < 0.03 ? "var(--fg-3)"
      : ((higherIsBetter ? v > 1 : v < 0) ? "var(--good)" : "var(--bad)"));

  // grouped horizontal bars: one group per pair, bars = configs
  function bars(rows, key, unit, fmt) {
    const pairs = [...new Set(rows.map(r => r.pair))];
    const max = Math.max(...rows.map(r => r[key] || 0)) * 1.12 || 1;
    const W = 640, LBL = 230, BH = 14, GAP = 4, GG = 14;
    let y = 4, out = "";
    const col = { off: "#757d88", n1: "#6aa6ff", n2: "#9658e8", n4: "#4cd181" };
    for (const p of pairs) {
      const rs = rows.filter(r => r.pair === p);
      out += `<text x="0" y="${y + 11}" class="lb-label" style="font-weight:600">${esc(rs[0].model)}</text>`;
      y += 16;
      for (const r of rs) {
        const w = (W - LBL - 70) * (r[key] || 0) / max;
        out += `<text x="12" y="${y + 11}" class="lb-label">${r.config === "off" ? "bez MTP" : "MTP " + r.config}</text>
          <rect x="${LBL}" y="${y}" width="${w}" height="${BH}" rx="2" fill="${col[r.config] || "#888"}"></rect>
          <text x="${LBL + w + 6}" y="${y + 11}" class="lb-value">${fmt(r[key])} ${unit}</text>`;
        y += BH + GAP;
      }
      y += GG;
    }
    return `<svg class="leaderboard-svg" viewBox="0 0 ${W} ${y}">${out}</svg>`;
  }

  window.renderMTP = function (root) {
    const d = window.DATA.mtp || { rows: [], history_qwen36_may: [] };
    const backends = [...new Set(d.rows.map(r => r.backend))].sort();
    const state = { backend: backends[backends.length - 1] };

    root.innerHTML = html`
      <h1 class="section-title">MTP — speculative decoding (Multi-Token Prediction)</h1>
      <p class="section-sub">
        MTP: mała głowica (lub osobny drafter) zgaduje kilka następnych tokenów, a duży model
        weryfikuje je w jednym przebiegu. <strong>Jakość odpowiedzi się nie zmienia</strong>
        (przy greedy tekst jest praktycznie identyczny; drobny dryf numeryczny przy n≥2),
        zmienia się tylko prędkość i zużycie energii. Pomiar: RTX 3060 12 GB, greedy, thinking off,
        2 prompty (reasoning_math_pl, code_async_py) × 2 powtórzenia, po rozgrzaniu;
        moc karty z <code>nvidia-smi</code> co 100 ms, całkowana po czasie zapytania.
        Wartości = mediany. Idle karty ≈ <strong>${d.idle_watts ?? "?"} W</strong>.
      </p>
      <div class="controls" id="mtp-controls"></div>

      <div class="section-block">
        <h2 class="block-title">Tabela <span class="muted" id="mtp-sub"></span></h2>
        <div id="mtp-table"></div>
      </div>
      <div class="quant-hero">
        <div class="card"><div class="card-title"><span class="name">Prędkość (tok/s, zegar ścienny)</span></div><div id="mtp-bars-tps"></div></div>
        <div class="card"><div class="card-title"><span class="name">Energia GPU (J/token) — mniej = lepiej</span></div><div id="mtp-bars-j"></div></div>
      </div>

      <div class="section-block">
        <h2 class="block-title">Wnioski i zastrzeżenia</h2>
        <ul>
          <li><strong>MTP obniża J/token</strong> — szybciej <em>i</em> przy niższej średniej mocy karty.
            Przyczyna niższej mocy niezbadana (hipoteza: weryfikacja kilku tokenów naraz mniej obciąża kartę na token).</li>
          <li><strong>Drafter musi pasować do rodziny wag</strong> — drafter QAT na zwykłej gemmie dał tylko ×1,05–1,15.</li>
          <li><strong>Offload na CPU ogranicza zysk</strong>: weryfikacja K+1 tokenów to K+1× więcej pracy ekspertów na CPU (MoE) / wag w RAM (dense).
            Na 3090 (pełny VRAM) spodziewany większy zysk.</li>
          <li><strong>Pojedynczy przebieg potrafi być mocno zawyżony</strong>: pierwszy pomiar gemmy (16.10) dał ×1,5–2,5,
            które się nie powtórzyły — tu tylko powtórzone pomiary z zegarem ściennym. Rozrzut między przebiegami ok. ±10%.</li>
          <li>Moc = tylko karta (bez CPU/systemu); <code>power.draw</code> może być dodatkowo uśredniany przez sterownik.</li>
        </ul>
      </div>

      <div class="section-block">
        <h2 class="block-title">Historia: Qwen3.6-35B-A3B-MTP, maj 2026 <span class="muted" style="font-size:12px">standalone llama-server, 32 warstwy MoE na CPU, prompt 66 tok., 256 tok. generacji, bez pomiaru energii</span></h2>
        <div id="mtp-hist"></div>
        <p class="muted" style="font-size:12px">
          <strong>LM Studio UI (czat, obserwacja użytkownika, nie pomiar harnessu):</strong> ten sam model, MTP n=1 —
          16 → 9,5–10 tok/s (−40%, acceptance ~45%) w starszym LMS, ~12 tok/s po aktualizacji. Najpewniej przez thinking w czacie
          (rozjeżdża przewidywania głowicy); binarka standalone działa poprawnie (tabela powyżej).
        </p>
      </div>`;

    const ctr = document.getElementById("mtp-controls");
    ctr.innerHTML = backends.length > 1
      ? `<label>backend</label><span class="stage-switch">${backends.map(b =>
          `<button data-b="${b}" class="${b === state.backend ? "active" : ""}">${b}</button>`).join("")}</span>`
      : `<span class="muted">backend ${esc(state.backend || "—")}</span>`;
    for (const btn of ctr.querySelectorAll("button")) {
      btn.addEventListener("click", () => {
        state.backend = btn.dataset.b;
        for (const b of ctr.querySelectorAll("button")) b.classList.toggle("active", b === btn);
        render();
      });
    }

    function render() {
      const rows = d.rows.filter(r => r.backend === state.backend);
      document.getElementById("mtp-sub").textContent = `backend ${state.backend} · ${rows.length} konfiguracji`;
      document.getElementById("mtp-table").innerHTML = html`
        <table class="quant-contrasts" style="width:100%">
          <thead><tr><th>model</th><th>MTP</th><th>drafter</th><th>offload</th><th>tok/s</th><th>przyspieszenie</th>
            <th>śr. moc</th><th>J/token</th><th>Δ J/token</th><th>acceptance</th><th>n</th></tr></thead>
          <tbody>${rows.map(r => html`
            <tr>
              <td>${esc(r.model)}</td>
              <td>${r.config === "off" ? "—" : r.config.replace("n", "n=")}</td>
              <td class="muted">${r.config === "off" ? "" : esc(r.drafter)}</td>
              <td class="muted">${esc(r.placement)}</td>
              <td style="text-align:right">${r.tps.toFixed(1)}</td>
              <td style="text-align:right; color:${good(r.speedup, true)}">${r.config === "off" ? "" : x(r.speedup)}</td>
              <td style="text-align:right">${r.watts.toFixed(0)} W</td>
              <td style="text-align:right">${r.j_per_token.toFixed(2)}</td>
              <td style="text-align:right; color:${good(r.energy_delta, false)}">${r.config === "off" ? "" : pct(r.energy_delta)}</td>
              <td style="text-align:right">${r.accept == null ? "" : (r.accept * 100).toFixed(0) + "%"}</td>
              <td style="text-align:right" class="muted">${r.n}</td>
            </tr>`).join("")}</tbody>
        </table>`;
      document.getElementById("mtp-bars-tps").innerHTML = bars(rows, "tps", "tok/s", v => v.toFixed(1));
      document.getElementById("mtp-bars-j").innerHTML = bars(rows, "j_per_token", "J/tok", v => v.toFixed(2));
    }
    render();

    const h = d.history_qwen36_may || [];
    document.getElementById("mtp-hist").innerHTML = h.length ? html`
      <table class="quant-contrasts">
        <thead><tr><th>binarka</th><th>konfiguracja</th><th>temp</th><th>tok/s</th><th>acceptance</th></tr></thead>
        <tbody>${h.map(r => `<tr><td>${esc(r.binary)}</td><td>${esc(r.config)}</td><td>${r.temp}</td>
          <td style="text-align:right">${r.tps.toFixed(1)}</td>
          <td style="text-align:right">${r.accept == null ? "" : (r.accept * 100).toFixed(0) + "%"}</td></tr>`).join("")}</tbody>
      </table>` : `<span class="muted">brak danych</span>`;
  };
})();
