// Shared building blocks: DOM helpers, number and date formatting, scales,
// and the SVG line chart (crosshair tooltip, direct end labels, annotations,
// reference lines, shaded bands). No dependencies.
const SVG_NS = "http://www.w3.org/2000/svg";
const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// DOM helpers

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }

  if (text != null) node.textContent = text;
  return node;
}

export function link(label, href) {
  const anchor = el("a", null, label);
  anchor.href = href;

  if (/^https?:/.test(href)) {
    anchor.target = "_blank";
    anchor.rel = "noreferrer noopener";
  }

  return anchor;
}

// ---------------------------------------------------------------------------
// Number and date formatting

export const trimZero = (text) => text.replace(/\.0+(?=\D*$)/, "");
export const MINUS = "−";

// Headline form, read aloud: "285 million", "1.43 billion", "5,012".
export function formatWords(value, unit) {
  const amount = value * (unit.multiplier ?? 1);

  if (unit.exact) return Math.round(amount).toLocaleString("en-US");
  if (amount >= 1e9) return `${trimZero((amount / 1e9).toFixed(amount >= 1e10 ? 0 : 2))} billion`;
  if (amount >= 1e6) return `${trimZero((amount / 1e6).toFixed(1))} million`;
  if (Math.abs(amount) < 100) return trimZero(amount.toFixed(1));
  return Math.round(amount).toLocaleString("en-US");
}

// Compact form for tiles, end labels and tooltips: "285M", "1.4B", "784".
export function formatCompact(amount, digits) {
  const abs = Math.abs(amount);
  const pick = (scaled) => trimZero(scaled.toFixed(digits ?? (Math.abs(scaled) >= 1000 ? 0 : 1)));

  if (abs >= 1e9) return `${pick(amount / 1e9)}B`;
  if (abs >= 1e6) return `${pick(amount / 1e6)}M`;
  if (abs >= 1e4) return `${Math.round(amount / 1e3)}K`;
  if (abs < 100) return trimZero(amount.toFixed(1));
  return Math.round(amount).toLocaleString("en-US");
}

// Axis ticks share one divisor and enough decimals to keep neighbors apart.
function tickFormatter(ticks, step) {
  const top = Math.max(...ticks.map(Math.abs));
  const [divisor, suffix] = top >= 1e9 ? [1e9, "B"] : top >= 1e6 ? [1e6, "M"] : top >= 1e4 ? [1e3, "K"] : [1, ""];
  // As many decimals as the step needs: 2.5 → 1, 0.25 → 2, 50 → 0.
  const scaledStep = step / divisor;
  let decimals = 0;

  while (decimals < 3 && Math.abs(Math.round(scaledStep * 10 ** decimals) - scaledStep * 10 ** decimals) > 1e-6) {
    decimals += 1;
  }

  return (value) => (value === 0 ? "0" : `${(value / divisor).toFixed(decimals)}${suffix}`);
}

