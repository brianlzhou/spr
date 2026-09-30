import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { htmlToText, parseEiaDailyTable, parseEiaWeeklyTable } from "../scraper/parse.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name) => readFile(path.join(fixturesDir, name), "utf8");

test("parseEiaWeeklyTable reads the SPR weekly history", async () => {
  const parsed = parseEiaWeeklyTable(htmlToText(await fixture("spr.html")));

  assert.deepEqual(parsed.series[0], { date: "1982-08-20", value: 270455 });
  assert.ok(parsed.series.length > 20);
  const dates = parsed.series.map((point) => point.date);
  assert.deepEqual(dates, [...dates].sort(), "series should be date-sorted");
  assert.equal(new Set(dates).size, dates.length, "dates should be unique");
  assert.ok(parsed.releaseDate, "release date should parse");
});

test("parseEiaWeeklyTable keeps negative values", () => {
  const parsed = parseEiaWeeklyTable("2026-Sep 09/04 -3,759 09/11 -3,740 09/18 -3,803");

  assert.deepEqual(parsed.series.map((point) => point.value), [-3759, -3740, -3803]);
  assert.equal(parsed.series[0].date, "2026-09-04");
});

test("parseEiaDailyTable places each price on its weekday and skips holidays", async () => {
  const parsed = parseEiaDailyTable(await fixture("wti-daily.html"));

  // 1985 Dec-30 week: Mon–Wed empty (Jan 1 holiday), then Thu/Fri in the new year.
  assert.deepEqual(parsed.series.slice(0, 2), [
    { date: "1986-01-02", value: 25.56 },
    { date: "1986-01-03", value: 26 }
  ]);
  assert.deepEqual(parsed.series.find((point) => point.date === "2020-04-20"), { date: "2020-04-20", value: -36.98 });
  assert.equal(parsed.series.length, 2 + 5 + 5 + 5);
  assert.equal(parsed.releaseDate, "9/23/2026");
});
