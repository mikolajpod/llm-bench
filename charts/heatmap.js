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

    const models = leaderboard.map(r => r.model);
    const promptIds = prompts.map(p => p.prompt_id);

    // Row averages already in leaderboard.avg_grade
    const rowAvg = Object.fromEntries(leaderboard.map(r => [r.model, r.avg_grade]));

    // Column averages computed across models present in this stage
    const colAvg = {};
    promptIds.forEach(pid => {
      let sum = 0, n = 0;
      models.forEach(mk => {
        const g = matrix[mk]?.[pid]?.grade;
        if (g != null) { sum += g; n += 1; }
      });
      colAvg[pid] = n > 0 ? sum / n : null;
    });
    // Overall (grand mean of cell grades)
    let gSum = 0, gN = 0;
    models.forEach(mk => promptIds.forEach(pid => {
      const g = matrix[mk]?.[pid]?.grade;
      if (g != null) { gSum += g; gN += 1; }
    }));
    const grandAvg = gN > 0 ? gSum / gN : null;

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
    }, svg).textContent = "avg";

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
        const grade = cell?.grade;
        const g = el("g", { class: "hm-cell", "data-model": modelKey, "data-prompt": pid }, svg);
        g.addEventListener("click", () => onClick(modelKey, pid));
        el("rect", {
          x: x + 1, y: y + 1, width: CELL - 2, height: ROW_H - 2,
          rx: 2, fill: gradeColor(grade),
        }, g);
        if (grade != null) {
          el("text", {
            x: x + CELL / 2, y: y + ROW_H / 2,
            class: "hm-grade-text", fill: textOnGrade(grade),
          }, g).textContent = Number.isInteger(grade) ? String(grade) : grade.toFixed(1);  // v2 grades are sample means
        }
        if (cell?.any_truncated) {
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
        rx: 2, fill: gradeColor(ra),
        stroke: "rgba(255,255,255,0.18)", "stroke-width": 1,
      }, rag);
      if (ra != null) {
        el("text", {
          x: rax + CELL / 2, y: y + ROW_H / 2,
          class: "hm-grade-text", fill: textOnGrade(ra),
        }, rag).textContent = ra.toFixed(1);
      }
    });

    // Bottom "avg" row
    const ay = SUMMARY_Y;
    el("text", {
      x: PAD_LEFT - 8, y: ay + ROW_H / 2 + 4,
      class: "hm-row-label", "text-anchor": "end",
      "font-weight": 600,
    }, svg).textContent = "avg";

    promptIds.forEach((pid, ci) => {
      const ca = colAvg[pid];
      const x = PAD_LEFT + ci * CELL;
      const g = el("g", { class: "hm-summary-cell" }, svg);
      el("rect", {
        x: x + 1, y: ay + 1, width: CELL - 2, height: ROW_H - 2,
        rx: 2, fill: gradeColor(ca),
        stroke: "rgba(255,255,255,0.18)", "stroke-width": 1,
      }, g);
      if (ca != null) {
        el("text", {
          x: x + CELL / 2, y: ay + ROW_H / 2,
          class: "hm-grade-text", fill: textOnGrade(ca),
        }, g).textContent = ca.toFixed(1);
      }
    });

    // Corner: grand mean
    const cx = SUMMARY_X;
    const cg = el("g", { class: "hm-summary-cell" }, svg);
    el("rect", {
      x: cx + 1, y: ay + 1, width: CELL - 2, height: ROW_H - 2,
      rx: 2, fill: gradeColor(grandAvg),
      stroke: "rgba(255,255,255,0.35)", "stroke-width": 1.5,
    }, cg);
    if (grandAvg != null) {
      el("text", {
        x: cx + CELL / 2, y: ay + ROW_H / 2,
        class: "hm-grade-text", fill: textOnGrade(grandAvg),
        "font-weight": 800,
      }, cg).textContent = grandAvg.toFixed(1);
    }

    return svg;
  };
})();
