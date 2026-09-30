import {
  MINUS,
  columnChart,
  el,
  formatCompact,
  formatDate,
  formatMonth,
  formatWords,
  latestAtOrBefore,
  lineChart,
  link,
  parseDate,
  barList,
  trimZero
} from "./chart.js";
import {
  CAPACITY,
  CLAIMS,
  DESIGN_RATE,
  DOE_REBUTTAL,
  FLOOR,
  FURTHER_READING,
  LOANS,
  MANDATED_SALES,
  RELEASES,
  RELEASE_2026,
  SOURCES,
  UNKNOWNS,
  WEAR
} from "./facts.js";

// EIA reports the reserve in thousand barrels; every volume below is too.
const UNIT = { multiplier: 1000, short: "bbl", word: "barrels" };
const DAY = 86_400_000;

const words = (thousand) => formatWords(thousand, UNIT);
const millions = (thousand) => trimZero((thousand / 1000).toFixed(1));
const monthName = (isoDate) => new Date(parseDate(isoDate)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long" });
const monthYear = (isoDate) =>
  new Date(parseDate(isoDate)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

// ---------------------------------------------------------------------------
// Derived series

// Mean daily price over the days a weekly reading covers: after the previous
// reading, up to and including this one.
function averagePrice(daily, afterDate, throughDate) {
  let low = 0;
  let high = daily.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (daily[mid].date <= afterDate) low = mid + 1;
    else high = mid;
  }

  let sum = 0;
  let count = 0;

  for (let index = low; index < daily.length && daily[index].date <= throughDate; index += 1) {
    sum += daily[index].value;
    count += 1;
  }

  return count ? sum / count : null;
}

function rolling(series, size) {
  return series.slice(size - 1).map((point, index) => ({
    date: point.date,
    value: series.slice(index, index + size).reduce((sum, item) => sum + item.value, 0) / size
  }));
}

// The most recent earlier reading at or below today's, i.e. the last time the
// reserve was this low. Readings in the current decline don't count.
function lowestSince(series) {
  const latest = series.at(-1);
  let index = series.length - 2;

  while (index >= 0 && series[index].value > latest.value) index -= 1;
  return index >= 0 ? series[index] : null;
}

// Weekly outflow in the fastest four weeks of the current year, and in the
// last four weeks, in thousand barrels a week.
function paces(spr) {
  const drops = spr.slice(1).map((point, index) => ({ date: point.date, drop: spr[index].value - point.value }));
  const average = (list) => list.reduce((sum, item) => sum + item.drop, 0) / list.length;
  const year = spr.at(-1).date.slice(0, 4);
  let fastest = { pace: 0, from: null, to: null };

  for (let index = 4; index <= drops.length; index += 1) {
    const window = drops.slice(index - 4, index);
    const pace = average(window);
    if (window[0].date >= `${year}-01-01` && pace > fastest.pace) fastest = { pace, from: window[0].date, to: window[3].date };
  }

  return { fastest, recent: Math.max(average(drops.slice(-4)), 0), lastWeek: drops.at(-1) };
}

// ---------------------------------------------------------------------------
// Page scaffolding

function section(id, title, lede) {
  const container = el("section", "sec wrap");
  container.id = id;
  const grid = el("div", "sec-grid");
  const main = el("div", "sec-main");
  const aside = el("aside", "side");
  const heading = el("h2", null, title);
  heading.id = `${id}-title`;
  container.setAttribute("aria-labelledby", heading.id);
  main.append(heading);

  if (lede) main.append(typeof lede === "string" ? el("p", "sec-lede", lede) : lede);

  grid.append(main, aside);
  container.append(grid);
  document.getElementById("sections").append(container);
  return { main, aside };
}

function note(title, ...content) {
  const block = el("div", "note");
  block.append(el("h4", null, title), ...content.filter(Boolean));
  return block;
}

function sourceList(...sources) {
  const list = el("ul", "src-list");

  for (const source of sources.flat().filter(Boolean)) {
    const item = el("li");
    item.append(link(source.label, source.url));
    list.append(item);
  }

  return list;
}

function stats(items) {
  const list = el("dl", "stats");

  for (const item of items.filter(Boolean)) {
    const block = el("div", "stat");
    block.append(el("dt", null, item.value), el("dd", null, item.label));
    list.append(block);
  }

  return list;
}

function sentence(...parts) {
  const paragraph = el("p");
  paragraph.append(...parts.filter((part) => part != null && part !== ""));
  return paragraph;
}

function parseUsDate(value) {
  const [month, day, year] = String(value ?? "").split("/").map(Number);
  return year ? new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) : null;
}

// ---------------------------------------------------------------------------
// Hero

