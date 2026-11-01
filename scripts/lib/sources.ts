export interface SourceEntry {
  id: string;
  name: string;
  url: string;
  license: string;
  attribution: string;
  cadence: string;
  usedFor: string[];
  status?: "ok" | "failed" | "blocked" | "fallback" | "skipped";
  statusNote?: string;
}

export const SOURCES: SourceEntry[] = [
  {
    id: "wikipedia",
    name: "Wikipedia (MediaWiki API)",
    url: "https://en.wikipedia.org/wiki/2026_United_States_elections",
    license: "CC BY-SA 4.0",
    attribution: "Text and tables from Wikipedia, the free encyclopedia (CC BY-SA 4.0). Derived tables are share-alike.",
    cadence: "fetched at build; refresh every 30 min via cron",
    usedFor: ["candidates (Senate/House/Governor)", "Cook/Inside/Sabato ratings", "ballot measures", "state legislative chamber control + Sabato ratings", "prior-race margins (2020 Senate, 2022/2024 Governor, 2024 House fallback)"],
  },
  {
    id: "riotimes-dataroom",
    name: "The Rio Times — US Midterms 2026 Data Room",
    url: "https://www.riotimesonline.com/us-midterms-2026-data-room/",
    license: "CC BY 4.0 (compilation only; underlying Cook/RCP/DDHQ terms unchanged)",
    attribution: "Data: The Rio Times US Midterms 2026 Data Room (CC BY 4.0), https://www.riotimesonline.com/us-midterms-2026-data-room/",
    cadence: "averages/ratings every 40 min; markets every 20 min",
    usedFor: ["generic-ballot five-average", "ratings cross-check (consensus disagreements recorded in RaceMeta.notes)"],
  },
  {
    id: "votehub",
    name: "VoteHub Polls API",
    url: "https://votehub.com/polls/api",
    license: "CC BY 4.0",
    attribution: "Polling data via VoteHub (CC BY 4.0); each poll credited to its original pollster/source URL.",
    cadence: "live API; fetched at build",
    usedFor: ["generic-ballot polls", "per-race Senate/Governor/House polls"],
  },
  {
    id: "openfec",
    name: "OpenFEC API",
    url: "https://api.open.fec.gov/developers/",
    license: "US federal public domain (contributor data may not be used for solicitation)",
    attribution: "Campaign finance data: Federal Election Commission (OpenFEC).",
    cadence: "fetched at build; candidate totals update with filings",
    usedFor: ["candidate receipts and cash on hand", "FEC candidate ids"],
  },
  {
    id: "tonmcg-county",
    name: "tonmcg US County Level Election Results 08-24",
    url: "https://github.com/tonmcg/US_County_Level_Election_Results_08-24",
    license: "MIT (README: not authoritative; 2024 scraped from Fox News)",
    attribution: "County presidential results compiled by Tony McGovern (github.com/tonmcg), MIT License.",
    cadence: "static",
    usedFor: ["2024/2020 presidential margins and turnout by county and by state"],
  },
  {
    id: "medsl-house",
    name: "MIT Election Data + Science Lab — U.S. House 1976–2024",
    url: "https://doi.org/10.7910/DVN/IG0UN2",
    license: "CC0 1.0",
    attribution: "MIT Election Data and Science Lab, 2017, 'U.S. House 1976–2024', Harvard Dataverse, doi:10.7910/DVN/IG0UN2.",
    cadence: "static",
    usedFor: ["2024 House margins (preferred when the Dataverse guestbook allows API download)"],
  },
  {
    id: "medsl-president",
    name: "MIT Election Data + Science Lab — U.S. President 1976–2024",
    url: "https://doi.org/10.7910/DVN/42MVDX",
    license: "CC0 1.0",
    attribution: "MIT Election Data and Science Lab, 2017, 'U.S. President 1976–2020' (extended to 2024), Harvard Dataverse, doi:10.7910/DVN/42MVDX.",
    cadence: "static",
    usedFor: ["presidential margin by state and nationally, 1976–2024 (Then & Now history)"],
  },
  {
    id: "google-civic",
    name: "Google Civic Information API v2",
    url: "https://developers.google.com/civic-information/docs/v2",
    license: "Google APIs Terms of Service; data comes from state election authorities",
    attribution: "Ballot information via the Google Civic Information API. Addresses are passed through and not stored.",
    cadence: "live, per lookup on /ballot",
    usedFor: ["polling places, early-vote sites, drop-off locations and ballot contests for a voter's address"],
  },
  {
    id: "downballot-presbycd",
    name: "The Downballot — 2024 presidential results by 2026 congressional district",
    url: "https://the-db.co/presbycd",
    license: "Not stated; cite 'The Downballot' with link (per sheet Info tab)",
    attribution: "Calculated by The Downballot (Jeff Singer, Daniel Donner, David Nir), the-db.co/presbycd.",
    cadence: "static; updated after new maps",
    usedFor: ["House baseline presMargin2024/presMargin2020 on 2026 lines"],
  },
  {
    id: "greenpapers",
    name: "The Green Papers — 2026 General Election Poll Closing Times",
    url: "https://www.thegreenpapers.com/G26/closing.phtml?format=ga",
    license: "© The Green Papers; facts (poll hours) used, page linked",
    attribution: "Poll closing times via The Green Papers (thegreenpapers.com).",
    cadence: "static; hand-verify before election night",
    usedFor: ["StateMeta.pollCloseEt / pollCloseFirstEt"],
  },
  {
    id: "research-vote-order",
    name: "Internal research: vote-order by state (NPR/Axios 2024 explainers)",
    url: "docs/research/05-kornacki-analytics.md",
    license: "n/a",
    attribution: "Big Board research notes; verify before launch.",
    cadence: "manual",
    usedFor: ["StateMeta.voteOrder / voteOrderNote"],
  },
];
