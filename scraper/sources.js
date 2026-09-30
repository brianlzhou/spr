import { fetchText } from "./http.js";
import { htmlToText, parseEiaDailyTable, parseEiaWeeklyTable } from "./parse.js";

// Every series the page uses. All are EIA history pages that need no key:
// weekly ones come out on Wednesdays with the Weekly Petroleum Status Report,
// and the daily WTI price page is refreshed on the same schedule.
function weekly(id, seriesId, sourceLabel) {
  const url = `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${seriesId}&f=W`;

  return {
    id,
    async scrape() {
      const parsed = parseEiaWeeklyTable(htmlToText(await fetchText(url)));

      if (parsed.series.length === 0) {
        throw new Error(`EIA ${seriesId} table parsed to zero rows`);
      }

      return {
        series: parsed.series,
        asOf: parsed.series.at(-1).date,
        sourceLabel,
        sourceUrl: url,
        meta: { releaseDate: parsed.releaseDate, nextRelease: parsed.nextRelease }
      };
    }
  };
}

const WTI_URL = "https://www.eia.gov/dnav/pet/hist/RWTCD.htm";

export const SOURCES = [
  weekly("spr", "WCSSTUS1", "EIA weekly U.S. crude stocks in the SPR (WCSSTUS1), thousand barrels"),
  weekly("commercial", "WCESTUS1", "EIA weekly U.S. commercial crude stocks, excluding the SPR (WCESTUS1), thousand barrels"),
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
