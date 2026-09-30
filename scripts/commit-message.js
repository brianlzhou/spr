#!/usr/bin/env node
// Describe what a scrape changed, for the commit message: the SPR's new level
// first, then which other series gained or revised readings. Compares the
// working tree with the last commit.
//
//   git commit -m "$(node scripts/commit-message.js)"
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERIES = [
  ["spr", "SPR"],
  ["commercial", "commercial crude"],
  ["oil-use", "oil use"],
  ["net-imports", "net imports"],
  ["wti", "WTI"]
];

const current = (id) => JSON.parse(readFileSync(path.join(root, "public", "data", `${id}.json`), "utf8")).series;
const committed = (id) => {
  try {
    return JSON.parse(execFileSync("git", ["show", `HEAD:public/data/${id}.json`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).series;
  } catch {
    return [];
  }
};
const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const millions = (thousand) => `${(thousand / 1000).toFixed(1)}M`;

const parts = [];

for (const [id, label] of SERIES) {
  const before = new Map(committed(id).map((point) => [point.date, point.value]));
  const after = current(id);
  const added = after.filter((point) => !before.has(point.date));
  const revised = after.filter((point) => before.has(point.date) && before.get(point.date) !== point.value);

  if (!added.length && !revised.length) continue;

  if (id === "spr" && added.length) {
    const latest = after.at(-1);
    const prior = after.at(-2);
    const change = latest.value - prior.value;
    parts.push(`SPR ${millions(latest.value)} barrels, week ending ${shortDate(latest.date)} (${change < 0 ? "−" : "+"}${millions(Math.abs(change))})`);
  } else {
    const detail = [added.length ? `through ${shortDate(after.at(-1).date)}` : null, revised.length ? `${revised.length} revised` : null].filter(Boolean).join(", ");
    parts.push(`${label} ${detail}`);
  }
}

console.log(parts.length ? parts.join("; ") : `data: refresh ${new Date().toISOString().slice(0, 10)}`);
