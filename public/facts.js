// Every figure the page states that doesn't come from EIA's live data, with
// the source it was checked against. Volumes are in thousand barrels, the
// unit EIA reports the reserve in.

export const SOURCES = {
  eia: { label: "EIA weekly SPR stocks (WCSSTUS1)", url: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCSSTUS1&f=W" },
  doeFacts: { label: "DOE, SPR quick facts", url: "https://www.energy.gov/hgeo/opr/spr-quick-facts" },
  doeHistory: { label: "DOE, history of SPR releases", url: "https://www.energy.gov/hgeo/opr/history-spr-releases" },
  law: { label: "42 U.S.C. 6241", url: "https://www.law.cornell.edu/uscode/text/42/6241" },
  gao: {
    label: "GAO-26-106918 (May 2026)",
    url: "https://files.gao.gov/reports/GAO-26-106918/index.html"
  },
  gao2006: { label: "GAO-06-872 (2006)", url: "https://www.gao.gov/assets/gao-06-872.pdf" },
  crsSales: { label: "CRS IN12542, mandated sales", url: "https://www.congress.gov/crs-product/IN12542" },
  cnbcBelow300: {
    label: "CNBC, Aug 10 2026",
    url: "https://www.cnbc.com/2026/08/10/oil-in-strategic-petroleum-reserve-falls-below-300-million-barrels-lowest-since-1983.html"
  },
  doeSep29: {
    label: "DOE, Sep 29 2026",
    url: "https://www.energy.gov/articles/united-states-energy-department-continues-execution-strategic-reserve-release-commitments"
  },
  reutersSep29: {
    label: "Reuters, Sep 29 2026",
    outlet: "Reuters",
    url: "https://www.reuters.com/business/energy/us-release-40-million-barrels-crude-strategic-petroleum-reserve-energy-2026-09-29/"
  },
  bloombergSep29: {
    label: "Bloomberg, Sep 29 2026",
    outlet: "Bloomberg",
    url: "https://www.ttnews.com/articles/us-taps-oil-emergency-reserve"
  },
  jpmCnbc: {
    label: "CNBC, Sep 17 2026",
    url: "https://www.cnbc.com/2026/09/17/jpmorgan-gives-up-forecasting-iran-wars-end-as-trump-blows-past-economic-redlines-.html"
  },
  jpmQuartz: {
    label: "Quartz, Sep 18 2026",
    url: "https://finance.yahoo.com/energy/articles/jpmorgan-drops-iran-war-oil-115416515.html"
  },
  cnbcCaverns: {
    label: "CNBC, Aug 15 2026",
    url: "https://www.cnbc.com/2026/08/15/strategic-petroleum-reserve-spr-oil-iran-war-caverns.html"
  },
  potter: {
    label: "Brian Potter, How the Strategic Petroleum Reserve Works (Construction Physics, Aug 27 2026)",
    url: "https://www.construction-physics.com/p/how-the-strategic-petroleum-reserve"
  },
  ft: { label: "Financial Times", url: "https://www.ft.com/content/2b002c54-1f05-4366-a0cd-23dcb4e11f12" },
  independent: {
    label: "The Independent",
    url: "https://www.independent.co.uk/news/world/americas/us-politics/strategic-petroleum-reserve-trump-iran-war-gas-prices-b3033680.html"
  },
  doeReview2016: {
    label: "DOE, Long-Term Strategic Review of the SPR (2016)",
    url: "https://www.energy.gov/sites/prod/files/2016/09/f33/Long-Term%20Strategic%20Review%20of%20the%20U.%20S.%20Strategic%20Petroleum%20Reserve%20Report%20to%20Congress_0.pdf"
  },
  doeNov2024: {
    label: "DOE, Nov 8 2024",
    url: "https://www.energy.gov/articles/biden-harris-administration-makes-final-purchase-strategic-petroleum-reserve-secures-200"
  },
  reutersNov2024: {
    label: "Reuters, Nov 8 2024 (reprinted by BOE Report)",
    url: "https://boereport.com/2024/11/08/biden-administration-buys-last-oil-for-emergency-reserve-as-fund-taps-out/"
  },
  wsjDec2022: {
    label: "Business Insider, citing the Wall Street Journal, Dec 19 2022",
    url: "https://finance.yahoo.com/news/us-made-4-billion-selling-160400735.html"
  },
  sandia: { label: "Sandia, cavern drawdown availability report", url: "https://www.osti.gov/servlets/purl/2585591" },
  spglobal: { label: "S&P Global, a rare tour of the SPR", url: "https://www.spglobal.com/energy/en/news-research/blog/crude-oil/061516-a-rare-tour-of-the-strategic-petroleum-reserve" }
};

// DOE's current authorized storage capacity.
export const CAPACITY = { value: 714000, source: SOURCES.doeFacts };

// Below this level a president can no longer order a "limited drawdown"
// (up to 30 million barrels without declaring a severe supply interruption).
// Set by the Infrastructure Investment and Jobs Act, Nov 15 2021.
export const FLOOR = { value: 252400, source: SOURCES.law };

// The 2026 release: ordered in March after Iran cut off exports through the
// Strait of Hormuz, from about 415 million barrels before the Feb 28 strikes,
// ending near 243 million when complete (CNBC, Aug 10 2026).
export const RELEASE_2026 = {
  ordered: 172000,
  startedAfter: "2026-03-06",
  endsNear: 243000,
  source: SOURCES.cnbcBelow300,
  // The last 40 million barrels of the order, offered again on Sep 29.
  lastOffer: {
    value: 40000,
    date: "2026-09-29",
    bidsDue: "2026-10-06",
    // DOE: "Deliveries under awarded exchanges are scheduled for November and December 2026."
    deliveries: { from: "2026-11-01", to: "2026-12-31" },
    // In June the same barrels drew takers for about 500,000 (Reuters).
    juneTaken: 500
  },
  timeline: [
    {
      when: "March",
      text: "The White House orders 172 million barrels lent out, the U.S. share of a 400-million-barrel release coordinated by the International Energy Agency after Iran closed the Strait of Hormuz.",
      sources: [SOURCES.cnbcBelow300, SOURCES.doeSep29]
    },
    {
      when: "Since March",
      text: "Five offers to oil companies award more than 133 million barrels in all as exchanges: loans repaid later in oil, with extra premium barrels.",
      sources: [SOURCES.doeSep29]
    },
    {
      when: "June",
      text: "DOE offers the last 40 million barrels. Companies agree to borrow only about 500,000. With the earlier loans nearly all delivered, releases slow to a trickle.",
      sources: [SOURCES.reutersSep29]
    },
    {
      when: "September 29",
      text: "DOE offers the last 40 million again, from the Big Hill and Bryan Mound sites. Bids are due October 6, with deliveries scheduled for November and December. Energy Secretary Chris Wright urges European countries, which he says have released \u201conly a fraction\u201d of what they pledged, to follow.",
      sources: [SOURCES.doeSep29, SOURCES.reutersSep29]
    }
  ]
};

// Most of the 2026 oil was lent, not sold. Accounts of the repayment differ.
export const LOANS = {
  premium: 25,
  premiumSource: SOURCES.doeSep29,
  returning: 200000,
  returningNote: "DOE expects about 200 million barrels back over the next year, roughly 20% more than it lent, according to",
  returningSource: SOURCES.bloombergSep29,
  lateNote: "reports premiums of up to 24% and repayment that isn't slated to finish until late 2028.",
  lateSource: SOURCES.reutersSep29
};

// What the two big releases earned, as DOE counts it. Money is in billions of
// dollars, prices in dollars a barrel.
export const ROUND_TRIPS = {
  // Sold in 2022 after Russia invaded Ukraine; replaced by buying 59 million
  // barrels at under $76 and cancelling 140 million barrels of sales Congress
  // had scheduled, about $74 a barrel. DOE: "200 million barrels … at an
  // average price of $74.75." Reuters, citing DOE: sold at $95, "a profit of
  // about $3.5 billion." The Wall Street Journal's tally at the time, at
  // $96.25 a barrel, was "almost $4 billion".
  sale2022: {
    sold: 180000,
    soldPrice: 95,
    revenue: 17,
    bought: 59000,
    boughtPrice: 76,
    cancelled: 140000,
    cancelledPrice: 74,
    replacedPrice: 74.75,
    profit: 3.5,
    sources: [SOURCES.doeNov2024, SOURCES.reutersNov2024, SOURCES.wsjDec2022]
  },
  // Lent in 2026 and repaid in oil. Wright: the exchanges will save
  // "taxpayers more than $3 billion."
  loans2026: {
    lent: 133000,
    premium: LOANS.premium,
    savings: 3,
    sources: [SOURCES.doeSep29, SOURCES.reutersSep29]
  }
};

// Designed peak drawdown: 4.4 million barrels a day for up to 90 days,
// starting within 13 days of an order. 2022 peaked at about 1 million a day.
export const DESIGN_RATE = { perDay: 4400, days: 90, startDays: 13, rate2022: 1000, source: SOURCES.gao };

// Published estimates of how low the reserve can safely go. In `quote`,
// curly quotes mark the source's exact words; anything outside them is a
// paraphrase. Links go to where each was reported.
export const CLAIMS = [
  {
    value: 300000,
    who: "Amos Hochstein, former Biden senior energy adviser",
    quote: "“I don't know anyone who believes we can go below 300.”",
    why: "Said in June at an Atlantic Council event; he calls DOE's 70 million figure “nonsense.”",
    sources: [SOURCES.cnbcCaverns]
  },
  {
    low: 250000,
    high: 300000,
    who: "Siddharth Misra, petroleum engineering professor, Texas A&M",
    quote: "“The practical operational floor for the crude inventory is between 250 million and 300 million barrels.”",
    why: "Below 300 million, he says, the reserve loses its ability to pump fast, and the caverns' roofs and pillars are at greater risk.",
    sources: [SOURCES.cnbcCaverns, SOURCES.independent]
  },
  {
    value: 250000,
    who: "Government Accountability Office, 1981",
    quote: "Advised against releases below 250 million barrels except in a \u201cvery severe emergency.\u201d",
    why: "Written while the reserve was still being filled, as advice on when it would be big enough to use.",
    sources: [SOURCES.bloombergSep29]
  },
  {
    value: FLOOR.value,
    who: "Federal law",
    quote: "No limited drawdown is allowed if it would take the reserve below 252.4 million barrels.",
    why: "A limit on one kind of release, not a physical floor. Full emergency drawdowns have no floor.",
    sources: [SOURCES.law]
  },
  {
    value: 170000,
    who: "Rapidan Energy Group",
    quote: "A “soft-ish floor” of around 170 million barrels, below which “cavern integrity and pumping infrastructure limitations argue against further draws.”",
    why: "In July the consultancy also estimated, from GAO's findings, that at least 103 million barrels in the reserve weren't available for use.",
    sources: [SOURCES.cnbcCaverns, SOURCES.cnbcBelow300, SOURCES.independent]
  },
  {
    low: 150000,
    high: 160000,
    who: "JPMorgan energy analyst",
    quote: "150–160 million barrels “must remain in place to preserve cavern stability.”",
    why: "An estimate reported by the Financial Times.",
    sources: [SOURCES.ft]
  },
  {
    value: 70000,
    who: "Department of Energy spokesperson",
    quote: "About 70 million barrels is the minimum needed to operate the reserve safely, a spokesperson told CNBC.",
    why: "Misra calls this the strict physical minimum: enough oil to keep the extraction pipes at the top of each cavern submerged.",
    sources: [SOURCES.cnbcBelow300, SOURCES.cnbcCaverns]
  },
  {
    value: 70000,
    who: "ClearView Energy Partners",
    quote: "An operational minimum of around 70 million barrels, \u201cthe point at which it becomes difficult for the infrastructure to function.\u201d",
    why: "A Washington consultancy's estimate, in line with DOE's.",
    sources: [SOURCES.bloombergSep29]
  },
  {
    value: 12000,
    who: "Department of Energy, 2016",
    quote: "About 12 million barrels of roof oil must stay at the top of the caverns.",
    why: "It keeps water away from the salt ceilings, which it would dissolve. The only floor in an official report.",
    sources: [SOURCES.doeReview2016]
  }
];

// What nobody knows. Curly quotes mark sources' exact words.
export const UNKNOWNS = {
  pull: {
    quote: "We simply don't know how to model the endgame.",
    who: "Natasha Kaneva, head of global commodities strategy at JPMorgan, in a Sep 17 note",
    sources: [SOURCES.jpmCnbc, SOURCES.jpmQuartz]
  },
  items: [
    {
      question: "How long the war lasts",
      text: "JPMorgan's oil team dropped its forecast on September 17: \u201cFor the first time since the start of the Iran conflict, we don't have a baseline view.\u201d The bank had expected oil above $100, gasoline near $5 and a 10-year Treasury yield above 5% to push Washington toward a deal to reopen the Strait of Hormuz. All three have been passed. \u201cThe exit strategy is less clear, not more.\u201d",
      sources: [SOURCES.jpmCnbc, SOURCES.jpmQuartz]
    },
    {
      question: "How low the reserve can safely go",
      text: "No government report names a level below which the caverns are damaged, apart from about 12 million barrels of roof oil. Published estimates run from 70 million to 300 million barrels. DOE says 70 million; Amos Hochstein, a former Biden energy adviser, calls that \u201cnonsense.\u201d",
      sources: [SOURCES.potter, SOURCES.cnbcCaverns]
    },
    {
      question: "How much of it still works",
      text: "In December 2025 more than a quarter of the oil was \u201cnot available for drawdown due to a combination of construction outages and cavern outages.\u201d GAO also found DOE \u201chad not reevaluated the effectiveness of its drawdown rate, reassessed its expectations for the reserve, or determined what an acceptable range of performance would be.\u201d",
      sources: [SOURCES.gao]
    },
    {
      question: "When the loaned oil comes back",
      text: "DOE expects about 200 million barrels back over the next year, Bloomberg reports. Reuters reports repayment isn't slated to finish until late 2028.",
      sources: [SOURCES.bloombergSep29, SOURCES.reutersSep29]
    }
  ]
};

export const DOE_REBUTTAL = {
  quote: "The caverns are always full. All that changes is the ratio of oil and water that is filling them.",
  who: "Ben Dietderich, Energy Department spokesman",
  source: SOURCES.cnbcCaverns
};

// Wear on the caverns.
export const WEAR = [
  { text: "Salt creep, the slow squeeze of the surrounding rock, costs up to 2.4 million barrels of storage space a year.", source: SOURCES.spglobal },
  { text: "Emptying a cavern with fresh water dissolves salt from its walls and makes it about 15% bigger, so each full cycle weakens the pillars between caverns.", source: SOURCES.sandia },
  { text: "The caverns were designed for about five full drawdowns. Six have one or fewer left.", source: SOURCES.sandia },
  {
    text: "In December 2025, more than a quarter of the oil was “not available for drawdown due to a combination of construction outages and cavern outages,” and DOE told GAO it was holding the infrastructure together with “Band-Aids.”",
    source: SOURCES.gao
  }
];

// Congress has ordered more sales; 92.6 million barrels remain scheduled for
// fiscal 2028–31 (Water Infrastructure Act 2018 §3009; IIJA §90002).
export const MANDATED_SALES = { value: 92600, years: "2028 to 2031", source: SOURCES.crsSales };

// The biggest releases since 1985, from DOE's history page (through
// September 2025) plus the 2026 order. Values in thousand barrels. The 2026
// row is filled in from the live data (barrels out so far).
export const RELEASES = [
  { year: "2026", what: "the Iran war and the Strait of Hormuz", kind: "emergency exchanges, 172 million ordered", live2026: true, source: SOURCES.cnbcBelow300 },
  { year: "2022", what: "Russia's invasion of Ukraine", kind: "emergency sale", value: 180000, source: SOURCES.doeHistory },
  { year: "2017–23", what: "sales ordered by Congress, or to pay for repairs", kind: "mandated sales", value: 140900, source: SOURCES.doeHistory },
  { year: "2000", what: "low heating-oil stocks in the Northeast", kind: "exchange", value: 32840, source: SOURCES.doeHistory },
  { year: "2011", what: "the war in Libya", kind: "emergency sale", value: 30640, source: SOURCES.doeHistory },
  { year: "2021", what: "pandemic supply disruptions", kind: "exchange", value: 29520, source: SOURCES.doeHistory },
  { year: "1991", what: "Operation Desert Storm", kind: "emergency sale", value: 17300, source: SOURCES.doeHistory },
  { year: "2005", what: "Hurricane Katrina", kind: "emergency sale", value: 11000, source: SOURCES.doeHistory },
  { year: "2004", what: "Hurricane Ivan", kind: "exchange", value: 5400, source: SOURCES.doeHistory },
  { year: "2008", what: "Hurricanes Gustav and Ike", kind: "exchange", value: 5389, source: SOURCES.doeHistory },
  { year: "2017", what: "Hurricane Harvey", kind: "exchange", value: 5200, source: SOURCES.doeHistory }
];

export const FURTHER_READING = [
  { label: "DOE: offer of the last 40 million barrels of the 2026 release (Sep 29 2026)", url: SOURCES.doeSep29.url },
  { label: "Reuters: US to release 40 million barrels of crude from the Strategic Petroleum Reserve (Sep 29 2026)", url: SOURCES.reutersSep29.url },
  SOURCES.potter,
  { label: "CNBC: depleted reserve nears level that raises concerns about damage to caverns (Aug 15 2026)", url: SOURCES.cnbcCaverns.url },
  { label: "CNBC: reserve falls below 300 million barrels, lowest since 1983 (Aug 10 2026)", url: SOURCES.cnbcBelow300.url },
  { label: "GAO: Congress and DOE need a unified plan for the SPR (May 2026)", url: SOURCES.gao.url },
  SOURCES.doeHistory,
  SOURCES.doeReview2016,
  SOURCES.gao2006,
  SOURCES.crsSales
];
