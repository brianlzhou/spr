import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.resolve(__dirname, "..", "public", "data");

export async function readDataFile(id) {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, `${id}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function mergeByDate(existing, incoming) {
  const byDate = new Map(existing.map((entry) => [entry.date, entry]));

  for (const entry of incoming) {
    byDate.set(entry.date, entry);
  }

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

// Merge a scrape into the stored file. Points are keyed by date: new dates
// append, same dates are replaced (EIA revises recent weeks), old dates are
// never lost, so the git history is a full record of every revision.
// `updatedAt` moves only when the readings or their metadata change, so a run
// that finds nothing new leaves the file untouched.
export function mergeResult(existing, result, scrapedAt) {
  const merged = {
    id: existing?.id ?? null,
    asOf: result.asOf,
    sourceLabel: result.sourceLabel,
    sourceUrl: result.sourceUrl,
    meta: { ...(existing?.meta ?? {}), ...(result.meta ?? {}) },
    series: mergeByDate(existing?.series ?? [], result.series)
  };
  const contents = (data) => JSON.stringify([data.asOf, data.sourceLabel, data.sourceUrl, data.meta, data.series]);
  const changed = !existing?.updatedAt || contents(existing) !== contents(merged);

  return { ...merged, updatedAt: changed ? scrapedAt : existing.updatedAt };
}

// Pretty-printed with one reading per line, so a git diff of a data file
// shows exactly which weeks were added or revised.
export function formatData(data) {
  return `${JSON.stringify(data, null, 2).replace(
    /\{\n\s+"date": ("[^"]+"),\n\s+"value": (-?[\d.e+-]+)\n\s+\}/g,
    '{ "date": $1, "value": $2 }'
  )}\n`;
}

export async function writeDataFile(id, data) {
  await mkdir(DATA_DIR, { recursive: true });
  const { series, ...rest } = { ...data, id };
  const ordered = series ? { ...rest, series } : rest;
  await writeFile(path.join(DATA_DIR, `${id}.json`), formatData(ordered), "utf8");
}