function renderHero(data) {
  const { spr, index } = data;
  const latest = spr.at(-1);
  const since = lowestSince(spr);
  const out = data.before2026.value - latest.value;
  const left = RELEASE_2026.ordered - out;
  const status = index.status?.spr ?? {};
  const published = parseUsDate(status.releaseDate);
  const next = parseUsDate(status.nextRelease);

  document.getElementById("headline").textContent =
    since && parseDate(latest.date) - parseDate(since.date) > 365 * DAY
      ? `America's emergency oil reserve is at its lowest since ${monthYear(since.date)}.`
      : `America's emergency oil reserve holds ${words(latest.value)} barrels.`;

  const lede = document.getElementById("lede");
  const strong = el(
    "strong",
    null,
    `The Strategic Petroleum Reserve holds ${words(latest.value)} barrels of crude, ${words(latest.value - FLOOR.value)} ${
      latest.value >= FLOOR.value ? "above" : "below"
    } the legal floor for limited drawdowns.`
  );
  lede.replaceChildren(
    strong,
    ` ${words(out)} barrels have left since March, when the White House ordered ${words(RELEASE_2026.ordered)} released after Iran cut off oil exports through the Strait of Hormuz.`,
    left > 1000
      ? ` When the order is done, about ${words(RELEASE_2026.endsNear)} barrels will be left, under the floor.`
      : ""
  );

  renderLatest(data, out);

  document.getElementById("stamp").textContent = [
    `EIA data for the week ending ${formatDate(latest.date)}${published ? `, published ${formatDate(published)}` : ""}.`,
    next ? `Next update ${new Date(parseDate(next)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" })}.` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const days = latest.value / data.useNow;
  const change = ((latest.value - data.before2026.value) / data.before2026.value) * 100;
  document.getElementById("hero-stats").replaceChildren(
    stats([
      { value: `${days.toFixed(1)} days`, label: "of U.S. oil use, if it were the only supply" },
      { value: `${millions(Math.abs(latest.value - FLOOR.value))} million`, label: `barrels ${latest.value >= FLOOR.value ? "above" : "below"} the legal floor` },
      { value: `${Math.round((latest.value / CAPACITY.value) * 100)}%`, label: `of the ${words(CAPACITY.value)} barrels it can hold` },
      { value: `${change < 0 ? MINUS : "+"}${Math.abs(change).toFixed(0)}%`, label: `since ${formatDate(data.before2026.date)}, before the 2026 release` }
    ])
  );

  const chart = lineChart({
    cadence: "Weekly",
    label: `Line chart of oil in the Strategic Petroleum Reserve, weekly since ${formatMonth(spr[0].date)}. Latest: ${words(latest.value)} barrels.`,
    panels: [
      {
        series: spr,
        height: 280,
        unit: UNIT,
        zero: true,
        refs: [{ value: FLOOR.value, label: `${millions(FLOOR.value)}M: the floor for limited drawdowns`, align: "middle" }],
        notes: [
          { date: data.peak.date, label: `Peak: ${millions(data.peak.value)}M barrels, ${formatMonth(data.peak.date)}`, short: `Peak, ${data.peak.date.slice(0, 4)}` },
          { date: "2022-06-03", label: "2022: 180M barrels sold", place: "below" },
          { date: "2026-06-05", label: `2026: ${Math.round(out / 1000)}M barrels out so far`, place: "below", dy: 72 }
        ]
      }
    ]
  });
  const caption = el("figcaption", "chart-caption");
  caption.append(
    el("span", null, `Barrels in the reserve, weekly since ${formatMonth(spr[0].date)}.`),
    el("span", null, matchMedia("(hover: none)").matches ? "Drag across the chart for values" : "Hover or use arrow keys for values")
  );
  chart.append(caption);
  document.getElementById("hero-chart").replaceChildren(chart);
}

// The newest development, shown for 45 days: a dateline, one line of news,
// and where the 172-million-barrel order stands.
function renderLatest(data, out) {
  const offer = RELEASE_2026.lastOffer;
  const box = document.getElementById("latest");

  if (!offer || parseDate(new Date().toISOString().slice(0, 10)) - parseDate(offer.date) > 45 * DAY) {
    box.remove();
    return;
  }

  const left = Math.max(RELEASE_2026.ordered - out, 0);
  const kicker = el("p", "latest-kicker");
  kicker.append(el("span", "latest-dot"), `Latest \u00b7 ${formatDate(offer.date)}`);

  const bar = el("div", "order-bar");
  const done = el("span", "seg seg-done");
  done.style.flexGrow = String(out);
  const offered = el("span", "seg seg-open");
  offered.style.flexGrow = String(left);
  bar.append(done, offered);
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", `${millions(out)} million of the ${millions(RELEASE_2026.ordered)} million barrels ordered have gone out; ${millions(left)} million remain.`);

  const legend = el("div", "order-legend");
  const item = (className, value, label) => {
    const entry = el("span", "order-item");
    entry.append(el("span", `order-swatch ${className}`), el("b", null, `${millions(value)}M`), ` ${label}`);
    return entry;
  };
  legend.append(item("seg-done", out, "barrels out so far"), item("seg-open", left, `left of the ${millions(RELEASE_2026.ordered)}M ordered`));

  const sources = el("p", "latest-src");
  sources.append(link("DOE", SOURCES.doeSep29.url), " \u00b7 ", link("Reuters", SOURCES.reutersSep29.url));

  box.replaceChildren(
    kicker,
    el("p", "latest-title", `DOE is offering the last ${words(offer.value)} barrels of the ${millions(RELEASE_2026.ordered)}-million-barrel order as loans.`),
    el(
      "p",
      "latest-body",
      `In June the same barrels drew takers for only about ${Math.round(offer.juneTaken * 1000).toLocaleString("en-US")}. Bids are due ${formatDate(offer.bidsDue)}, with deliveries scheduled for November and December.`
    ),
    bar,
    legend,
    sources
  );
}

// ---------------------------------------------------------------------------
// The 2026 release, week by week

// Pumping rates on tracks as long as the rate the reserve was built for, so
// the empty part of each track is capacity that wasn't used.
function designFigure(data) {
  const latest = data.spr.at(-1);
  const { fastest, recent } = data.paces;
  const design = DESIGN_RATE.perDay;
  const offer = RELEASE_2026.lastOffer;
  const windowDays = (parseDate(offer.deliveries.to) - parseDate(offer.deliveries.from)) / DAY + 1;
  const rows = [
    { label: "2026 at its fastest", detail: `four weeks to ${formatDate(fastest.to)}`, value: fastest.pace / 7 },
    { label: "2022 at its fastest", detail: "the previous record release", value: DESIGN_RATE.rate2022, tone: "neutral", approx: true },
    { label: "The last four weeks", detail: `to ${formatDate(latest.date)}`, value: recent / 7 },
    latest.date < offer.deliveries.from
      ? {
          label: "November and December",
          detail: `if the last ${words(offer.value)} barrels go out as scheduled`,
          value: (latest.value - RELEASE_2026.endsNear) / windowDays,
          tone: "projected"
        }
      : null
  ].filter(Boolean);
  const perDay = (thousand) => `${trimZero((thousand / 1000).toFixed(thousand < 1000 ? 2 : 1))}M a day`;

  const figure = el("figure", "rate");
  const scale = el("div", "rate-scale");
  scale.append(el("span", null, "0"), el("span", null, `${millions(design)}M barrels a day: what it was built for`));
  const list = el("ul", "rate-rows");

  for (const row of rows) {
    const item = el("li", `rate-row${row.tone ? ` is-${row.tone}` : ""}`);
    const label = el("span", "rate-label", row.label);
    label.append(el("small", null, row.detail));
    const track = el("span", "rate-track");
    const fill = el("span", "rate-fill");
    fill.style.width = `${Math.max((row.value / design) * 100, 0.6)}%`;
    track.append(fill);
    track.setAttribute("aria-hidden", "true");
    item.append(label, el("span", "rate-value", `${row.approx ? "~" : ""}${perDay(row.value)}`), track);
    list.append(item);
  }

  const caption = el(
    "figcaption",
    null,
    `The reserve is required to deliver ${millions(design)} million barrels a day for up to ${DESIGN_RATE.days} days, starting within ${DESIGN_RATE.startDays} days of an order; the rate was set in 1996. Rates here are EIA's weekly declines divided by seven. `
  );
  caption.append(link("GAO-26-106918", DESIGN_RATE.source.url), ".");
  figure.append(scale, list, caption);
  return figure;
}

function renderRelease(data) {
  const { spr } = data;
  const latest = spr.at(-1);
  const { fastest, recent, lastWeek } = data.paces;
  const out = data.before2026.value - latest.value;
  const left = RELEASE_2026.ordered - out;
  const weeks = spr
    .map((point, index) => (index && point.date > RELEASE_2026.startedAfter ? { date: point.date, value: Math.max(spr[index - 1].value - point.value, 0) * 1000 } : null))
    .filter(Boolean);
  const perDay = (weekly) => weekly / 7;

  const { main, aside } = section(
    "release",
    "The 2026 release, week by week",
    sentence(
      `At its fastest, in the four weeks to ${formatDate(fastest.to)}, oil left at about ${millions(perDay(fastest.pace))} million barrels a day. `,
      `It has slowed to ${millions(Math.max(lastWeek.drop, 0))} million barrels in the latest week, because the earlier loans have nearly all gone out and, when DOE offered the last ${words(RELEASE_2026.lastOffer.value)} barrels in June, companies took almost none.`
    )
  );

  const timeline = el("ol", "timeline");

  for (const step of RELEASE_2026.timeline) {
    const item = el("li");
    const text = el("p", null, `${step.text} `);
    step.sources.forEach((source, index) => {
      if (index) text.append(", ");
      text.append(link(source.label, source.url));
    });
    text.append(".");
    item.append(el("span", "when", step.when), text);
    timeline.append(item);
  }

  main.append(
    columnChart({
      items: weeks,
      label: `Column chart of barrels leaving the reserve each week since March 2026. Largest week: ${formatCompact(Math.max(...weeks.map((week) => week.value)))} barrels.`,
      format: (value) => `${trimZero((value / 1e6).toFixed(1))}M bbl`,
      tipLabel: " left the reserve"
    }),
    stats([
      { value: `${words(out)}`, label: `barrels out since ${formatDate(data.before2026.date)}` },
      left > 1000 ? { value: `${words(left)}`, label: `barrels of the ${words(RELEASE_2026.ordered)} ordered still to go` } : null,
      { value: `${millions(perDay(recent))} million`, label: "barrels a day over the last four weeks" }
    ]),
    el(
      "p",
      "fine",
      `Weekly change in EIA's count of oil in the reserve. DOE has run the 2026 release as exchanges, loans that companies repay in oil with extra barrels; on earlier exchanges the premium was ${LOANS.premium}%, DOE says.`
    ),
    el("h3", "sub", `At its fastest, ${Math.round((fastest.pace / 7 / DESIGN_RATE.perDay) * 100)}% of what it was built for`),
    designFigure(data),
    el("h3", "sub", "How it has gone"),
    timeline
  );

  aside.append(
    note("Sources", sourceList(SOURCES.eia, SOURCES.doeSep29, SOURCES.reutersSep29, DESIGN_RATE.source, RELEASE_2026.source))
  );
}

// ---------------------------------------------------------------------------
// Flying blind

function renderFlyingBlind(data) {
  const { spr } = data;
  const since = lowestSince(spr);
  const { main, aside } = section(
    "blind",
    "Flying blind",
    "The reserve is being drawn down with no forecast for how long it will be needed, no agreed safe minimum, and no public count of how much can still be pumped since December 2025."
  );

  const pull = el("figure", "pull pull-lead");
  const caption = el("figcaption", null, `${UNKNOWNS.pull.who}. `);
  UNKNOWNS.pull.sources.forEach((source, index) => {
    if (index) caption.append(", ");
    caption.append(link(source.label, source.url));
  });
  pull.append(el("blockquote", null, UNKNOWNS.pull.quote), caption);

  const items = [
    UNKNOWNS.items[0],
    since
      ? {
          question: "What happens this low",
          text: `The reserve hasn't held this little oil since ${monthYear(since.date)}, when it was still being filled. It has never been drawn down this far before.`,
          sources: [SOURCES.eia]
        }
      : null,
    ...UNKNOWNS.items.slice(1)
  ].filter(Boolean);

  const list = el("ul", "unknowns");

  for (const item of items) {
    const row = el("li");
    const text = el("p", null, `${item.text} `);
    item.sources.forEach((source, index) => {
      if (index) text.append(", ");
      text.append(link(source.label, source.url));
    });
    text.append(".");
    row.append(el("h3", null, item.question), text);
    list.append(row);
  }

  main.append(pull, list);
  aside.append(note("Sources", sourceList(SOURCES.jpmCnbc, SOURCES.jpmQuartz, SOURCES.potter, SOURCES.gao, SOURCES.reutersSep29)));
}

// ---------------------------------------------------------------------------
// How low can it go?

function renderHowLow(data) {
  const { spr } = data;
  const latest = spr.at(-1);
  const { fastest, recent } = data.paces;
  const peakMonth = monthName(fastest.to);
  const year = Number(latest.date.slice(0, 4));

  const when = (target, pace) => {
    if (pace < 50) return null;
    const weeks = (latest.value - target) / pace;
    const date = new Date(parseDate(latest.date) + weeks * 7 * DAY).toISOString().slice(0, 10);
    return weeks > 520 ? `after ${year + 10}` : formatMonth(date);
  };
  // DOE's schedule for the last of the order: a straight line from today's
  // level to where the order ends, across the scheduled delivery window.
  const offer = RELEASE_2026.lastOffer;
  const scheduled = (target) => {
    if (target < RELEASE_2026.endsNear) return "Not reached";
    const from = parseDate(offer.deliveries.from);
    const to = parseDate(offer.deliveries.to);
    const share = (latest.value - target) / (latest.value - RELEASE_2026.endsNear);
    return formatMonth(new Date(from + Math.max(share, 0) * (to - from)).toISOString().slice(0, 10));
  };
  const showSchedule = latest.date < offer.deliveries.from;
  const reachGrid = (target, verb) => {
    const grid = el("dl", "reach");
    const cell = (label, value) => {
      const block = el("div");
      block.append(el("dt", null, label), el("dd", value === "Not reached" ? "muted" : null, value));
      grid.append(block);
    };
    cell(`${peakMonth}'s peak pace`, when(target, fastest.pace) ?? "Not falling");
    cell("Current pace", when(target, recent) ?? "Not falling");
    if (showSchedule) cell("On DOE's schedule", scheduled(target));
    const wrap = el("div", "reach-wrap");
    wrap.append(el("p", "reach-head", verb), grid);
    return wrap;
  };
  // When the reserve last crossed below a level on its way down.
  const crossed = (level) => {
    let index = spr.length - 1;
    while (index > 0 && spr[index - 1].value < level) index -= 1;
    return index > 0 && spr[index].value < level ? spr[index].date : null;
  };

  const claims = CLAIMS.map((claim) => ({ ...claim, top: claim.high ?? claim.value, bottom: claim.low ?? claim.value })).sort(
    (left, right) => right.top - left.top || right.bottom - left.bottom
  );
  const scale = Math.max(latest.value, ...claims.map((claim) => claim.top)) * 1.1;
  const pct = (value) => `${(value / scale) * 100}%`;

  const { main, aside } = section(
    "how-low",
    "How low can it go?",
    sentence(
      "Nobody agrees. Below are the published estimates of the lowest level the reserve can safely reach, and when it would get there three ways: ",
      `at ${peakMonth}'s peak pace (${millions(fastest.pace)} million barrels a week), at the current pace (${millions(recent)} million), `,
      showSchedule
        ? `or on DOE's schedule, if all of the last ${words(offer.value)} barrels go out in November and December. That's a big if: in June the same barrels drew takers for about ${Math.round(offer.juneTaken * 1000).toLocaleString("en-US")}.`
        : ""
    )
  );

  const key = el("p", "low-key");
  const today = el("span", "key-now");
  const ends = el("span", "key-end");
  key.append(today, `Today, ${millions(latest.value)}M`, ends, `Where the 2026 order ends, about ${millions(RELEASE_2026.endsNear)}M`);
  main.append(key);

  const list = el("ul", "lows");

  for (const claim of claims) {
    const row = el("li");
    const amount = claim.low != null ? `${millions(claim.low)} to ${millions(claim.high)} million` : `${millions(claim.value)} million`;
    const head = el("div", "low-head");
    const title = el("span", "low-amount", `${amount} barrels`);
    let status;

    if (latest.value < claim.bottom) status = "Already below";
    else if (latest.value <= claim.top) status = "Inside this range now";
    else status = `${millions(latest.value - claim.top)}M above`;

    head.append(title, el("span", latest.value < claim.bottom ? "low-status below" : "low-status", status));

    const track = el("span", "low-track");
    const band = el("span", "low-band");
    band.style.left = pct(claim.bottom);
    band.style.width = `${Math.max(((claim.top - claim.bottom) / scale) * 100, 0.6)}%`;
    const now = el("span", "now-line");
    now.style.left = pct(latest.value);
    const end = el("span", "end-line");
    end.style.left = pct(RELEASE_2026.endsNear);
    track.append(band, end, now);
    track.setAttribute("aria-hidden", "true");

    const who = el("p", "low-who", claim.who);
    const quote = el("blockquote", "low-quote", claim.quote);
    const target = latest.value <= claim.top ? claim.bottom : claim.top;
    const crossDate = latest.value < claim.bottom ? crossed(claim.bottom) : null;
    const crossedNote = latest.value < claim.bottom && crossDate ? ` It went below this in the week ending ${formatDate(crossDate)}.` : "";
    const why = el("p", "low-note", `${claim.why}${crossedNote}`);
    const reach = latest.value < claim.bottom ? null : reachGrid(target, latest.value <= claim.top ? "When it would reach the bottom" : "When it would get there");
    const where = el("p", "low-src", "Source: ");
    claim.sources.forEach((source, index) => {
      if (index) where.append(", ");
      where.append(link(source.label, source.url));
    });

    row.append(...[head, track, who, quote, why, reach, where].filter(Boolean));
    list.append(row);
  }

  const rebuttal = el("figure", "pull");
  const pullSource = el("figcaption");
  pullSource.append(`${DOE_REBUTTAL.who}, to `, link(DOE_REBUTTAL.source.label, DOE_REBUTTAL.source.url));
  rebuttal.append(el("blockquote", null, DOE_REBUTTAL.quote), pullSource);

  main.append(
    list,
    rebuttal,
    el(
      "p",
      "fine",
      "No government report names a level below which the caverns are damaged, other than about 12 million barrels of roof oil. The dates are this page's arithmetic on EIA's weekly data, not a forecast: releases start and stop by decision, and pumping slows as the caverns empty."
    )
  );

  aside.append(
    note(
      "Why the caverns wear out",
      ...WEAR.map((item) => {
        const paragraph = el("p", null, `${item.text} `);
        paragraph.append(link("Source", item.source.url), ".");
        return paragraph;
      })
    ),
    note("Where the estimates were gathered", sourceList(SOURCES.potter))
  );
}

// ---------------------------------------------------------------------------
// Every big release, to scale

function renderReleases(data) {
  const out = data.before2026.value - data.spr.at(-1).value;
  const items = RELEASES.map((release) => ({
    label: `${release.year}: ${release.what}`,
    detail: release.live2026 ? `${release.kind}; out so far` : release.kind,
    value: release.live2026 ? out : release.value
  })).sort((left, right) => right.value - left.value);
  const biggest = items[0];

  const { main, aside } = section(
    "releases",
    "Every big release, to scale",
    `Presidents ordered four emergency sales before 2026, and lent oil out many more times. ${
      biggest.label.startsWith("2026")
        ? "The 2026 release is now the largest."
        : `The 2022 sale is still the largest; the 2026 release passes it if all ${words(RELEASE_2026.ordered)} ordered barrels go out.`
    }`
  );

  main.append(
    barList(items, (value) => `${millions(value)}M bbl`),
    el(
      "p",
      "fine",
      "Barrels delivered, from DOE's history of releases, which runs to September 2025; the 2026 row is EIA's weekly count so far. Exchanges are loans repaid in oil. Smaller exchanges and the test and deficit sales of the 1980s and 1990s are left out."
    )
  );

  aside.append(note("Sources", sourceList(SOURCES.doeHistory, RELEASE_2026.source, SOURCES.eia)));
}

// ---------------------------------------------------------------------------
// Which president sold oil at the best price?

const PRESIDENTS = [
  { name: "Reagan", party: "R", start: "1981-01-20" },
  { name: "G.H.W. Bush", short: "Bush", party: "R", start: "1989-01-20" },
  { name: "Clinton", party: "D", start: "1993-01-20" },
  { name: "G.W. Bush", short: "Bush", party: "R", start: "2001-01-20" },
  { name: "Obama", party: "D", start: "2009-01-20" },
  { name: "Trump", party: "R", start: "2017-01-20" },
  { name: "Biden", party: "D", start: "2021-01-20" },
  { name: "Trump (2nd term)", short: "Trump", party: "R", start: "2025-01-20" }
].map((president, index, list) => ({ ...president, end: list[index + 1]?.start ?? "2029-01-20" }));

function presidentAt(date) {
  return PRESIDENTS.find((president) => date >= president.start && date < president.end) ?? null;
}

function formatMoney(dollars) {
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? MINUS : "+";

  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

function formatBarrels(thousandBarrels) {
  const barrels = thousandBarrels * 1000;
  return barrels >= 1e6 ? `${(barrels / 1e6).toFixed(1)}M` : Math.round(barrels).toLocaleString("en-US");
}

// Attribute every weekly change to the sitting president, valued at the
// average daily WTI price over the days that week covers.
function computeTraderStats(spr, wti) {
  const byPresident = new Map();
  const total = { outKb: 0, outValueK: 0, inKb: 0, inValueK: 0 };
  let excludedKb = 0;

  for (let index = 1; index < spr.length; index += 1) {
    const point = spr[index];
    const delta = point.value - spr[index - 1].value;

    if (!delta) continue;

    const price = averagePrice(wti, spr[index - 1].date, point.date);
    const president = presidentAt(point.date);

    if (price == null || !president) {
      excludedKb += Math.abs(delta);
      continue;
    }

    const stats = byPresident.get(president.name) ?? { name: president.name, party: president.party, outKb: 0, outValueK: 0, inKb: 0, inValueK: 0 };

    for (const bucket of [stats, total]) {
      if (delta < 0) {
        bucket.outKb += -delta;
        bucket.outValueK += -delta * price;
      } else {
        bucket.inKb += delta;
        bucket.inValueK += delta * price;
      }
    }

    byPresident.set(president.name, stats);
  }

  // Oil prices rise and fall by era, so each sale price is also compared with
  // the average daily price over the president's own term (from 1986, where
  // the price series starts, to today for a sitting president).
  const termAverage = (name) => {
    const president = PRESIDENTS.find((entry) => entry.name === name);
    const days = wti.filter((point) => point.date >= president.start && point.date < president.end);
    return days.length ? days.reduce((sum, point) => sum + point.value, 0) / days.length : null;
  };
  const finish = (stats) => {
    const avgOut = stats.outKb ? stats.outValueK / stats.outKb : null;
    const term = stats.name ? termAverage(stats.name) : null;
    return {
      ...stats,
      avgOut,
      avgIn: stats.inKb ? stats.inValueK / stats.inKb : null,
      termAvg: term,
      vsTerm: avgOut != null && term ? avgOut / term - 1 : null,
      netDollars: (stats.outValueK - stats.inValueK) * 1000
    };
  };
  const rows = [...byPresident.values()].map(finish).sort((left, right) => (right.avgOut ?? -1) - (left.avgOut ?? -1));
  return { rows, total: finish(total), excludedKb };
}

function renderTrade(data) {
  const { spr, wti } = data;
  const { rows, total, excludedKb } = computeTraderStats(spr, wti);
  // Rankings only count presidents who let out at least 10 million barrels.
  const qualified = rows.filter((row) => row.outKb >= 10_000);
  const bestSeller = qualified[0];
  const runnerUp = qualified[1];
  const bestTimed = [...qualified].sort((left, right) => right.vsTerm - left.vsTerm)[0];
  const sprFrom = spr.filter((point) => point.date >= wti[0].date);
  const gap = bestSeller.avgOut - runnerUp.avgOut;
  const gapText = gap < 1 ? `${Math.round(gap * 100)} cents` : `$${gap.toFixed(2)}`;
  const pct = (value) => `${value < 0 ? MINUS : "+"}${Math.abs(Math.round(value * 100))}%`;
  const prose = (name) => (name === "Trump (2nd term)" ? "Trump's second term" : name);

  const { main, aside } = section(
    "presidents",
    "Which president sold oil at the best price?",
    sentence(
      "Every week the reserve's level moved, the change is valued at that week's average oil price and credited to whoever was in office. ",
      `By that measure ${prose(bestSeller.name)} has let out oil at the highest average price, $${bestSeller.avgOut.toFixed(2)} a barrel, ${gapText} ahead of ${prose(runnerUp.name)}. `,
      bestTimed === bestSeller
        ? `Timed against the market of the day, ${prose(bestTimed.name)} also sold highest: ${Math.round(bestTimed.vsTerm * 100)}% above the average price of that term.`
        : `But oil prices rise and fall by era. Timed against the market of the day, ${prose(bestTimed.name)} sold best: ${Math.round(bestTimed.vsTerm * 100)}% above the average price of that term.`
    )
  );

  const legend = el("div", "legend");
  const swatch = (party, text) => {
    const item = el("span");
    const box = el("span", `swatch swatch-${party}`);
    item.append(box, text);
    return item;
  };
  legend.append(el("span", null, "Shading shows the party in the White House:"), swatch("R", "Republican"), swatch("D", "Democratic"));

  const chart = lineChart({
    label: `Two stacked line charts from ${formatMonth(sprFrom[0].date)}: oil in the reserve and the WTI oil price, shaded by presidency.`,
    cadence: "Weekly",
    bands: PRESIDENTS.map((president) => ({
      start: president.start,
      end: president.end,
      label: president.name,
      short: president.short ?? president.name,
      className: president.party === "R" ? "band-r" : "band-d"
    })),
    panels: [
      { series: sprFrom, title: "Oil in the reserve, barrels", zero: true, fill: false, height: 190, unit: UNIT, tipLabel: " in reserve" },
      {
        series: wti,
        title: "Price of oil (WTI), dollars a barrel, daily",
        zero: true,
        neutral: true,
        height: 130,
        unit: { multiplier: 1, short: "" },
        endLabel: `$${Math.round(wti.at(-1).value)}`,
        format: (value) => `$${value.toFixed(2)}`,
        tipLabel: " a barrel"
      }
    ],
    readout: (point) => presidentAt(point.date)?.name ?? null
  });

  const table = el("table", "trader");
  const head = el("tr");

  for (const column of ["President", "Let out", "Average price", "vs. term average", "Took in", "Average price", "Net cash"]) {
    head.append(el("th", null, column));
  }

  const thead = el("thead");
  thead.append(head);
  const tbody = el("tbody");

  for (const row of rows) {
    const tr = el("tr");
    const name = el("td");
    const mark = el("span", `party party-${row.party}`);
    mark.setAttribute("aria-hidden", "true");
    name.append(mark, row.name);
    if (row === bestSeller) name.append(el("span", "tag", "Top price"));
    if (row === bestTimed) name.append(el("span", "tag tag-alt", "Best timed"));
    tr.append(
      name,
      el("td", null, row.outKb ? `${formatBarrels(row.outKb)} bbl` : "—"),
      el("td", null, row.avgOut ? `$${row.avgOut.toFixed(2)}` : "—"),
      el("td", null, row.vsTerm != null && row.outKb >= 10_000 ? pct(row.vsTerm) : "—"),
      el("td", null, row.inKb ? `${formatBarrels(row.inKb)} bbl` : "—"),
      el("td", null, row.avgIn ? `$${row.avgIn.toFixed(2)}` : "—"),
      el("td", null, formatMoney(row.netDollars))
    );
    tbody.append(tr);
  }

  table.append(thead, tbody);
  const scroll = el("div", "table-scroll");
  scroll.append(table);

  main.append(
    chart,
    legend,
    scroll,
    el(
      "p",
      "fine",
      `EIA reports the level once a week, so each week's change is priced at the average of that week's daily spot prices. These are implied trades: real sales, loans and exchanges are priced differently, loans come back as oil, and a release is not profit. ${
        excludedKb ? `The ${formatBarrels(excludedKb)} barrels that moved before 1986 are left out, because the price series starts that year. ` : ""
      }\u201cvs. term average\u201d compares each average price with the average daily oil price over that president's term, so a president who sold when oil was cheap for everyone isn't penalized. Rankings count only presidents who let out at least 10 million barrels.`
    )
  );

  aside.append(note("Sources", sourceList(SOURCES.eia, { label: "EIA daily WTI spot price", url: "https://www.eia.gov/dnav/pet/hist/RWTCD.htm" })));
}

// ---------------------------------------------------------------------------
// What would it cost to refill?

function renderRefill(data) {
  const { spr, wti } = data;
  const latest = spr.at(-1);
  const price = wti.at(-1);
  const need = CAPACITY.value - latest.value;
  const cost = need * 1000 * price.value;

  // The last refill: from the post-2022 low to the level before the 2026 release.
  const low = spr.filter((point) => point.date >= "2023-01-01" && point.date <= "2024-12-31").reduce((best, point) => (point.value < best.value ? point : best));
  const years = (parseDate(data.before2026.date) - parseDate(low.date)) / (365.25 * DAY);
  const lastPace = (data.before2026.value - low.value) / years;

  const { main, aside } = section(
    "refill",
    "What would it cost to refill?",
    `Filling the reserve back to the ${words(CAPACITY.value)} barrels it can hold would take ${words(need)} barrels. Some of that is already owed: most of the 2026 oil was lent, not sold. But the last refill went slowly, and Congress has ordered more sales.`
  );
  const afterLoans = RELEASE_2026.endsNear + LOANS.returning;

  main.append(
    stats([
      { value: `$${trimZero((cost / 1e9).toFixed(1))} billion`, label: `at the latest oil price, $${price.value.toFixed(2)} a barrel on ${formatDate(price.date)}` },
      { value: `~${Math.round(afterLoans / 1000)} million`, label: `barrels if the release ends near ${millions(RELEASE_2026.endsNear)} million and the loans come back as DOE expects` },
      { value: `${Math.round(need / lastPace)} years`, label: `to fill it at the last refill's pace, ${millions(lastPace)} million barrels a year (${low.date.slice(0, 4)}–26)` },
      { value: `${millions(MANDATED_SALES.value)} million`, label: `more barrels Congress has ordered sold in ${MANDATED_SALES.years}` }
    ]),
    (() => {
      const paragraph = el("p", null, `${LOANS.returningNote} `);
      paragraph.append(link(LOANS.returningSource.outlet, LOANS.returningSource.url), ". ", link(LOANS.lateSource.outlet, LOANS.lateSource.url), ` ${LOANS.lateNote}`);
      return paragraph;
    })(),
    el("p", "fine", "Straight arithmetic: buying that much oil would itself push prices up, and DOE's ability to take oil in is also limited by the repairs GAO describes.")
  );

  aside.append(note("Sources", sourceList(SOURCES.doeFacts, SOURCES.doeSep29, LOANS.returningSource, LOANS.lateSource, MANDATED_SALES.source, SOURCES.gao, SOURCES.eia)));
}

// ---------------------------------------------------------------------------
// How many days of oil it covers

function renderCover(data) {
  const { spr, use, net } = data;
  const sprByDate = new Map(spr.map((point) => [point.date, point.value]));
  const cover = rolling(use, 4)
    .map((point) => (sprByDate.has(point.date) ? { date: point.date, value: sprByDate.get(point.date) / point.value } : null))
    .filter(Boolean);
  const netAvg = rolling(net, 4);
  const yearly = rolling(net, 52);
  let exporterSince = null;

  for (let index = yearly.length - 1; index >= 0 && yearly[index].value < 0; index -= 1) exporterSince = yearly[index].date;

  const peak = cover.reduce((best, point) => (point.value > best.value ? point : best));
  const now = cover.at(-1);

  const { main, aside } = section(
    "cover",
    "How many days of oil does it cover?",
    sentence(
      `Measured against what the country burns, the reserve covers ${now.value.toFixed(1)} days, down from ${peak.value.toFixed(1)} in ${formatMonth(peak.date)}, when the pandemic cut demand. `,
      exporterSince
        ? `The treaty standard is 90 days of net imports, but over the past year the U.S. has exported more oil than it imported, as it has since ${monthYear(exporterSince)}, so that yardstick no longer applies.`
        : ""
    )
  );

  const chart = lineChart({
    cadence: "Weekly",
    label: `Two stacked line charts: days of U.S. oil use the reserve covers, and U.S. net oil imports, since ${formatMonth(cover[0].date)}.`,
    panels: [
      {
        series: cover,
        title: "Days of U.S. oil use the reserve covers",
        zero: true,
        height: 190,
        unit: { multiplier: 1, short: "days" },
        endLabel: `${now.value.toFixed(1)} days`,
        format: (value) => `${value.toFixed(1)} days`,
        tipLabel: " of use"
      },
      {
        series: netAvg,
        title: "U.S. net imports of oil and fuels, barrels a day (below zero: net exporter)",
        zero: true,
        neutral: true,
        height: 130,
        unit: { multiplier: 1000, short: "" },
        endLabel: `${netAvg.at(-1).value < 0 ? MINUS : ""}${trimZero((Math.abs(netAvg.at(-1).value) / 1000).toFixed(1))}M`,
        format: (value) => `${value < 0 ? MINUS : ""}${trimZero((Math.abs(value) / 1000).toFixed(2))}M bbl/day`,
        tipLabel: " net imports"
      }
    ]
  });
  const caption = el("figcaption", "chart-caption", "Oil use is EIA's four-week average of products supplied; net imports are four-week averages.");
  chart.append(caption);
  main.append(chart);

  aside.append(
    note("The import rule", el("p", null, "International Energy Agency members must hold oil equal to 90 days of the previous year's net imports. A net exporter has no obligation.")),
    note(
      "Sources",
      sourceList(
        { label: "EIA weekly products supplied (WRPUPUS2)", url: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WRPUPUS2&f=W" },
        { label: "EIA weekly net imports (WTTNTUS2)", url: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WTTNTUS2&f=W" },
        { label: "IEA International Energy Program treaty", url: "https://iea.blob.core.windows.net/assets/c6be6d60-1ca8-4b99-b8c7-7ac508ec157c/IEP.pdf" }
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Government oil against company oil

function renderShare(data) {
  const { spr, commercial } = data;
  const byDate = new Map(commercial.map((point) => [point.date, point.value]));
  const share = spr
    .filter((point) => byDate.has(point.date))
    .map((point) => ({ date: point.date, value: (point.value / (point.value + byDate.get(point.date))) * 100 }));
  const now = share.at(-1);
  const peak = share.reduce((best, point) => (point.value > best.value ? point : best));
  const since = lowestSince(share);
  const companies = byDate.get(now.date);

  const { main, aside } = section(
    "share",
    "Government oil against company oil",
    `The reserve holds ${Math.round(now.value)}% of the crude stored in the United States. Refiners, traders and pipelines hold the other ${words(companies)} barrels. The government's share peaked at ${Math.round(peak.value)}% in ${formatMonth(peak.date)}${
      since ? ` and is now the lowest since ${monthYear(since.date)}` : " and is now the lowest on record, back to 1982"
    }.`
  );

  const chart = lineChart({
    cadence: "Weekly",
    label: `Line chart of the reserve's share of U.S. crude stocks since ${formatMonth(share[0].date)}. Latest ${Math.round(now.value)}%.`,
    panels: [
      {
        series: share,
        title: "Share of U.S. crude stocks held in the reserve",
        zero: true,
        height: 200,
        unit: { multiplier: 1, short: "%" },
        endLabel: `${Math.round(now.value)}%`,
        format: (value) => `${value.toFixed(1)}%`,
        tipLabel: " in the reserve"
      }
    ]
  });
  main.append(chart);

  aside.append(
    note(
      "Sources",
      sourceList(SOURCES.eia, { label: "EIA weekly commercial crude stocks (WCESTUS1)", url: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCESTUS1&f=W" })
    )
  );
}

// ---------------------------------------------------------------------------
// What it's worth

function renderValue(data) {
  const { spr, wti } = data;
  const value = spr
    .slice(1)
    .map((point, index) => {
      const price = averagePrice(wti, spr[index].date, point.date);
      return price == null ? null : { date: point.date, value: point.value * 1000 * price, price };
    })
    .filter(Boolean);
  const now = value.at(-1);
  const peak = value.reduce((best, point) => (point.value > best.value ? point : best));
  const billions = (dollars) => `$${trimZero((dollars / 1e9).toFixed(1))}B`;
  const inWords = (dollars) => `$${trimZero((dollars / 1e9).toFixed(1))} billion`;

  const { main, aside } = section(
    "value",
    "What is it worth?",
    `In the week ending ${formatDate(now.date)}, when oil averaged $${now.price.toFixed(2)} a barrel, the reserve's oil was worth about ${inWords(now.value)}. It was worth the most in ${monthYear(
      peak.date
    )}, ${inWords(peak.value)}, when oil averaged $${peak.price.toFixed(0)}.`
  );

  main.append(
    lineChart({
      cadence: "Weekly",
      label: `Line chart of the reserve's value at each week's oil price since ${formatMonth(value[0].date)}. Latest ${billions(now.value)}.`,
      panels: [
        {
          series: value,
          title: "Value at that week's oil price, dollars",
          zero: true,
          height: 200,
          unit: { multiplier: 1, short: "" },
          endLabel: billions(now.value),
          format: billions,
          tipLabel: " worth of oil"
        }
      ]
    })
  );

  aside.append(note("Sources", sourceList(SOURCES.eia, { label: "EIA daily WTI spot price", url: "https://www.eia.gov/dnav/pet/hist/RWTCD.htm" })));
}

// ---------------------------------------------------------------------------
// The rules, further reading, how this page works

function renderRules() {
  const { main, aside } = section("rules", "The rules");
  const item = (text, source) => {
    const entry = el("li", null, `${text} `);
    entry.append(link(source.label, source.url), ".");
    return entry;
  };
  const list = el("ul", "rules");
  list.append(
    item(
      `A president can order a “limited drawdown” of up to 30 million barrels without declaring a severe supply emergency, but not if it would take the reserve below ${millions(FLOOR.value)} million barrels. Full emergency drawdowns have no floor.`,
      FLOOR.source
    ),
    item(`Congress has ordered ${words(MANDATED_SALES.value)} more barrels sold in fiscal years ${MANDATED_SALES.years}, under the 2018 water infrastructure law and the 2021 infrastructure law.`, MANDATED_SALES.source),
    item(`DOE lists the reserve's authorized storage capacity as ${words(CAPACITY.value)} barrels, in 60 salt caverns at four sites in Texas and Louisiana.`, CAPACITY.source),
    item(`It is required to deliver ${millions(DESIGN_RATE.perDay)} million barrels a day for up to ${DESIGN_RATE.days} days. GAO found in 2026 that parts of the reserve couldn't reach their required rates because of vapor-pressure problems or low inventory.`, DESIGN_RATE.source)
  );
  main.append(list);
  aside.append(note("More", sourceList(SOURCES.doeFacts)));
}

function renderReading() {
  const { main } = section("reading", "Further reading");
  main.append(sourceList(FURTHER_READING));
}

function renderMethod(data) {
  const { main } = section(
    "method",
    "How this page works",
    "Twice a day a script reads the latest figures from the U.S. Energy Information Administration and commits them to a public Git repository, so every number here can be traced to the day it was read. EIA publishes the reserve's level once a week, on Wednesdays, for the week ending the Friday before."
  );
  const table = el("table", "sources-table");
  const head = el("tr");

  for (const column of ["Series", "Latest reading", "Status"]) head.append(el("th", null, column));

  const thead = el("thead");
  thead.append(head);
  const tbody = el("tbody");

  for (const [id, label] of [
    ["spr", "Oil in the reserve, weekly"],
    ["commercial", "Commercial crude stocks, weekly"],
    ["oil-use", "U.S. oil use (products supplied), weekly"],
    ["net-imports", "U.S. net imports, weekly"],
    ["wti", "WTI oil price, daily"]
  ]) {
    const status = data.index.status?.[id] ?? {};
    const row = el("tr");
    const name = el("td");
    name.append(link(label, data.files[id].sourceUrl));
    row.append(name, el("td", null, status.asOf ? formatDate(status.asOf) : "—"), el("td", status.state === "failed" ? "down" : null, status.state === "failed" ? "Source unreachable on last check" : "OK"));
    tbody.append(row);
  }

  table.append(thead, tbody);
  const scroll = el("div", "table-scroll");
  scroll.append(table);
  main.append(scroll);
}

// ---------------------------------------------------------------------------

async function init() {
  let index;
  let files;

  try {
    const ids = ["spr", "wti", "commercial", "oil-use", "net-imports"];
    const load = (id) => fetch(`data/${id}.json`).then((response) => response.json());
    [index, ...files] = await Promise.all([load("index"), ...ids.map(load)]);
    files = Object.fromEntries(ids.map((id, position) => [id, files[position]]));
  } catch {
    document.getElementById("headline").textContent = "Could not load the data.";
    return;
  }

  const spr = files.spr.series;
  const use = files["oil-use"].series;
  const before = spr.filter((point) => point.date <= RELEASE_2026.startedAfter).at(-1);
  const data = {
    index,
    files,
    spr,
    wti: files.wti.series,
    commercial: files.commercial.series,
    use,
    net: files["net-imports"].series,
    before2026: latestAtOrBefore(spr, before.date),
    peak: spr.reduce((best, point) => (point.value > best.value ? point : best)),
    useNow: use.slice(-4).reduce((sum, point) => sum + point.value, 0) / 4,
    paces: paces(spr)
  };

  renderHero(data);
  renderTrade(data);
  renderRelease(data);
  renderFlyingBlind(data);
  renderHowLow(data);
  renderReleases(data);
  renderRefill(data);
  renderCover(data);
  renderShare(data);
  renderValue(data);
  renderRules();
  renderReading();
  renderMethod(data);

  await restoreScroll();
}

// The page is drawn after its data loads, so the browser's own scroll
// restoration runs against a half-built page and lands near the top. Keep the
// position ourselves and put it back once the charts have been drawn.
const SCROLL_KEY = `scroll:${location.pathname}`;

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

addEventListener("pagehide", () => {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(Math.round(scrollY)));
  } catch {
    // storage unavailable (private mode); a reload starts at the top
  }
});

async function restoreScroll() {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  // Fonts change line heights, and charts draw a frame after they're laid
  // out, so wait until the page height holds for three frames (or a second).
  await document.fonts?.ready;
  let height = -1;
  let steady = 0;

  for (let waited = 0; steady < 3 && waited < 60; waited += 1) {
    await frame();
    const now = document.documentElement.scrollHeight;
    steady = now === height ? steady + 1 : 0;
    height = now;
  }

  let saved = null;

  try {
    saved = sessionStorage.getItem(SCROLL_KEY);
  } catch {
    saved = null;
  }

  const reload = performance.getEntriesByType?.("navigation")[0]?.type === "reload";

  if (reload && saved != null) {
    scrollTo({ top: Number(saved), behavior: "instant" });
  } else if (location.hash) {
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
  }
}

init();

