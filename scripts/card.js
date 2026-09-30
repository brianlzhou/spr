#!/usr/bin/env node
// Render public/og.png, the 1200×630 image social sites show for a link to
// the page, from the current data. Needs Chrome or Chromium: set CHROME_PATH,
// or it tries the usual install locations. Run after each scrape.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (id) => JSON.parse(readFileSync(path.join(root, "public", "data", `${id}.json`), "utf8"));
const FLOOR = 252400;

const spr = read("spr").series;
const use = read("oil-use").series;
const latest = spr.at(-1);
const millions = (thousand) => (thousand / 1000).toFixed(1).replace(/\.0$/, "");
const date = (iso, options) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...options });

let since = spr.length - 2;
while (since >= 0 && spr[since].value > latest.value) since -= 1;
const lowest = since >= 0 ? `Lowest since ${date(spr[since].date, { month: "long", year: "numeric" })}` : "Lowest on record";
const days = latest.value / (use.slice(-4).reduce((sum, point) => sum + point.value, 0) / 4);
const gap = latest.value - FLOOR;

// History as an area chart, with the legal floor dashed.
const W = 1072;
const H = 230;
const t0 = Date.parse(spr[0].date);
const t1 = Date.parse(latest.date);
const max = 800000;
const x = (iso) => ((Date.parse(iso) - t0) / (t1 - t0)) * W;
const y = (value) => H - (value / max) * H;
const line = spr.map((point, index) => `${index ? "L" : "M"}${x(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join("");
const area = `${line}L${W},${H}L0,${H}Z`;

// Skip the redraw when the numbers haven't moved, so scheduled runs don't
// commit a new image that looks the same.
const keyFile = path.join(root, "public", "data", "card.json");
const key = `${latest.date} ${latest.value} ${days.toFixed(0)} ${lowest}`;
const out = path.join(root, "public", "og.png");

if (!process.argv.includes("--force") && existsSync(out) && existsSync(keyFile) && JSON.parse(readFileSync(keyFile, "utf8")).key === key) {
  console.log("og.png is current");
  process.exit(0);
}

const font = readFileSync(path.join(root, "public", "fonts", "instrument-sans-latin.woff2")).toString("base64");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Instrument Sans"; font-weight: 400 700; font-stretch: 75% 100%; src: url(data:font/woff2;base64,${font}) format("woff2"); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #fcfcfb; color: #0b0b0b; font-family: "Instrument Sans", sans-serif; padding: 52px 64px 0; }
.eyebrow { font: 500 20px/1 ui-monospace, Menlo, monospace; letter-spacing: 0.06em; text-transform: uppercase; color: #6b6a64; }
.num { margin-top: 22px; font-size: 112px; font-weight: 700; font-stretch: 78%; letter-spacing: -0.035em; line-height: 0.9; }
.num span { font-size: 56px; letter-spacing: -0.02em; }
.facts { margin-top: 18px; font-size: 29px; font-weight: 500; line-height: 1.3; color: #474641; }
.facts b { color: #0b0b0b; font-weight: 600; }
svg { position: absolute; left: 64px; bottom: 58px; }
.foot { position: absolute; left: 64px; right: 64px; bottom: 20px; display: flex; justify-content: space-between; font-size: 19px; color: #6b6a64; }
</style></head><body>
<p class="eyebrow">Strategic Petroleum Reserve</p>
<p class="num">${millions(latest.value)}M <span>barrels</span></p>
<p class="facts"><b>${lowest}.</b> ${millions(Math.abs(gap))}M ${gap >= 0 ? "above" : "below"} the legal floor.<br>About ${days.toFixed(0)} days of U.S. oil use.</p>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <path d="${area}" fill="#eb6834" opacity="0.12"/>
  <path d="${line}" fill="none" stroke="#eb6834" stroke-width="3" stroke-linejoin="round"/>
  <line x1="0" x2="${W}" y1="${y(FLOOR)}" y2="${y(FLOOR)}" stroke="#6b6a64" stroke-width="1.5" stroke-dasharray="6 6"/>
  <circle cx="${x(latest.date)}" cy="${y(latest.value)}" r="7" fill="#eb6834" stroke="#fcfcfb" stroke-width="3"/>
</svg>
<p class="foot"><span>EIA weekly data, week ending ${date(latest.date, { month: "short", day: "numeric", year: "numeric" })}. Dashed: the 252.4M legal floor.</span><span>spr.brianzhou.org</span></p>
</body></html>`;

const chrome = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].find((candidate) => candidate && existsSync(candidate));

if (!chrome) {
  console.error("No Chrome found; set CHROME_PATH. og.png not updated.");
  process.exit(1);
}

const work = mkdtempSync(path.join(tmpdir(), "spr-card-"));
const page = path.join(work, "card.html");
writeFileSync(page, html);
rmSync(out, { force: true });

// Chrome sometimes writes the screenshot and then lingers (e.g. on macOS
// while its updater runs), so wait for the file rather than for the exit.
const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--disable-component-update",
    ...(process.env.CI ? ["--no-sandbox"] : []),
    `--user-data-dir=${path.join(work, "profile")}`,
    "--window-size=1200,630",
    "--force-device-scale-factor=1",
    "--virtual-time-budget=3000",
    `--screenshot=${out}`,
    `file://${page}`
  ],
  { stdio: "ignore" }
);
const exited = new Promise((resolve) => browser.on("exit", resolve));
const written = async () => {
  for (let waited = 0; waited < 90_000; waited += 250) {
    if (existsSync(out) && statSync(out).size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
};
const ok = await Promise.race([written(), exited.then(() => existsSync(out))]);

browser.kill();
await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);

try {
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
} catch {
  // A leftover temp profile is harmless.
}

if (!ok) {
  console.error("Chrome did not write og.png");
  process.exit(1);
}

writeFileSync(keyFile, `${JSON.stringify({ key }, null, 2)}\n`);
console.log(`og.png written: ${millions(latest.value)}M barrels. ${lowest}.`);
