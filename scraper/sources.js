import { fetchText } from "./http.js";
import { htmlToText, parseEiaDailyTable, parseEiaWeeklyTable, parseWpsrTable4 } from "./parse.js";

// Every series the page uses. All are EIA pages that need no key: weekly ones
// come out on Wednesdays with the Weekly Petroleum Status Report, and the
// daily WTI price page is refreshed on the same schedule.
const WPSR_TABLE4_URL = "https://ir.eia.gov/wpsr/table4.csv";
let table4 = null;

// One fetch of table 4 per run, shared by the series that read it.
function loadTable4() {
  table4 ??= fetchText(WPSR_TABLE4_URL, { timeoutMs: 30_000 });
  return table4;
}

const usDate = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${month}/${day}/${year}`;
};

// `wpsrStub` names the series' row in table 4. On release day the history
// pages can lag or time out under load while table 4 is already up, so its
// latest weeks fill in; the history page stays the record for everything else.
function weekly(id, seriesId, sourceLabel, wpsrStub) {
  const url = `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${seriesId}&f=W`;

  return {
    id,
    async scrape() {
      const [history, latest] = await Promise.allSettled([
        fetchText(url).then((html) => parseEiaWeeklyTable(htmlToText(html))),
        wpsrStub ? loadTable4().then((csv) => parseWpsrTable4(csv, wpsrStub)) : Promise.resolve([])
      ]);
      const parsed = history.status === "fulfilled" ? history.value : { series: [], releaseDate: null, nextRelease: null };
      const recent = latest.status === "fulfilled" ? latest.value : [];
      const through = parsed.series.at(-1)?.date ?? "";
      const newer = recent.filter((point) => point.date > through);
      const series = [...parsed.series, ...newer];

      if (series.length === 0) {
        const reason = history.status === "rejected" ? history.reason.message : `EIA ${seriesId} table parsed to zero rows`;
        throw new Error(reason);
      }

      // When table 4 is ahead of the history page, it was published today;
      // the next release date isn't known until the history page updates.
      const meta = newer.length
        ? { releaseDate: usDate(new Date().toISOString().slice(0, 10)), nextRelease: null, latestFrom: WPSR_TABLE4_URL }
        : { releaseDate: parsed.releaseDate, nextRelease: parsed.nextRelease, latestFrom: null };

      return { series, asOf: series.at(-1).date, sourceLabel, sourceUrl: url, meta };
    }
  };
}

const WTI_URL = "https://www.eia.gov/dnav/pet/hist/RWTCD.htm";

export const SOURCES = [
  weekly("spr", "WCSSTUS1", "EIA weekly U.S. crude stocks in the SPR (WCSSTUS1), thousand barrels", "SPR"),
  weekly("commercial", "WCESTUS1", "EIA weekly U.S. commercial crude stocks, excluding the SPR (WCESTUS1), thousand barrels", "Commercial (Excluding SPR)"),
  weekly("oil-use", "WRPUPUS2", "EIA weekly U.S. petroleum products supplied (WRPUPUS2), thousand barrels a day"),
  weekly("net-imports", "WTTNTUS2", "EIA weekly U.S. net imports of crude oil and products (WTTNTUS2), thousand barrels a day"),
  {
    id: "wti",
    async scrape() {
      const parsed = parseEiaDailyTable(await fetchText(WTI_URL));

      if (parsed.series.length === 0) {
        throw new Error("EIA daily WTI table parsed to zero rows");
      }

      return {
        series: parsed.series,
        asOf: parsed.series.at(-1).date,
        sourceLabel: "EIA daily WTI spot price, Cushing (RWTC), dollars a barrel",
        sourceUrl: WTI_URL,
        meta: { releaseDate: parsed.releaseDate, nextRelease: parsed.nextRelease }
      };
    }
  }
];
