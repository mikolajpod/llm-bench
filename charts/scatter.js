// Quality (avg_grade) vs Speed (median_decode_tps) scatter plot.
// Dense clusters (esp. "all" mode = model×stage) made always-on labels overlap.
// Fix: smaller dots, greedy label de-collision (label as many as fit without
// overlap, in leaderboard/priority order), text halo for legibility, and
// hover-reveal (native <title> tooltip + show the hidden label on hover).
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  function el(t, a = {}, p = null) {
    const e = document.createElementNS(SVG_NS, t);
    for (const [k, v] of Object.entries(a)) if (v != null) e.setAttribute(k, String(v));
    if (p) p.appendChild(e);
    return e;
  }

  // opts.xKey / xLabel / xFmt pick the x measure (default: median decode tok/s, linear axis).
  // opts.xLog: log10 axis with 1-2-5 ticks (for times / token counts spanning 2 decades).
  // opts.frontier: "low" draws the Pareto front of points no other point beats on both
  // higher grade AND lower x (time, tokens) — the efficient models.
  window.renderScatter = function (container, leaderboard, modelMeta, opts = {}) {
    const onClick = opts.onClickModel || (() => {});
    const xKey = opts.xKey || "median_decode_tps";
    const xFmt = opts.xFmt || (v => `${Math.round(v)} t/s`);
    // opts.hScale: vertical stretch (zoom toggle) — more room between grade levels for labels
    const W = 900, H = 480 * (opts.hScale || 1);
    const PAD = { l: 60, r: 30, t: 30, b: 50 };
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;

    const rows = leaderboard.filter(r => r[xKey]);
    const xs = rows.map(r => r[xKey]);
    const ys = leaderboard.map(r => r.avg_grade);
    const yMin = Math.max(0, Math.floor(Math.min(...ys, 5) - 1));
    const yMax = 10;

    let xScale, xTicks;
    if (opts.xLog) {
      // bounds snap to the nearest 1-2-5 step around the data, not whole decades
      const steps = [];
      for (let d = 0.1; d <= 1e6; d *= 10) for (const m of [1, 2, 5]) steps.push(Math.round(d * m * 10) / 10);
      const lo = steps.filter(s => s <= Math.min(...xs)).pop(), hi = steps.find(s => s >= Math.max(...xs));
      const l0 = Math.log10(lo), l1 = Math.log10(hi);
      xScale = x => PAD.l + ((Math.log10(x) - l0) / (l1 - l0)) * plotW;
      xTicks = steps.filter(s => s >= lo && s <= hi);
    } else {
      const xMax = Math.max(30, Math.ceil(Math.max(...xs) / 5) * 5);
      xScale = x => PAD.l + (x / xMax) * plotW;
      xTicks = [];
      for (let v = 0; v <= xMax; v += 5) xTicks.push(v);
    }
    const yScale = y => PAD.t + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    container.innerHTML = "";
    const svg = el("svg", {
      class: "scatter-svg", viewBox: `0 0 ${W} ${H}`, width: "100%",
    }, container);

    el("line", { x1: PAD.l, x2: W - PAD.r, y1: H - PAD.b, y2: H - PAD.b, class: "sc-axis", "stroke-width": 1 }, svg);
    el("line", { x1: PAD.l, x2: PAD.l, y1: PAD.t, y2: H - PAD.b, class: "sc-axis", "stroke-width": 1 }, svg);

    for (const [i, v] of xTicks.entries()) {
      const x = xScale(v);
      el("line", { x1: x, x2: x, y1: H - PAD.b, y2: H - PAD.b + 4, class: "sc-axis" }, svg);
      el("text", { x, y: H - PAD.b + 18, "text-anchor": "middle", class: "sc-axis-text" }, svg).textContent =
        v >= 1000 ? `${v / 1000}k` : String(v);
      if (i > 0) el("line", { x1: x, x2: x, y1: PAD.t, y2: H - PAD.b, stroke: "#23282f", "stroke-width": 1, "stroke-dasharray": "2 4" }, svg);
    }
    for (let v = yMin; v <= yMax; v += 1) {
      const y = yScale(v);
      el("line", { x1: PAD.l - 4, x2: PAD.l, y1: y, y2: y, class: "sc-axis" }, svg);
      el("text", { x: PAD.l - 8, y: y + 4, "text-anchor": "end", class: "sc-axis-text" }, svg).textContent = String(v);
      if (v > yMin) el("line", { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, stroke: "#23282f", "stroke-width": 1, "stroke-dasharray": "2 4" }, svg);
    }

    el("text", { x: PAD.l + plotW / 2, y: H - 12, "text-anchor": "middle", class: "sc-axis-title" }, svg).textContent =
      opts.xLabel || "decode tokens/s (mediana)";
    el("text", { x: -PAD.t - plotH / 2, y: 18, "text-anchor": "middle", class: "sc-axis-title", transform: "rotate(-90)" }, svg).textContent = "średnia ocena";

    const pts = rows.map(row => {
      const m = modelMeta[row.model] || {};
      const lbl = (m.short_name || row.model).replace(/^(unsloth|nvidia|qwen|mistralai)\//, "");
      return {
        row, m, lbl,
        cx: xScale(row[xKey]),
        cy: yScale(row.avg_grade),
        color: m.family_color || "#888",
      };
    });

    if (opts.frontier === "low" || opts.frontier === "high") {
      // walk from the cheap end ("low": small x is better, "high": big x is better); a point is on the
      // front if it beats on grade every point that is better than it on x
      const sgn = opts.frontier === "low" ? 1 : -1;
      const front = [];
      let best = -Infinity;
      for (const p of pts.slice().sort((a, b) => sgn * (a.row[xKey] - b.row[xKey]))) {
        if (p.row.avg_grade > best) { front.push(p); best = p.row.avg_grade; p.onFront = true; }
      }
      const d = front.map((p, i) => (i ? `H${p.cx}V${p.cy}` : `M${p.cx},${p.cy}`)).join("");
      el("path", { d, fill: "none", stroke: "#6aa6ff", "stroke-width": 2, "stroke-dasharray": "6 4", opacity: 0.85 }, svg);
      el("text", { x: opts.frontier === "low" ? W - PAD.r : PAD.l + 8, y: PAD.t + 12,
                   "text-anchor": opts.frontier === "low" ? "end" : "start", class: "sc-axis-text" }, svg).textContent =
        "- - - front Pareto: nikt nie jest lepszy i jednocześnie szybszy";
    }

    // ── dots first (so labels/leaders paint on top) ──
    const R = 4;                       // inner dot radius
    for (const p of pts) {
      const g = el("g", { class: "sc-point", "data-model": p.row.model }, svg);
      g.addEventListener("click", () => onClick(p.row.model));
      el("title", {}, g).textContent =
        `${p.m.short_name || p.row.model} · ocena ${p.row.avg_grade?.toFixed(1)} · ${xFmt(p.row[xKey])}` +
        (opts.tooltipExtra ? opts.tooltipExtra(p.row) : "") + (p.onFront ? " · front Pareto" : "");
      el("circle", { cx: p.cx, cy: p.cy, r: R + 2.5, fill: p.color, opacity: 0.15 }, g);
      el("circle", { cx: p.cx, cy: p.cy, r: R, fill: p.color, opacity: 0.9, stroke: "#0f1115", "stroke-width": 1.2 }, g);
      p.g = g;
    }

    // ── greedy label de-collision ──
    // Place labels in incoming (priority/sort) order; keep one only if its box
    // doesn't overlap an already-placed one. Try right/left and small vertical
    // nudges; if nothing fits, keep the label but hidden (revealed on hover).
    const FS = 9.5, CW = FS * 0.56, LH = 12;
    const placed = [];
    const hit = b => placed.some(q => b.x1 < q.x2 && b.x2 > q.x1 && b.y1 < q.y2 && b.y2 > q.y1);
    const inB = b => b.y1 >= PAD.t && b.y2 <= H - PAD.b &&
      ((b.side === "r" && b.x2 <= W - PAD.r) || (b.side === "l" && b.x1 >= PAD.l));

    function boxFor(p, side, dy) {
      const w = p.lbl.length * CW, ly = p.cy + dy;
      const tx = side === "r" ? p.cx + R + 3 : p.cx - R - 3;
      const x1 = side === "r" ? tx : tx - w;
      const x2 = side === "r" ? tx + w : tx;
      return { side, dy, tx, ly, x1, x2, y1: ly - FS, y2: ly + 3 };
    }
    const CANDS = [["r", 0], ["l", 0], ["r", -LH], ["r", LH], ["l", -LH], ["l", LH]];

    for (const p of pts) {
      let chosen = null, fallback = null;
      for (const [side, dy] of CANDS) {
        const b = boxFor(p, side, dy);
        if (!inB(b)) continue;
        if (!fallback) fallback = b;          // first in-bounds spot, even if it collides
        if (!hit(b)) { chosen = b; break; }
      }
      const b = chosen || fallback || boxFor(p, "r", 0);
      const hidden = !chosen;
      if (chosen) placed.push(chosen);
      if (Math.abs(b.dy) > 1) {               // leader line for vertically nudged labels
        el("line", {
          x1: p.cx, y1: p.cy, x2: b.tx, y2: b.ly, class: "sc-leader",
        }, p.g);
      }
      el("text", {
        x: b.tx, y: b.ly + 3, "text-anchor": b.side === "r" ? "start" : "end",
        class: "sc-label" + (hidden ? " sc-label-hidden" : ""),
        "font-size": FS, "paint-order": "stroke", stroke: "#0f1115",
        "stroke-width": 3, "stroke-linejoin": "round",
      }, p.g).textContent = p.lbl;
    }

    // hover: raise point to top + (CSS) reveal hidden label
    for (const p of pts) {
      p.g.addEventListener("mouseenter", () => { svg.appendChild(p.g); p.g.classList.add("hl"); });
      p.g.addEventListener("mouseleave", () => p.g.classList.remove("hl"));
    }

    return svg;
  };
})();
