const ENTITY_MAP = {
  "&amp;": "&",
  "&apos;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&nbsp;": " ",
  "&quot;": "\""
};

function decodeHtmlEntities(value) {
  return value
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/g, (match) => ENTITY_MAP[match] ?? match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(article|div|h1|h2|h3|h4|h5|h6|li|p|section|table|tr|ul)>/gi, "\n")
      .replace(/<\/(td|th)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

export function toLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function parseNumber(value) {
  return Number(String(value).replace(/,/g, "").trim());
}

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

function toIsoDate(year, month, day) {
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function uniqueByDate(points) {
  const seen = new Map();

  for (const point of points) {
    seen.set(point.date, point);
  }

  return [...seen.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function releaseDates(text) {
  const flat = text.replace(/\s+/g, " ");

  return {
    releaseDate: flat.match(/Release Date:\s*([0-9/]+)/i)?.[1] ?? null,
    nextRelease: flat.match(/Next Release Date:\s*([0-9/]+)/i)?.[1] ?? null
  };
}

// EIA dnav weekly history tables (LeafHandler.ashx) render rows like
// "1982-Aug 08/20 270,455 08/27 272,603 ..." once tags are stripped.
export function parseEiaWeeklyTable(text) {
  const series = [];

  for (const line of toLines(text)) {
    const yearMatch = line.match(/^(\d{4})-([A-Za-z]{3})\b/);

    if (!yearMatch) {
      continue;
    }

    const year = Number(yearMatch[1]);
    const headerMonth = MONTHS[yearMatch[2]];

    // Values can be negative: net-import series go below zero once the U.S.
    // exports more than it imports.
    for (const match of line.matchAll(/(\d{2})\/(\d{2})\s+(-?[\d,]+(?:\.\d+)?)/g)) {
      const month = Number(match[1]) || headerMonth;
      const day = Number(match[2]);

      series.push({
        date: toIsoDate(year, month, day),
        value: parseNumber(match[3])
      });
    }
  }

  return { series: uniqueByDate(series), ...releaseDates(text) };
}

// EIA daily history pages (e.g. RWTCD.htm) lay out one row per week: a
// "1986 Jan- 6 to Jan-10" label cell, then Monday–Friday cells that are empty
// on holidays. Cell position is the only way to know the weekday, so this
// reads the raw HTML rather than flattened text. Prices can be negative
// (EIA's WTI spot was -$36.98 on 2020-04-20).
export function parseEiaDailyTable(html) {
  const series = [];
  const rowPattern = /<tr>\s*<td class=['"]B6['"]>([\s\S]*?)<\/td>([\s\S]*?)<\/tr>/g;

  for (const [, labelCell, rest] of html.matchAll(rowPattern)) {
    const label = decodeHtmlEntities(labelCell).replace(/\s+/g, " ").trim();
    const start = label.match(/^(\d{4}) ([A-Za-z]{3})-\s?(\d{1,2}) to/);

    if (!start) {
      continue;
    }

    const monday = Date.UTC(Number(start[1]), MONTHS[start[2]] - 1, Number(start[3]));
    const cells = [...rest.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1].replace(/&nbsp;/g, "").trim());

    cells.slice(0, 5).forEach((cell, weekday) => {
      if (!/^-?[\d,]+(\.\d+)?$/.test(cell)) {
        return;
      }

      series.push({
        date: new Date(monday + weekday * 86_400_000).toISOString().slice(0, 10),
        value: parseNumber(cell)
      });
    });
  }

  return { series: uniqueByDate(series), ...releaseDates(htmlToText(html)) };
}

// EIA's Weekly Petroleum Status Report table 4 (ir.eia.gov/wpsr/table4.csv),
// published at 10:30 a.m. Eastern on release day, often before the history
// pages update. Its first two value columns are this week and last week, in
// million barrels; returns them in thousand barrels to match the history
// series.
export function parseWpsrTable4(csv, stub) {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => [...line.matchAll(/"([^"]*)"/g)].map((match) => match[1]));
  const header = rows[0] ?? [];
  const row = rows.find((cells) => cells[0] === stub);

  if (!row) {
    return [];
  }

  return [1, 2]
    .map((column) => {
      const [month, day, year] = String(header[column] ?? "").split("/").map(Number);
      const value = parseNumber(row[column]);

      if (!year || !Number.isFinite(value)) {
        return null;
      }

      return { date: toIsoDate(2000 + year, month, day), value: Math.round(value * 1000) };
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}
