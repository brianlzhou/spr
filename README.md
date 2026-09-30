# The Strategic Petroleum Reserve, tracked

**[spr.brianzhou.org](https://spr.brianzhou.org/)**

How much oil is left in America's emergency reserve, how fast it's leaving, how low it can
safely go, and which president sold it best. The page is static; a scheduled GitHub Action
reads the U.S. Energy Information Administration's (EIA) figures and commits any new readings to
this repository, and each commit redeploys the site on Vercel.

## What's tracked

| File | Series | Source | Updates |
| --- | --- | --- | --- |
| [`public/data/spr.json`](public/data/spr.json) | Crude in the SPR, thousand barrels | EIA [WCSSTUS1](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCSSTUS1&f=W) | Weekly, 1982– |
| [`public/data/commercial.json`](public/data/commercial.json) | Commercial crude stocks excluding the SPR | EIA [WCESTUS1](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCESTUS1&f=W) | Weekly, 1982– |
| [`public/data/oil-use.json`](public/data/oil-use.json) | Petroleum products supplied, thousand barrels a day | EIA [WRPUPUS2](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WRPUPUS2&f=W) | Weekly, 1990– |
| [`public/data/net-imports.json`](public/data/net-imports.json) | Net imports of crude and products, thousand barrels a day | EIA [WTTNTUS2](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WTTNTUS2&f=W) | Weekly, 1991– |
| [`public/data/wti.json`](public/data/wti.json) | WTI spot price at Cushing, dollars a barrel | EIA [RWTC](https://www.eia.gov/dnav/pet/hist/RWTCD.htm) | Daily, 1986– |

EIA publishes the weekly figures on Wednesdays for the week ending the previous Friday.
Everything the page states that isn't in these feeds (the legal floor, capacity, the 2026
release, analysts' estimates, DOE's release history) is in
[`public/facts.js`](public/facts.js), each figure next to its source.

## How it works

[`.github/workflows/update.yml`](.github/workflows/update.yml) runs at 15:17 and 22:17 UTC,
on every push, and on demand. It:

1. runs the parser tests,
2. fetches each EIA page and merges the readings into its JSON file ([`scraper/`](scraper)),
3. redraws the link-preview image, `public/og.png`, if the numbers moved
   ([`scripts/card.js`](scripts/card.js)),
4. commits only if a reading changed, with a message saying what changed
   ([`scripts/commit-message.js`](scripts/commit-message.js)).

Vercel serves `public/` as a static site and redeploys on every commit.

Merging is append-only: new weeks are added, revised weeks are replaced, and old weeks are
never dropped. The scraper identifies itself to EIA with a user agent that links here.

## Following changes

Each data file keeps one reading per line, so the commit history shows exactly which weeks
EIA added or revised:

```bash
git log -p -- public/data/spr.json
```

Every version of a file can be loaded into SQLite with
[git-history](https://github.com/simonw/git-history):

```bash
git-history file spr.db public/data/spr.json --convert 'json.loads(content)["series"]' --id date
```

## Data format

```json
{
  "id": "spr",
  "updatedAt": "2026-09-30T06:36:11.618Z",
  "asOf": "2026-09-18",
  "sourceLabel": "EIA weekly U.S. crude stocks in the SPR (WCSSTUS1), thousand barrels",
  "sourceUrl": "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCSSTUS1&f=W",
  "meta": { "releaseDate": "9/23/2026", "nextRelease": "9/30/2026" },
  "series": [
    { "date": "1982-08-20", "value": 270455 }
  ]
}
```

`updatedAt` changes only when the readings do. `date` is the end of the reporting week (or the
trading day, for WTI). `public/data/index.json` records when each series was last checked and
whether the fetch succeeded.

## Run it locally

Needs Node 22 or later; there are no dependencies.

```bash
npm test         # parser and store tests
npm run scrape   # fetch every series into public/data/
npm run card     # redraw public/og.png (needs Chrome; set CHROME_PATH if it isn't found)
npm run dev      # preview on http://localhost:3000
```

## Credits and license

- Data: U.S. Energy Information Administration, which as a federal agency publishes it in the
  public domain. Other figures are credited on the page to DOE, GAO, CRS and the reporting
  that published them.
- The scrape-to-git approach follows Simon Willison's
  [git scraping](https://simonwillison.net/2020/Oct/9/git-scraping/). The estimates of the
  reserve's safe minimum were first gathered by Brian Potter in
  [How the Strategic Petroleum Reserve Works](https://www.construction-physics.com/p/how-the-strategic-petroleum-reserve).
- Code: [MIT](LICENSE). The typeface is Instrument Sans, under the
  [SIL Open Font License](public/fonts/OFL.txt).
