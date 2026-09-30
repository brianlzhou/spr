#!/usr/bin/env node
// Scrape every series and merge it into public/data/<id>.json, then write
// public/data/index.json with each series' status. Run on a schedule
// (.github/workflows/update.yml) or by hand:
//
//   node scraper/run.js          # everything
//   node scraper/run.js spr wti  # some series
//
// A failed source keeps its previous data and is flagged in the index; the
// run only exits non-zero when every source fails.
import { SOURCES } from "./sources.js";
import { mergeResult, readDataFile, writeDataFile } from "./store.js";

const only = new Set(process.argv.slice(2));
const targets = SOURCES.filter((source) => only.size === 0 || only.has(source.id));

if (targets.length === 0) {
  console.error(`No matching series. Known: ${SOURCES.map((source) => source.id).join(", ")}`);
  process.exit(1);
}

const scrapedAt = new Date().toISOString();
const previous = await readDataFile("index");
const status = { ...(previous?.status ?? {}) };
let failures = 0;

await Promise.all(
  targets.map(async (source) => {
    try {
      const merged = mergeResult(await readDataFile(source.id), await source.scrape(), scrapedAt);
      await writeDataFile(source.id, merged);
      status[source.id] = { state: "ok", asOf: merged.asOf, checkedAt: scrapedAt, ...merged.meta };
      console.log(`ok      ${source.id.padEnd(12)} ${merged.series.length} points, latest ${merged.asOf}`);
    } catch (error) {
      failures += 1;
      status[source.id] = { ...(status[source.id] ?? {}), state: "failed", detail: error.message, checkedAt: scrapedAt };
      console.error(`failed  ${source.id.padEnd(12)} ${error.message}`);
    }
  })
);

// "Last checked" on the page moves only when every series was attempted.
const checkedAll = targets.length === SOURCES.length;
await writeDataFile("index", { generatedAt: checkedAll ? scrapedAt : previous?.generatedAt ?? scrapedAt, status });

console.log(`\n${targets.length - failures}/${targets.length} sources ok, index written`);

if (failures === targets.length) {
  process.exit(1);
}
