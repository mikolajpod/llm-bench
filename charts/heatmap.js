// Heatmap: model × prompt → grade color cell. Click → drawer.
// Adds marginal averages: per-model (right column) + per-prompt (bottom row).
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  function el(t, a = {}, p = null) {
    const e = document.createElementNS(SVG_NS, t);
    for (const [k, v] of Object.entries(a)) if (v != null) e.setAttribute(k, String(v));
    if (p) p.appendChild(e);
    return e;
  }

  window.renderHeatmap = function (container, stageData, modelMeta, prompts, opts = {}) {
    const onClick = opts.onClick || (() => {});
    const { matrix, leaderboard } = stageData;
    // Generic value hooks (default = grade heatmap). The truncation matrix passes count-of-TRUNC hooks
    // and agg "sum" (margins = totals instead of means).
    const valueOf = opts.value || (cell => cell?.grade);
    const colorOf = opts.color || gradeColor;
    const textOf = opts.textColor || textOnGrade;
    const fmtCell = opts.fmt || (v => Number.isInteger(v) ? String(v) : v.toFixed(1));  // v2 grades are sample means
    const fmtAgg = opts.fmtAgg || (v => v.toFixed(1));
    const aggSum = opts.agg === "sum";
    const aggLabel = opts.aggLabel || "avg";
    const aggColor = opts.aggColor || colorOf;
    const aggTextOf = opts.aggTextColor || textOf;
    const showTruncDot = opts.truncDot !== false;

    const models = leaderboard.map(r => r.model);
    const promptIds = prompts.map(p => p.prompt_id);

    // Row averages already in leaderboard.avg_grade
    const rowAvg = {};
    models.forEach(mk => {
      if (!opts.value) { rowAvg[mk] = leaderboard.find(r => r.model === mk)?.avg_grade; return; }
      let sum = 0, n = 0;
      promptIds.forEach(pid => { const v = valueOf(matrix[mk]?.[pid]); if (v != null) { sum += v; n += 1; } });
      rowAvg[mk] = n ? (aggSum ? sum : sum / n) : null;
    });

    // Column averages computed across models present in this stage
    const colAvg = {};
    promptIds.forEach(pid => {
      let sum = 0, n = 0;
      models.forEach(mk => {
        const g = valueOf(matrix[mk]?.[pid]);
        if (g != null) { sum += g; n += 1; }
      });
      colAvg[pid] = n > 0 ? (aggSum ? sum : sum / n) : null;
    });
    // Overall (grand mean of cell grades)
    let gSum = 0, gN = 0;
    models.forEach(mk => promptIds.forEach(pid => {
      const g = valueOf(matrix[mk]?.[pid]);
      if (g != null) { gSum += g; gN += 1; }
    }));
    const grandAvg = gN > 0 ? (aggSum ? gSum : gSum / gN) : null;

    const CELL = 30;
    const ROW_H = 26;
    const PAD_LEFT = 240;
    const PAD_TOP = 160;
    const PAD_RIGHT = 16;
    const PAD_BOTTOM = 16;
    const GAP = 6; // visual gap between data and summary
    const W = PAD_LEFT + promptIds.length * CELL + GAP + CELL + PAD_RIGHT;
    const H = PAD_TOP + models.length * ROW_H + GAP + ROW_H + PAD_BOTTOM;
    const SUMMARY_X = PAD_LEFT + promptIds.length * CELL + GAP;
    const SUMMARY_Y = PAD_TOP + models.length * ROW_H + GAP;

    container.innerHTML = "";
    const svg = el("svg", {
      class: "heatmap-svg",
      width: W, height: H, viewBox: `0 0 ${W} ${H}`,
    }, container);

    // Column labels (data prompts, rotated)
    promptIds.forEach((pid, ci) => {
      const x = PAD_LEFT + ci * CELL + CELL / 2;
      el("text", {
        x, y: PAD_TOP - 8, class: "hm-col-label",
        transform: `rotate(-60, ${x}, ${PAD_TOP - 8})`,
      }, svg).textContent = pid;
    });
    // "avg" header above summary column
    el("text", {
      x: SUMMARY_X + CELL / 2, y: PAD_TOP - 8,
      class: "hm-col-label",
      "text-anchor": "middle",
      "font-weight": 600,
      transform: `rotate(-60, ${SUMMARY_X + CELL / 2}, ${PAD_TOP - 8})`,
    }, svg).textContent = aggLabel;

    // Data rows
    models.forEach((modelKey, ri) => {
      const m = modelMeta[modelKey] || {};
      const y = PAD_TOP + ri * ROW_H;
      // Row label
      el("text", {
        x: PAD_LEFT - 8, y: y + ROW_H / 2 + 4,
        class: "hm-row-label", "text-anchor": "end",
      }, svg).textContent = m.short_name || modelKey;
      el("rect", {
        x: PAD_LEFT - 4, y: y + ROW_H / 2 - 7,
        width: 3, height: 14, rx: 1.5, fill: m.family_color || "#888",
      }, svg);

      // Data cells
      promptIds.forEach((pid, ci) => {
        const cell = (matrix[modelKey] || {})[pid];
        const x = PAD_LEFT + ci * CELL;
        const grade = valueOf(cell);
        const g = el("g", { class: "hm-cell", "data-model": modelKey, "data-prompt": pid }, svg);
        g.addEventListener("click", () => onClick(modelKey, pid));
        el("rect", {
          x: x + 1, y: y + 1, width: CELL - 2, height: ROW_H - 2,
          rx: 2, fill: colorOf(grade, cell),
        }, g);
        if (grade != null && fmtCell(grade, cell) !== "") {
          el("text", {
            x: x + CELL / 2, y: y + ROW_H / 2,
            class: "hm-grade-text", fill: textOf(grade, cell),
          }, g).textContent = fmtCell(grade, cell);
        }
        if (showTruncDot && cell?.any_truncated) {
          el("circle", {
            cx: x + CELL - 5, cy: y + 5, r: 2.5, class: "hm-trunc-dot",
          }, g);
        }
      });

      // Row-average cell (right margin)
      const ra = rowAvg[modelKey];
      const rax = SUMMARY_X;
      const rag = el("g", { class: "hm-summary-cell" }, svg);
      el("rect", {
        x: rax + 1, y: y + 1, width: CELL - 2, height: ROW_H - 2,
        rx: 2, fill: aggColor(ra, "row"),
        stroke: "rgba(255,255,255,0.18)", "stroke-width": 1,
      }, rag);
      if (ra != null) {
        el("text", {
          x: rax + CELL / 2, y: y + ROW_H / 2,
          class: "hm-grade-text", fill: aggTextOf(ra),
        }, rag).textContent = fmtAgg(ra);
      }
    });

    // Bottom "avg" row
    const ay = SUMMARY_Y;
    el("text", {
      x: PAD_LEFT - 8, y: ay + ROW_H / 2 + 4,
      class: "hm-row-label", "text-anchor": "end",
      "font-weight": 600,
    }, svg).textContent = aggLabel;

    promptIds.forEach((pid, ci) => {
      const ca = colAvg[pid];
      const x = PAD_LEFT + ci * CELL;
      const g = el("g", { class: "hm-summary-cell" }, svg);
      el("rect", {
        x: x + 1, y: ay + 1, width: CELL - 2, height: ROW_H - 2,
        rx: 2, fill: aggColor(ca, "col"),
        stroke: "rgba(255,255,255,0.18)", "stroke-width": 1,
      }, g);
      if (ca != null) {
        el("text", {
          x: x + CELL / 2, y: ay + ROW_H / 2,
          class: "hm-grade-text", fill: aggTextOf(ca),
        }, g).textContent = fmtAgg(ca);
      }
    });

    // Corner: grand mean
    const cx = SUMMARY_X;
    const cg = el("g", { class: "hm-summary-cell" }, svg);
    el("rect", {
      x: cx + 1, y: ay + 1, width: CELL - 2, height: ROW_H - 2,
      rx: 2, fill: aggColor(grandAvg, "all"),
      stroke: "rgba(255,255,255,0.35)", "stroke-width": 1.5,
    }, cg);
    if (grandAvg != null) {
      el("text", {
        x: cx + CELL / 2, y: ay + ROW_H / 2,
        class: "hm-grade-text", fill: aggTextOf(grandAvg),
        "font-weight": 800,
      }, cg).textContent = fmtAgg(grandAvg);
    }

    return svg;
  };

  // Truncation matrix: TRUNC samples (hit max_tokens) per model x prompt, drawn by the heatmap above.
  // Cell = count, colour = share of the cell's samples; margins = totals.
  function truncCount(cell) {
    if (!cell || !cell.samples) return null;
    return cell.samples.filter(s => s.truncated || s.trunc_flag === "TRUNC").length;
  }
  function truncColor(v, cell) {
    if (v == null) return "#2a313c";
    if (v === 0) return "#1d232c";
    const t = Math.min(1, cell && cell.n_samples ? v / cell.n_samples : 1);  // share: amber -> red
    const r = Math.round(214 + 16 * t), g = Math.round(160 - 110 * t), b = Math.round(60 - 20 * t);
    return `rgb(${r},${g},${b})`;
  }
  window.renderTruncHeatmap = function (container, stageData, modelMeta, prompts, opts = {}) {
    return window.renderHeatmap(container, stageData, modelMeta, prompts, {
      ...opts, value: truncCount, color: truncColor, agg: "sum", aggLabel: "\u03a3", truncDot: false,
      textColor: v => (v ? "#111" : "#5b6575"),
      fmt: v => (v ? String(v) : "\u00b7"), fmtAgg: v => String(v),
      aggColor: v => (v ? "#7a3b2e" : "#1d232c"), aggTextColor: v => (v ? "#f3d6cf" : "#5b6575"),
    });
  };
})();