export function parseDate(isoDate) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function formatDate(isoDate) {
  return new Date(parseDate(isoDate)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function formatMonth(isoDate) {
  return new Date(parseDate(isoDate)).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short" });
}

// Monthly series are dated to the last day of the month; say "Jul 2026".
function formatReading(isoDate, cadence) {
  return cadence === "Monthly" ? formatMonth(isoDate) : formatDate(isoDate);
}


// ---------------------------------------------------------------------------
// Scales

function niceStep(range, target) {
  const raw = range / target || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * magnitude;
}

function valueDomain(values, { zero = false, include = [], headroom = 0.06 } = {}) {
  const all = [...values, ...include];
  // A zero-based axis still extends below zero for negative values
  // (WTI's -$36.98 day in April 2020).
  let min = zero ? Math.min(0, ...all) : Math.min(...all);
  let max = Math.max(...all);

  if (min === max) {
    max += Math.abs(max) * 0.05 || 1;
    min = zero ? Math.min(0, min) : min - Math.abs(min) * 0.05;
  }

  const step = niceStep(max - min, 4);
  const lo = zero && min === 0 ? 0 : Math.floor(min / step) * step;
  const hi = max + (max - lo) * headroom;
  const ticks = [];

  for (let tick = lo; tick <= hi + step * 1e-9; tick += step) {
    ticks.push(Number(tick.toPrecision(12)));
  }

  return { lo, hi, ticks, step };
}

function timeTicks(t0, t1, width) {
  const years = (t1 - t0) / (365.25 * DAY);
  const maxLabels = Math.max(2, Math.floor(width / 76));
  const ticks = [];

  if (years >= 3) {
    const step = [1, 2, 5, 10, 20].find((candidate) => years / candidate <= maxLabels) ?? 20;
    const first = new Date(t0).getUTCFullYear() + 1;

    for (let year = Math.ceil(first / step) * step; Date.UTC(year, 0, 1) <= t1; year += step) {
      ticks.push({ t: Date.UTC(year, 0, 1), label: String(year) });
    }

    return ticks;
  }

  const months = years * 12;
  const step = [1, 2, 3, 6, 12].find((candidate) => months / candidate <= maxLabels) ?? 12;
  const start = new Date(t0);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth() + 1;

  while (month % step !== 0) month += 1;

  for (;;) {
    year += Math.floor(month / 12);
    month %= 12;
    const t = Date.UTC(year, month, 1);

    if (t > t1) break;

    const date = new Date(t);
    const label =
      month === 0 || ticks.length === 0
        ? date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "numeric" })
        : date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
    ticks.push({ t, label });
    month += step;
  }

  return ticks;
}

function nearestIndex(times, t) {
  let low = 0;
  let high = times.length - 1;

  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (times[mid] <= t) low = mid;
    else high = mid;
  }

  return Math.abs(times[high] - t) < Math.abs(times[low] - t) ? high : low;
}

