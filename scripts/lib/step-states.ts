import { StateMeta } from "../../src/data/schema";
import { fetchText } from "./http";
import { EMBEDDED_POLL_CLOSE, STATES, VOTE_ORDER } from "./states";
import { info, warn } from "./util";

export const GREEN_PAPERS_URL = "https://www.thegreenpapers.com/G26/closing.phtml?format=ga";
export const GREEN_PAPERS_HOURS_URL = "https://thegreenpapers.com/G26/PollingHours.phtml";

export type StateMetaOut = StateMeta & { pollCloseSource: string };

/** "8:00p EST" → "20:00"; "12:00a EST" → "00:00". */
function toHHMM(s: string): string | undefined {
  const m = /(\d{1,2}):(\d{2})\s*([ap])/i.exec(s);
  if (!m) return undefined;
  let h = Number(m[1]);
  const ap = m[3].toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/** Minutes since 06:00 ET so that post-midnight closes sort after 23:00. */
function sortKey(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m;
  return t < 6 * 60 ? t + 24 * 60 : t;
}

/** Parse the Green Papers "General Election Polling Closing Times Alphabetically" table. */
export function parseGreenPapers(html: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  let inGeneral = false;
  // The Eastern-time cell is shared across consecutive states via rowspan; carry it forward.
  let carry: { time: string; remaining: number } | undefined;
  for (const tr of trs) {
    const dateRow = /colspan="?\d+"?[^>]*>\s*([^<]*\d{4})\s*</i.exec(tr);
    if (dateRow && /<td[^>]*colspan/i.test(tr)) {
      inGeneral = /3 November 2026/.test(dateRow[1] ?? "");
      carry = undefined;
      continue;
    }
    if (!inGeneral) continue;
    const tds = tr.match(/<td[\s\S]*?<\/td>/gi) ?? [];
    if (tds.length === 0) continue;
    const a = /<a href="([A-Z]{2})"/.exec(tds[0] ?? "");
    if (!a) continue;
    const abbr = a[1];
    let t: string | undefined;
    if (tds.length >= 3) {
      const eastern = (tds[2] ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
      t = toHHMM(eastern);
      const rs = /rowspan="?(\d+)"?/i.exec(tds[2] ?? "");
      carry = t && rs ? { time: t, remaining: Number(rs[1]) - 1 } : undefined;
    } else if (carry && carry.remaining > 0) {
      t = carry.time;
      carry.remaining--;
    }
    if (!t) continue;
    const arr = out.get(abbr) ?? [];
    arr.push(t);
    out.set(abbr, arr);
  }
  return out;
}

export async function buildStates(): Promise<{ states: StateMetaOut[]; pollCloseSource: string }> {
  let closes: Map<string, string[]> | undefined;
  let source = "embedded-unverified";
  try {
    const res = await fetchText(GREEN_PAPERS_URL, { label: "greenpapers" });
    if (res.ok) {
      const parsed = parseGreenPapers(res.body);
      const covered = STATES.filter((s) => parsed.has(s.abbr)).length;
      if (covered >= 50) {
        closes = parsed;
        source = "thegreenpapers.com/G26/closing.phtml?format=ga";
        info(`Green Papers closing times parsed for ${covered}/51 states`);
      } else {
        warn(`Green Papers parse covered only ${covered}/51 states; using embedded table`);
      }
    } else {
      warn(`Green Papers fetch failed (HTTP ${res.status}); using embedded poll-close table`);
    }
  } catch (e) {
    warn(`Green Papers error: ${(e as Error).message}; using embedded poll-close table`);
  }

  const states: StateMetaOut[] = [];
  for (const s of STATES) {
    let first: string | undefined;
    let last: string;
    let src = source;
    const times = closes?.get(s.abbr);
    if (times && times.length) {
      const uniq = Array.from(new Set(times)).sort((a, b) => sortKey(a) - sortKey(b));
      last = uniq[uniq.length - 1];
      first = uniq.length > 1 ? uniq[0] : undefined;
    } else {
      const e = EMBEDDED_POLL_CLOSE[s.abbr];
      last = e.last;
      first = e.first;
      src = "embedded-unverified";
      if (closes) warn(`Green Papers had no row for ${s.abbr}; embedded value used`);
    }
    const vo = VOTE_ORDER[s.abbr];
    const meta = StateMeta.parse({
      abbr: s.abbr,
      name: s.name,
      fips: s.fips,
      pollCloseEt: first ? `${first}/${last}` : last,
      pollCloseFirstEt: first,
      voteOrder: vo?.order ?? "unknown",
      voteOrderNote: vo?.note,
      feeds: [],
    });
    states.push({ ...meta, pollCloseSource: src });
  }
  return { states, pollCloseSource: source };
}
