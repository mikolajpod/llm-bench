// Shared prompt filter (2026-11-17) — one definition of prompt groups for Etap 5 and Drafters.
// Options: all · groups by type/language (code / PL text / EN text) · Etap 5 categories · single prompts.
// window.PromptFilter.options(prompts) -> [{value, label, group, ids:Set}]
// window.PromptFilter.select(container, prompts, value, onChange) renders a <select>
// window.PromptFilter.ids(prompts, value) -> Set of prompt_ids (falls back to all)
(function () {
  const CAT_PL = {
    code: "kod", knowledge: "wiedza", reasoning: "rozumowanie", polish: "polski",
    instruction: "instrukcje", longctx: "długi kontekst", agent: "agent",
  };
  const GROUPS = [
    ["g:code", "kod (programowanie, SQL, debug)", p => p.category === "code"],
    ["g:pl_text", "tekst po polsku (bez kodu)", p => p.category !== "code" && p.lang === "pl"],
    ["g:en_text", "tekst po angielsku (bez kodu)", p => p.category !== "code" && p.lang !== "pl"],
  ];

  function options(prompts) {
    const all = new Set(prompts.map(p => p.prompt_id));
    const out = [{ value: "all", label: `wszystkie prompty (${all.size})`, group: null, ids: all }];
    for (const [v, lbl, f] of GROUPS) {
      const ids = new Set(prompts.filter(f).map(p => p.prompt_id));
      out.push({ value: v, label: `${lbl} (${ids.size})`, group: "typ i język", ids });
    }
    const cats = [...new Set(prompts.map(p => p.category))];
    for (const c of cats) {
      const ids = new Set(prompts.filter(p => p.category === c).map(p => p.prompt_id));
      out.push({ value: "c:" + c, label: `${CAT_PL[c] || c} (${ids.size})`, group: "kategoria", ids });
    }
    for (const p of prompts) {
      out.push({ value: "p:" + p.prompt_id, label: p.prompt_id, group: "pojedynczy prompt", ids: new Set([p.prompt_id]) });
    }
    return out;
  }

  function ids(prompts, value) {
    const o = options(prompts).find(o => o.value === value);
    return o ? o.ids : new Set(prompts.map(p => p.prompt_id));
  }

  function label(prompts, value) {
    const o = options(prompts).find(o => o.value === value);
    return o ? o.label : options(prompts)[0].label;
  }

  function select(container, prompts, value, onChange) {
    const opts = options(prompts);
    let html = "", grp = undefined;
    for (const o of opts) {
      if (o.group !== grp) {
        if (grp) html += "</optgroup>";
        if (o.group) html += `<optgroup label="${o.group}">`;
        grp = o.group;
      }
      html += `<option value="${o.value}"${o.value === value ? " selected" : ""}>${o.label}</option>`;
    }
    if (grp) html += "</optgroup>";
    container.innerHTML = `<label class="pf-label">prompty:</label><select class="pf-select">${html}</select>`;
    const sel = container.querySelector("select");
    if (!opts.some(o => o.value === value)) sel.value = "all";
    sel.addEventListener("change", () => onChange(sel.value));
    return sel;
  }

  // Recompute a leaderboard (Etap 5 shape) over a prompt subset from matrix cells.
  // Keeps the same fields the leaderboard / scatter read; 16k delta recomputed where the model has it.
  function filterLeaderboard(stageData, idSet) {
    const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const out = [];
    for (const row of stageData.leaderboard) {
      const cells = stageData.matrix[row.model] || {};
      const g = [], g16 = [], tps = [], pn = [], wall = [];
      let tr = 0, tot = 0, repl = 0;
      for (const [pid, c] of Object.entries(cells)) {
        if (!idSet.has(pid)) continue;
        if (c.grade != null) {
          g.push(c.grade);
          if (row.avg_grade_16k != null) g16.push(c.grade_16k != null ? c.grade_16k : c.grade);
          repl += c.n_replaced_32k || 0;
        }
        for (const s of c.samples || []) {
          tot++;
          if (s.trunc_flag) tr++;
          if (s.decode_tok_per_s) tps.push(s.decode_tok_per_s);
          if (s.predicted_n != null) pn.push(s.predicted_n);
          if (s.wall_seconds) wall.push(s.wall_seconds);
        }
      }
      if (!g.length) continue;
      const avg = g.reduce((a, b) => a + b, 0) / g.length;
      const r = {
        model: row.model, avg_grade: Math.round(avg * 100) / 100, n_prompts_graded: g.length,
        trunc_count: tr, total_samples: tot, trunc_rate: tot ? tr / tot : 0,
        median_decode_tps: med(tps), median_predicted_n: med(pn), median_wall_seconds: med(wall),
        mean_wall_seconds: wall.length ? wall.reduce((a, b) => a + b, 0) / wall.length : null,
        mean_predicted_n: pn.length ? Math.round(pn.reduce((a, b) => a + b, 0) / pn.length) : null,
      };
      if (g16.length) {
        const a16 = g16.reduce((a, b) => a + b, 0) / g16.length;
        r.avg_grade_16k = Math.round(a16 * 100) / 100;
        r.delta_16k = Math.round((avg - a16) * 100) / 100;
        r.n_replaced_32k = repl;
      }
      out.push(r);
    }
    out.sort((a, b) => b.avg_grade - a.avg_grade);
    return out;
  }

  window.PromptFilter = { options, ids, label, select, filterLeaderboard };
})();