export function latestAtOrBefore(series, date) {
  let low = 0;
  let high = series.length - 1;
  let best = null;

  while (low <= high) {
    const mid = (low + high) >> 1;

    if (series[mid].date <= date) {
      best = series[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function linePath(points, x, y) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.t).toFixed(1)},${y(point.v).toFixed(1)}`).join("");
}

function areaPath(points, x, y, baseY) {
  if (points.length < 2) return "";

  return (
    `M${x(points[0].t).toFixed(1)},${baseY}` +
    points.map((point) => `L${x(point.t).toFixed(1)},${y(point.v).toFixed(1)}`).join("") +
    `L${x(points.at(-1).t).toFixed(1)},${baseY}Z`
  );
}

// ---------------------------------------------------------------------------
// Line chart: one or more stacked panels sharing a time axis, with a
// crosshair tooltip (pointer and arrow keys), direct end labels, optional
// annotations, reference lines and shaded bands.
//
// panel = { series:[{date,value}], title?, zero?, neutral?, height,
//           unit:{multiplier, short}, format?(value)->string,
//           notes?:[{date,label,place}], refs?:[{value,label}], endLabel? }

export function lineChart({ panels, bands = [], label, readout, cadence }) {
  const figure = el("figure", "chart");
  const tip = el("div", "chart-tip");
  tip.hidden = true;
  figure.append(tip);

  const prepared = panels.map((panel) => {
    const points = panel.series.map((point) => ({ t: parseDate(point.date), v: point.value, date: point.date }));
    return { ...panel, points, times: points.map((point) => point.t) };
  });
  const allTimes = prepared.flatMap((panel) => panel.points.map((point) => point.t));
  const t0 = Math.min(...allTimes);
  const t1 = Math.max(...allTimes);
  const base = prepared[0].points;
  const baseTimes = base.map((point) => point.t);

  let state = null;

  const draw = () => {
    const width = figure.clientWidth;

    if (!width || state?.width === width) return;

    const compact = width < 520;
    // Y labels get their own gutter so no data point can sit on one.
    const pad = { top: bands.length ? 26 : 14, right: compact ? 52 : 64, bottom: 26, left: 44 };
    const gap = 30;
    const plotW = width - pad.left - pad.right;
    let offset = pad.top;
    const layouts = prepared.map((panel) => {
      const height = compact ? Math.round(panel.height * 0.8) : panel.height;
      const top = offset + (panel.title ? 18 : 0);
      offset = top + height + gap;
      return { panel, top, height };
    });
    const totalH = offset - gap + pad.bottom;
    const x = (t) => pad.left + ((t - t0) / (t1 - t0 || 1)) * plotW;

    const root = svg("svg", {
      viewBox: `0 0 ${width} ${totalH}`,
      width,
      height: totalH,
      role: "img",
      "aria-label": label,
      tabindex: "0"
    });

    // Shaded bands (administrations) behind every panel.
    for (const band of bands) {
      const start = Math.max(parseDate(band.start), t0);
      const end = Math.min(parseDate(band.end), t1);

      if (end <= start) continue;

      const left = x(start);
      const bandW = x(end) - left;

      for (const { top, height } of layouts) {
        root.append(svg("rect", { x: left, y: top, width: bandW, height, class: band.className }));
      }

      const text = bandW > 64 ? band.label : bandW > 30 ? band.short : "";

      if (text) {
        root.append(svg("text", { x: left + bandW / 2, y: 14, "text-anchor": "middle", class: "band-label" }, text));
      }
    }

    for (const layout of layouts) {
      const { panel, top, height } = layout;
      const multiplier = panel.unit.multiplier ?? 1;
      const values = panel.points.map((point) => point.v);
      const domain = valueDomain(values, {
        zero: panel.zero,
        include: [...(panel.refs ?? []).map((ref) => ref.value), ...(panel.steps ?? []).flatMap((step) => step.points.map((point) => point.value))],
        headroom: panel.notes?.length ? 0.16 : 0.06
      });
      const y = (value) => top + (1 - (value - domain.lo) / (domain.hi - domain.lo)) * height;
      const tick = tickFormatter(
        domain.ticks.map((value) => value * multiplier),
        domain.step * multiplier
      );
      layout.y = y;

      if (panel.title) {
        root.append(svg("text", { x: 0, y: top - 10, class: "panel-title" }, panel.title));
      }

      for (const value of domain.ticks) {
        const ty = Math.round(y(value)) + 0.5;
        root.append(svg("line", { x1: pad.left, x2: pad.left + plotW, y1: ty, y2: ty, class: value === 0 || value === domain.lo ? "baseline" : "grid" }));
        root.append(svg("text", { x: pad.left - 8, y: ty + 4, "text-anchor": "end", class: "tick" }, tick(value * multiplier)));
      }

      const bottom = top + height;

      if (!panel.neutral && panel.fill !== false) {
        root.append(svg("path", { d: areaPath(panel.points, x, y, y(domain.lo)), class: "area" }));
      }

      root.append(svg("path", { d: linePath(panel.points, x, y), class: panel.neutral ? "line neutral" : "line" }));

      // Dots mark real readings where they are sparse: short series, and the
      // monthly archive stretch before the site's own daily readings began.
      for (const point of panel.points) {
        if (panel.points.length <= 40 || (panel.dotsBefore && point.date < panel.dotsBefore)) {
          root.append(svg("circle", { cx: x(point.t), cy: y(point.v), r: panel.points.length <= 40 ? 3 : 2.5, class: panel.neutral ? "dot neutral" : "dot" }));
        }
      }

      for (const ref of panel.refs ?? []) {
        const ry = Math.round(y(ref.value)) + 0.5;
        root.append(svg("line", { x1: pad.left, x2: pad.left + plotW, y1: ry, y2: ry, class: "ref-line" }));
        const align = ref.align ?? "end";

        if (align === "outside") {
          // In the right margin beside the line, clear of the data.
          root.append(svg("text", { x: pad.left + plotW + 8, y: ry + 4, class: "note-text" }, ref.label));
        } else {
          const below = align.endsWith("-below");
          const side = align.replace("-below", "");
          const lx = side === "start" ? pad.left + 6 : side === "middle" ? pad.left + plotW / 2 : pad.left + plotW;
          root.append(svg("text", { x: lx, y: below ? ry + 15 : ry - 6, "text-anchor": side, class: "note-text" }, ref.label));
        }
      }

      // A threshold that changes over time (e.g. seasonal norms), drawn as a
      // dashed staircase with its label at the start.
      for (const step of panel.steps ?? []) {
        const points = step.points.map((point) => ({ x: Math.max(x(parseDate(point.date)), pad.left), y: y(point.value) }));
        let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
        points.slice(1).forEach((point) => {
          d += `H${point.x.toFixed(1)}V${point.y.toFixed(1)}`;
        });
        d += `H${(pad.left + plotW).toFixed(1)}`;
        root.append(svg("path", { d, class: "ref-line", fill: "none" }));
        root.append(svg("text", { x: points[0].x + 6, y: points[0].y - 6, class: "note-text" }, step.label));
      }

      // Labels that would overlap an earlier one move down a line at a time.
      const placed = [];

      for (const note of panel.notes ?? []) {
        const mark = compact && note.short ? { ...note, label: note.short } : note;
        const point = panel.points[nearestIndex(panel.times, parseDate(mark.date))];
        const px = x(point.t);
        const py = y(point.v);
        const below = mark.place === "below";
        const width = mark.label.length * 6.3;
        // Prefer the side with more room, but never run past the plot edges
        // (on narrow screens a left-running label would cover the y labels).
        let anchor = px > pad.left + plotW * 0.6 ? "end" : "start";
        if (anchor === "end" && px - 6 - width < pad.left + 12) anchor = "start";
        else if (anchor === "start" && px + 6 + width > pad.left + plotW + pad.right) anchor = "end";
        const tx = anchor === "end" ? px - 6 : px + 6;
        const [x1, x2] = anchor === "end" ? [tx - width, tx] : [tx, tx + width];
        let ty = below ? Math.min(py + (mark.dy ?? 30), bottom - 8) : Math.max(py - 16, top + 10);

        while (placed.some((box) => x1 < box.x2 && x2 > box.x1 && Math.abs(ty - box.y) < 15)) {
          ty += 16;
        }

        placed.push({ x1, x2, y: ty });
        root.append(svg("line", { x1: px, x2: px, y1: below ? py + 6 : py - 6, y2: below ? ty - 11 : ty + 4, class: "note-line" }));
        root.append(svg("circle", { cx: px, cy: py, r: 4, class: panel.neutral ? "dot neutral" : "dot" }));
        root.append(svg("text", { x: tx, y: ty, "text-anchor": anchor, class: "note-text" }, mark.label));
      }

      const last = panel.points.at(-1);
      root.append(svg("circle", { cx: x(last.t), cy: y(last.v), r: 4, class: panel.neutral ? "dot neutral" : "dot" }));
      root.append(
        svg("text", { x: x(last.t) + 8, y: y(last.v) + 4, class: "end-label" }, panel.endLabel ?? formatCompact(last.v * multiplier))
      );
    }

    // Shared time axis under the last panel.
    const axisY = offset - gap + 18;

    for (const tickMark of timeTicks(t0, t1, plotW)) {
      const tx = x(tickMark.t);
      if (tx < pad.left + 16 || tx > pad.left + plotW - 16) continue;
      root.append(svg("text", { x: tx, y: axisY, "text-anchor": "middle", class: "tick" }, tickMark.label));
    }

    // Crosshair layer.
    const cross = svg("line", { y1: pad.top, y2: offset - gap, class: "cross", visibility: "hidden" });
    const hoverDots = layouts.map(({ panel }) => svg("circle", { r: 4, class: panel.neutral ? "dot neutral" : "dot", visibility: "hidden" }));
    root.append(cross, ...hoverDots);

    const show = (index) => {
      const point = base[index];
      const px = x(point.t);
      cross.setAttribute("x1", px);
      cross.setAttribute("x2", px);
      cross.setAttribute("visibility", "visible");

      const rows = layouts.map((layout, panelIndex) => {
        const panel = layout.panel;
        const match = panelIndex === 0 ? point : panel.points[nearestIndex(panel.times, point.t)];
        const dot = hoverDots[panelIndex];

        if (match && Math.abs(match.t - point.t) < 45 * DAY) {
          dot.setAttribute("cx", x(match.t));
          dot.setAttribute("cy", layout.y(match.v));
          dot.setAttribute("visibility", "visible");
          return { panel, value: match.v };
        }

        dot.setAttribute("visibility", "hidden");
        return { panel, value: null };
      });

      tip.replaceChildren(el("div", "tip-date", formatReading(point.date, cadence)));

      for (const row of rows) {
        if (row.value == null) continue;
        const line = el("div", "tip-row");
        line.append(el("span", row.panel.neutral ? "tip-key neutral" : "tip-key"));
        line.append(el("b", null, row.panel.format ? row.panel.format(row.value) : `${formatCompact(row.value * (row.panel.unit.multiplier ?? 1))} ${row.panel.unit.short}`));

        if (row.panel.tipLabel) line.append(document.createTextNode(row.panel.tipLabel));
        tip.append(line);
      }

      const extra = readout?.(point);

      if (extra) tip.append(el("div", "tip-row", extra));

      // Sit beside the crosshair, flipping left near the right edge, so the
      // hovered point stays visible.
      tip.hidden = false;
      const tipW = tip.offsetWidth;
      tip.style.left = `${px + 14 + tipW <= width ? px + 14 : Math.max(px - 14 - tipW, 0)}px`;
      tip.style.top = `${pad.top}px`;
      state.index = index;
    };

    const hide = () => {
      cross.setAttribute("visibility", "hidden");
      hoverDots.forEach((dot) => dot.setAttribute("visibility", "hidden"));
      tip.hidden = true;
    };

    root.addEventListener("pointermove", (event) => {
      const rect = root.getBoundingClientRect();
      const t = t0 + ((event.clientX - rect.left - pad.left) / plotW) * (t1 - t0);
      show(nearestIndex(baseTimes, t));
    });
    root.addEventListener("pointerleave", hide);
    root.addEventListener("blur", hide);
    root.addEventListener("focus", () => show(state.index ?? base.length - 1));
    root.addEventListener("keydown", (event) => {
      const stepSize = event.shiftKey ? 10 : 1;
      const moves = { ArrowLeft: -stepSize, ArrowRight: stepSize, Home: -Infinity, End: Infinity };

      if (!(event.key in moves)) return;

      event.preventDefault();
      show(Math.min(Math.max((state.index ?? base.length - 1) + moves[event.key], 0), base.length - 1));
    });

    figure.querySelector("svg")?.remove();
    figure.prepend(root);
    state = { width, index: state?.index ?? null };
  };

  new ResizeObserver(() => requestAnimationFrame(draw)).observe(figure);
  return figure;
}


// ---------------------------------------------------------------------------
// Small figures

export function barList(items, format) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const list = el("ul", "bars");

  for (const item of items) {
    const row = el("li");
    const label = el("span", "bar-label", item.label);

    if (item.detail) label.append(el("small", null, item.detail));

    const bar = el("span", "bar");
    bar.style.width = `${(item.value / max) * 100}%`;
    row.append(label, el("span", "bar-value", format(item.value)), bar);
    list.append(row);
  }

  return list;
}

// Shares of 100% on a common track, with an optional target tick.

// Columns for a weekly quantity (e.g. barrels leaving the reserve each week),
// with a per-column tooltip on hover, touch, focus and arrow keys, and a
// direct label on the tallest column.
export function columnChart({ items, label, height = 200, format, tipLabel = "", refLine }) {
  const figure = el("figure", "chart");
  const tip = el("div", "chart-tip");
  tip.hidden = true;
  figure.append(tip);
  let drawnWidth = 0;
  let active = null;

  const draw = () => {
    const width = figure.clientWidth;

    if (!width || width === drawnWidth) return;

    drawnWidth = width;
    const pad = { top: 18, right: 8, bottom: 26, left: 44 };
    const plotW = width - pad.left - pad.right;
    const totalH = height + pad.top + pad.bottom;
    const values = items.map((item) => item.value);
    const domain = valueDomain(values, { zero: true, include: refLine ? [refLine.value] : [], headroom: 0.14 });
    const y = (value) => pad.top + (1 - (value - domain.lo) / (domain.hi - domain.lo)) * height;
    const tick = tickFormatter(domain.ticks, domain.step);
    const slot = plotW / items.length;
    const barW = Math.min(24, Math.max(slot - 2, 1));
    const left = (index) => pad.left + index * slot + (slot - barW) / 2;
    const root = svg("svg", { viewBox: `0 0 ${width} ${totalH}`, width, height: totalH, role: "img", "aria-label": label, tabindex: "0" });

    for (const value of domain.ticks) {
      const ty = Math.round(y(value)) + 0.5;
      root.append(svg("line", { x1: pad.left, x2: pad.left + plotW, y1: ty, y2: ty, class: value === 0 ? "baseline" : "grid" }));
      root.append(svg("text", { x: pad.left - 8, y: ty + 4, "text-anchor": "end", class: "tick" }, tick(value)));
    }

    // Square at the baseline, 4px rounded at the data end.
    const bars = items.map((item, index) => {
      const top = y(Math.max(item.value, 0));
      const base = y(0);
      const h = Math.max(base - top, 0);
      const r = Math.min(4, barW / 2, h);
      const x = left(index);
      const d = `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${base}Z`;
      const bar = svg("path", { d, class: "column" });
      root.append(bar);
      return bar;
    });

    if (refLine) {
      const ry = Math.round(y(refLine.value)) + 0.5;
      root.append(svg("line", { x1: pad.left, x2: pad.left + plotW, y1: ry, y2: ry, class: "ref-line" }));
      root.append(svg("text", { x: pad.left + plotW, y: ry - 6, "text-anchor": "end", class: "note-text" }, refLine.label));
    }

    const peak = values.indexOf(Math.max(...values));
    const peakX = left(peak) + barW / 2;
    root.append(
      svg("text", { x: peakX, y: y(values[peak]) - 6, "text-anchor": peakX > pad.left + plotW - 40 ? "end" : "middle", class: "end-label" }, format(values[peak]))
    );

    // Month labels under the first week of each month, thinned to fit.
    let lastX = -Infinity;
    items.forEach((item, index) => {
      if (index > 0 && item.date.slice(0, 7) === items[index - 1].date.slice(0, 7)) return;
      const cx = left(index) + barW / 2;
      if (cx - lastX < 44) return;
      lastX = cx;
      const text = new Date(parseDate(item.date)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
      root.append(svg("text", { x: cx, y: totalH - 8, "text-anchor": "middle", class: "tick" }, text));
    });

    const show = (index) => {
      if (active != null) bars[active]?.classList.remove("active");
      active = index;
      bars[index].classList.add("active");
      const item = items[index];
      tip.replaceChildren(el("div", "tip-date", `Week ending ${formatDate(item.date)}`));
      const row = el("div", "tip-row");
      row.append(el("span", "tip-key"), el("b", null, format(item.value)));
      if (tipLabel) row.append(document.createTextNode(tipLabel));
      tip.append(row);
      tip.hidden = false;
      const cx = left(index) + barW / 2;
      const tipW = tip.offsetWidth;
      tip.style.left = `${cx + 12 + tipW <= width ? cx + 12 : Math.max(cx - 12 - tipW, 0)}px`;
      tip.style.top = `${pad.top}px`;
    };

    const hide = () => {
      if (active != null) bars[active]?.classList.remove("active");
      tip.hidden = true;
    };

    root.addEventListener("pointermove", (event) => {
      const rect = root.getBoundingClientRect();
      const index = Math.floor((event.clientX - rect.left - pad.left) / slot);
      if (index >= 0 && index < items.length) show(index);
    });
    root.addEventListener("pointerleave", hide);
    root.addEventListener("blur", hide);
    root.addEventListener("focus", () => show(active ?? items.length - 1));
    root.addEventListener("keydown", (event) => {
      const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
      if (!(event.key in moves)) return;
      event.preventDefault();
      show(Math.min(Math.max((active ?? items.length - 1) + moves[event.key], 0), items.length - 1));
    });

    figure.querySelector("svg")?.remove();
    figure.prepend(root);
  };

  new ResizeObserver(() => requestAnimationFrame(draw)).observe(figure);
  return figure;
}
