import assert from "node:assert/strict";
import { test } from "node:test";

import { formatData, mergeResult } from "../scraper/store.js";

test("mergeResult appends new dates, replaces revised ones and keeps old ones", () => {
  const existing = {
    id: "spr",
    series: [
      { date: "2026-09-04", value: 285360 },
      { date: "2026-09-11", value: 284957 }
    ]
  };
  const merged = mergeResult(
    existing,
    {
      series: [
        { date: "2026-09-11", value: 284950 },
        { date: "2026-09-18", value: 284552 }
      ],
      asOf: "2026-09-18",
      sourceLabel: "test",
      meta: { nextRelease: "9/30/2026" }
    },
    "2026-09-24T00:00:00.000Z"
  );

  assert.deepEqual(merged.series.map((point) => point.value), [285360, 284950, 284552]);
  assert.equal(merged.asOf, "2026-09-18");
  assert.equal(merged.meta.nextRelease, "9/30/2026");
});

test("mergeResult keeps updatedAt when nothing changed", () => {
  const existing = {
    id: "spr",
    updatedAt: "2026-09-23T00:00:00.000Z",
    asOf: "2026-09-18",
    sourceLabel: "test",
    sourceUrl: "https://example.test",
    meta: { nextRelease: "9/30/2026" },
    series: [{ date: "2026-09-18", value: 284552 }]
  };
  const again = { series: [{ date: "2026-09-18", value: 284552 }], asOf: "2026-09-18", sourceLabel: "test", sourceUrl: "https://example.test", meta: { nextRelease: "9/30/2026" } };

  assert.equal(mergeResult(existing, again, "2026-09-24T00:00:00.000Z").updatedAt, "2026-09-23T00:00:00.000Z");
  assert.equal(
    mergeResult(existing, { ...again, series: [{ date: "2026-09-25", value: 283800 }], asOf: "2026-09-25" }, "2026-09-30T00:00:00.000Z").updatedAt,
    "2026-09-30T00:00:00.000Z"
  );
});

test("formatData puts one reading on each line", () => {
  const text = formatData({ id: "spr", series: [{ date: "2026-09-11", value: 284957 }, { date: "2026-09-18", value: -3.5 }] });

  assert.match(text, /\n    \{ "date": "2026-09-11", "value": 284957 \},\n    \{ "date": "2026-09-18", "value": -3.5 \}\n/);
  assert.deepEqual(JSON.parse(text).series[1], { date: "2026-09-18", value: -3.5 });
});
