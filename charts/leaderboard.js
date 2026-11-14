// Leaderboard horizontal bar chart (SVG)
// Columns to the right of bar: avg / tok/s / tokens / wall.
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs = {}, parent = null) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      e.setAttribute(k, String(v));
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  window.renderLeaderboard = function (container, leaderboard, modelMeta, opts = {}) {
    const onClickModel = opts.onClickModel || (() => {});
    const onSortClick = opts.onSortClick || (() => {});
    const currentSort = opts.currentSort || "avg_grade";
    const currentDir = opts.currentDir || "desc";
    const W = 1100;
    const ROW = 28;
    const PAD_TOP = 38;
    const PAD_BOTTOM = 16;
    const PAD_LEFT = 280;
    // Right-side numeric columns: 4 × COL_W + extra padding
    const COL_W = 58;
    // Etap 5 32k view (2026-11-14): rows carrying avg_grade_16k get a Δ-vs-16k column + a 16k tick on the bar
    const has16 = leaderboard.some(r => r.avg_grade_16k != null);
    const PAD_RIGHT = (has16 ? 5 : 4) * COL_W + 12;
    const H = PAD_TOP + leaderboard.length * ROW + PAD_BOTTOM;
    const BAR_W = W - PAD_LEFT - PAD_RIGHT;
    const SCALE = BAR_W / 10;

    container.innerHTML = "";
    const svg = el("svg", {
      class: "leaderboard-svg",
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "xMinYMin meet",
      role: "img",
    }, container);

    // Vertical gridlines + axis ticks on the bar area
    for (let g = 0; g <= 10; g += 2) {
      const x = PAD_LEFT + g * SCALE;
      el("line", {
        x1: x, x2: x, y1: PAD_TOP - 6, y2: H - PAD_BOTTOM,
        stroke: "#2a313c", "stroke-width": 1,
        "stroke-dasharray": g === 0 ? "0" : "2 4",
      }, svg);
      el("text", {
        x: x, y: PAD_TOP - 10,
        "text-anchor": "middle", class: "lb-axis-tick",
      }, svg).textContent = String(g);
    }

    // Bar area title (informational, not a sort header — "avg" column does that)
    el("text", {
      x: PAD_LEFT + BAR_W / 2, y: 16,
      "text-anchor": "middle", class: "lb-label muted",
      "font-size": 11,
    }, svg).textContent = "średnia ocena (0–10)";

    // Right-column headers — clickable, sort by that column.
    // The bar-area title "ocena" doubles as a sort header for avg_grade.
    const cols = [
      { label: "avg",     key: "avg_grade" },
      ...(has16 ? [{ label: "Δ 16k", key: "delta_16k" }] : []),
      { label: "tok/s",   key: "median_decode_tps" },
      { label: "tokenów", key: "median_predicted_n" },
      { label: "wall s",  key: "median_wall_seconds" },
    ];
    const COLS_X0 = PAD_LEFT + BAR_W + 8;
    const arrow = d => d === "asc" ? "↑" : "↓";
    cols.forEach((c, i) => {
      const g = el("g", {
        class: "lb-sort-header",
        "data-col": c.key,
        style: "cursor: pointer",
      }, svg);
      g.addEventListener("click", () => onSortClick(c.key));
      const isActive = c.key === currentSort;
      // Arrow goes on the LEFT (label is right-aligned, so label stays anchored at the
      // column's right edge regardless of active state — only the arrow shifts in/out).
      el("text", {
        x: COLS_X0 + i * COL_W + COL_W - 4,
        y: 16,
        "text-anchor": "end",
        class: "lb-label",
        "font-weight": 600,
        fill: isActive ? "var(--accent)" : "var(--fg-2)",
      }, g).textContent = (isActive ? arrow(currentDir) + " " : "") + c.label;
    });

    leaderboard.forEach((row, i) => {
      const y = PAD_TOP + i * ROW;
      const m = modelMeta[row.model] || {};
      const color = m.family_color || "#6aa6ff";

      const g = el("g", { class: "lb-bar", "data-model": row.model }, svg);
      g.addEventListener("click", () => onClickModel(row.model));

      el("text", {
        x: PAD_LEFT - 8, y: y + ROW / 2 + 4,
        "text-anchor": "end", class: "lb-label",
      }, g).textContent = m.short_name || row.model;

      el("rect", {
        x: PAD_LEFT - 4, y: y + ROW / 2 - 7,
        width: 3, height: 14, rx: 1.5, fill: color,
      }, g);

      el("rect", {
        x: PAD_LEFT, y: y + 4,
        width: BAR_W, height: ROW - 8,
        fill: "#1f242c", rx: 3,
      }, g);
      el("rect", {
        class: "lb-bar-rect",
        x: PAD_LEFT, y: y + 4,
        width: Math.max(2, row.avg_grade * SCALE), height: ROW - 8,
        fill: color, rx: 3, opacity: 0.85,
      }, g);

      if (row.avg_grade_16k != null && Math.abs(row.avg_grade - row.avg_grade_16k) >= 0.005) {
        const x16 = PAD_LEFT + row.avg_grade_16k * SCALE;  // where the entry stood at 16k
        el("line", { x1: x16, x2: x16, y1: y + 2, y2: y + ROW - 2, stroke: "#e6e6e6", "stroke-width": 2,
                     "stroke-dasharray": "2 2", opacity: 0.9 }, g);
        el("title", {}, g).textContent = `16k: ${row.avg_grade_16k.toFixed(2)} → 32k: ${row.avg_grade.toFixed(2)}` +
          (row.n_replaced_32k ? ` (${row.n_replaced_32k} próbek przeliczonych do 32k)` : "");
      }
      if (row.trunc_count > 0) {
        const tx = PAD_LEFT + Math.max(2, row.avg_grade * SCALE) - 18;
        el("circle", { cx: tx + 8, cy: y + ROW / 2, r: 6, fill: "#ff6b6b", opacity: 0.95 }, g);
        el("text", {
          x: tx + 8, y: y + ROW / 2 + 3.5,
          "text-anchor": "middle", "font-size": 9, "font-weight": 700, fill: "#fff",
        }, g).textContent = "!";
      }

      // Right-side numeric columns
      const values = [
        row.avg_grade != null ? row.avg_grade.toFixed(2) : "—",
        ...(has16 ? [row.delta_16k == null ? "—" : (Math.abs(row.delta_16k) < 0.005 ? "0" :
                     (row.delta_16k > 0 ? "+" : "") + row.delta_16k.toFixed(2))] : []),
        row.median_decode_tps != null ? row.median_decode_tps.toFixed(1) : "—",
        row.median_predicted_n != null ? String(row.median_predicted_n) : "—",
        row.median_wall_seconds != null ? row.median_wall_seconds.toFixed(1) + "s" : "—",
      ];
      values.forEach((v, ci) => {
        el("text", {
          x: COLS_X0 + ci * COL_W + COL_W - 4,
          y: y + ROW / 2 + 4,
          class: ci === 0 ? "lb-value" : "lb-label",
          "text-anchor": "end",
        }, g).textContent = v;
      });
    });

    return svg;
  };
})();
