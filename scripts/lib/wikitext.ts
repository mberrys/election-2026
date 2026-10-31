/**
 * Minimal, forgiving wikitext helpers for the election tables we need.
 * Not a general parser: handles tables, templates, links, refs, comments.
 */
import type { Party } from "../../src/data/schema";

// ---------- cleanup ----------

export function stripComments(s: string): string {
  let out = s;
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out.replace(/<!--[\s\S]*?-->/g, "");
  }
  return out;
}

export function stripRefs(s: string): string {
  return s.replace(/<ref\b[^>]*\/\s*>/gi, "").replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, "");
}

/** Remove {{efn|...}} / {{notetag|...}} footnotes (nested-brace aware, one level). */
export function stripFootnotes(s: string): string {
  let out = s;
  for (let i = 0; i < 5; i++) {
    const next = out.replace(/\{\{\s*(efn|notetag|refn|sfn|cn|citation needed)\b[^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*\}\}/gi, "");
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Split template body on top-level pipes. */
export function splitTopLevel(s: string, sep = "|"): string[] {
  const parts: string[] = [];
  let depthT = 0;
  let depthL = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === "{{") {
      depthT++;
      cur += two;
      i++;
      continue;
    }
    if (two === "}}") {
      depthT = Math.max(0, depthT - 1);
      cur += two;
      i++;
      continue;
    }
    if (two === "[[") {
      depthL++;
      cur += two;
      i++;
      continue;
    }
    if (two === "]]") {
      depthL = Math.max(0, depthL - 1);
      cur += two;
      i++;
      continue;
    }
    if (s[i] === sep && depthT === 0 && depthL === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += s[i];
  }
  parts.push(cur);
  return parts;
}

function renderTemplate(inner: string): string {
  const parts = splitTopLevel(inner);
  const name = parts[0].trim().toLowerCase().replace(/\s+/g, " ");
  const positional = parts.slice(1).filter((p) => !/^\s*[a-z_]+\s*=/i.test(p)).map((p) => p.trim());
  if (name === "sortname") {
    const first = positional[0] ?? "";
    const last = positional[1] ?? "";
    return `${first} ${last}`.trim();
  }
  if (name === "nbsp" || name === "nbs") return " ";
  if (name === "small" || name === "smaller" || name === "nowrap" || name === "nobold" || name === "nobr" || name === "center") {
    return positional.join(" ");
  }
  if (name === "ushr") {
    const st = positional[0] ?? "";
    const d = positional[1] ?? "";
    return `${st}-${/^\d+$/.test(d) ? d.padStart(2, "0") : d}`;
  }
  if (name === "usracerating") {
    const lvl = positional[0] ?? "";
    const p = positional[1] ?? "";
    return `${lvl} ${p}`.trim();
  }
  if (name === "plainlist" || name === "flatlist" || name === "unbulleted list" || name === "ubl" || name === "collapsible list") {
    return positional.join("\n");
  }
  if (name === "n/a" || name === "na") return positional[0] ?? "";
  if (name === "aye" || name === "nay" || name === "mby" || name === "yes" || name === "no" || name === "y" || name === "n") return "";
  if (name === "party stripe" || name.startsWith("party shading") || name === "shading pvi" || name === "party color") return "";
  if (name === "endplainlist" || name === "sticky header" || name === "main" || name === "see also") return "";
  if (name === "!" ) return "|";
  // unknown: keep positional text (safer for names) unless it looks like metadata
  return "";
}

/** Reduce wikitext to plain text: templates rendered/removed, links to label, tags removed. */
export function plainText(src: string): string {
  let s = stripFootnotes(stripRefs(stripComments(src)));
  // templates, innermost first
  for (let i = 0; i < 20; i++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (_m, inner: string) => renderTemplate(inner));
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1").replace(/\[https?:\/\/\S+\]/g, "");
  s = s.replace(/<br\s*\/?>/gi, " ");
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/<[^>]+>/g, "");
  }
  s = s.replace(/'{2,}/g, "");
  s = s.replace(/&nbsp;|&#160;/g, " ").replace(/&ndash;|&#8211;/g, "–").replace(/&mdash;/g, "—").replace(/&amp;/g, "&");
  return s.replace(/\s+/g, " ").trim();
}

// ---------- sections ----------

/** Text of the section whose heading matches `re` (level-aware: stops at next heading of same or higher level). */
export function getSection(text: string, re: RegExp): string | undefined {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(lines[i]);
    if (!m) continue;
    if (!re.test(m[2])) continue;
    const level = m[1].length;
    const out: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const h = /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(lines[j]);
      if (h && h[1].length <= level) break;
      out.push(lines[j]);
    }
    return out.join("\n");
  }
  return undefined;
}

/** All level-2 sections as {title, body}. */
export function level2Sections(text: string): Array<{ title: string; body: string }> {
  const lines = text.split("\n");
  const out: Array<{ title: string; body: string }> = [];
  let cur: { title: string; body: string[] } | undefined;
  for (const line of lines) {
    const h = /^(={2})\s*(.*?)\s*\1\s*$/.exec(line);
    if (h) {
      if (cur) out.push({ title: cur.title, body: cur.body.join("\n") });
      cur = { title: plainText(h[2]), body: [] };
      continue;
    }
    if (cur) cur.body.push(line);
  }
  if (cur) out.push({ title: cur.title, body: cur.body.join("\n") });
  return out;
}

// ---------- tables ----------

export interface Cell {
  /** cell attribute string (may include templates such as Party shading/Republican) */
  attrs: string;
  /** raw wikitext content */
  raw: string;
  header: boolean;
}

export interface Row {
  cells: Cell[];
  raw: string;
}

export interface Table {
  rows: Row[];
  /** header rows (all cells '!') */
  headerRows: Row[];
  /** data rows (at least one '|' cell) */
  dataRows: Row[];
}

const ATTR_RE = /^[\s\w"'=:;#%.,\-()/!]*$/;

function splitCell(content: string, header: boolean): Cell {
  const parts = splitTopLevel(content);
  if (parts.length > 1) {
    const prefix = parts[0];
    const prefixNoTpl = prefix.replace(/\{\{[^{}]*\}\}/g, "").trim();
    const hasLinkOrText = /\[\[/.test(prefix);
    if (!hasLinkOrText && (prefixNoTpl === "" || ATTR_RE.test(prefixNoTpl)) && !/^\s*\{\{\s*(sortname|ushr|usracerating)/i.test(prefix)) {
      return { attrs: prefix.trim(), raw: parts.slice(1).join("|").trim(), header };
    }
  }
  return { attrs: "", raw: content.trim(), header };
}

/** Parse all top-level wikitables in a chunk of wikitext. */
export function parseTables(src: string): Table[] {
  const text = stripComments(src);
  const lines = text.split("\n");
  const tables: Table[] = [];
  let depth = 0;
  let rows: Row[] = [];
  let cur: Row | undefined;
  let curCell: Cell | undefined;
  let curRowLines: string[] = [];

  const flushRow = () => {
    if (cur) {
      cur.raw = curRowLines.join("\n");
      if (cur.cells.length) rows.push(cur);
    }
    cur = undefined;
    curCell = undefined;
    curRowLines = [];
  };
  const startRow = () => {
    flushRow();
    cur = { cells: [], raw: "" };
  };
  const addCells = (line: string, header: boolean) => {
    if (!cur) cur = { cells: [], raw: "" };
    const body = line.slice(1);
    const pieces = header ? body.split(/!!|\|\|/) : body.split("||");
    for (const p of pieces) {
      const c = splitCell(p, header);
      cur.cells.push(c);
      curCell = c;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s+/, "");
    if (depth === 0) {
      if (line.startsWith("{|")) {
        depth = 1;
        rows = [];
        cur = undefined;
        curCell = undefined;
        curRowLines = [];
      }
      continue;
    }
    if (depth > 1) {
      if (line.startsWith("{|")) depth++;
      else if (line.startsWith("|}") && !line.startsWith("|}}")) depth--;
      if (curCell) curCell.raw += "\n" + rawLine;
      curRowLines.push(rawLine);
      continue;
    }
    // depth === 1
    if (line.startsWith("{|")) {
      depth++;
      if (curCell) curCell.raw += "\n" + rawLine;
      curRowLines.push(rawLine);
      continue;
    }
    if (line.startsWith("|}") && !line.startsWith("|}}")) {
      flushRow();
      const headerRows = rows.filter((r) => r.cells.length > 0 && r.cells.every((c) => c.header));
      const dataRows = rows.filter((r) => r.cells.some((c) => !c.header));
      tables.push({ rows, headerRows, dataRows });
      depth = 0;
      continue;
    }
    if (line.startsWith("|-")) {
      startRow();
      curRowLines.push(rawLine);
      continue;
    }
    if (line.startsWith("|+")) continue;
    curRowLines.push(rawLine);
    if (line.startsWith("!")) {
      addCells(line, true);
      continue;
    }
    if (line.startsWith("|")) {
      addCells(line, false);
      continue;
    }
    if (curCell) curCell.raw += "\n" + rawLine;
  }
  return tables;
}

export function cellText(c: Cell | undefined): string {
  return c ? plainText(c.raw) : "";
}

// ---------- domain helpers ----------

export function partyFromLabel(label: string): Party {
  const l = label.toLowerCase();
  if (/democratic|democrat\b|\bdfl\b|farmer.labor|democrat-npl|npl\b/.test(l)) return "D";
  if (/republican|\bgop\b/.test(l)) return "R";
  if (/libertarian/.test(l)) return "L";
  if (/\bgreen\b/.test(l)) return "G";
  if (/^independent$|^independent \(|nonpartisan|no party|unaffiliated|^independent$/.test(l) || l === "independent") return "I";
  return "O";
}

/** Party of a cell from its shading attrs or plain text. */
export function partyFromCell(c: Cell | undefined): Party | undefined {
  if (!c) return undefined;
  const a = c.attrs.toLowerCase();
  const m = /party shading\/(?:text\/)?([a-z]+)/.exec(a);
  if (m) {
    const p = m[1];
    if (p === "democratic") return "D";
    if (p === "republican") return "R";
    if (p === "independent") return "I";
    if (p === "libertarian") return "L";
    if (p === "green") return "G";
    if (p === "coalition" || p === "hold" || p === "loss" || p === "gain") return undefined;
  }
  if (/b0ceff/.test(a)) return "D";
  if (/ffb6b6/.test(a)) return "R";
  const t = plainText(c.raw).toLowerCase();
  if (t === "democratic" || t === "democrat" || t === "dfl" || t === "democratic-npl") return "D";
  if (t === "republican") return "R";
  if (t === "independent") return "I";
  if (t === "libertarian") return "L";
  if (t === "green") return "G";
  return undefined;
}

export interface ParsedCandidate {
  name: string;
  partyLabel: string;
  party: Party;
  pct?: number;
  linked: boolean;
  flags: string[]; // withdrawn, write-in, incumbent-marker
}

/**
 * Extract candidate entries from a row's raw text. Entries are recognised as
 * segments following {{Party stripe|...}} or bullet lines "* Name (Party) 12.3%".
 */
export function extractCandidates(rowRaw: string): ParsedCandidate[] {
  const src = stripRefs(stripComments(rowRaw));
  const out: ParsedCandidate[] = [];
  const seen = new Set<string>();
  const lines = src.split("\n");
  for (const line of lines) {
    const segments: string[] = [];
    if (/\{\{\s*party stripe\s*\|/i.test(line)) {
      const parts = line.split(/\{\{\s*party stripe\s*\|[^{}]*\}\}/i);
      for (const p of parts.slice(1)) segments.push(p);
    } else if (/^\s*\*/.test(line)) {
      segments.push(line.replace(/^\s*\*+/, ""));
    }
    for (const seg of segments) {
      const flags: string[] = [];
      if (/withdr/i.test(seg)) flags.push("withdrawn");
      if (/write-?in/i.test(seg)) flags.push("write-in");
      if (/\{\{\s*(aye|yes|y)\s*\}\}/i.test(seg)) flags.push("winner");
      const linked = /\[\[/.test(seg);
      const text = plainText(seg.replace(/\{\{\s*(small|smaller)\s*\|\s*\((withdrawn|write-in)[^}]*\}\}/gi, ""));
      // "Name (Party) 60.1%" | "Name (Party)" | "Name (Party) (write-in)"
      const m = /^(.*?)\s*\(([^()]+)\)(.*)$/.exec(text);
      if (!m) continue;
      const name = m[1].replace(/^[\s–—-]+|[\s–—-]+$/g, "").replace(/\s+/g, " ");
      const partyLabel = m[2].trim();
      if (!name || name.length < 3 || /^(first round|instant runoff|runoff|others?)$/i.test(name)) continue;
      if (!/[a-z]/i.test(name)) continue;
      const pctM = /(\d+(?:\.\d+)?)\s*%/.exec(m[3]);
      const pct = pctM ? Number(pctM[1]) : undefined;
      const party = partyFromLabel(partyLabel);
      const key = name.toLowerCase();
      const existing = out.findIndex((c) => c.name.toLowerCase() === key);
      const cand: ParsedCandidate = { name, partyLabel, party, pct, linked, flags };
      if (existing >= 0) {
        // keep last occurrence (e.g. instant-runoff final round) but merge link/flags
        cand.linked = cand.linked || out[existing].linked;
        cand.flags = Array.from(new Set([...out[existing].flags, ...flags]));
        out[existing] = cand;
      } else {
        out.push(cand);
        seen.add(key);
      }
    }
  }
  return out;
}

/** "AL-02" / "AK-AL" from the first {{ushr|XX|N|X}} in text, else undefined. */
export function districtKey(text: string): { state: string; district: string } | undefined {
  const m = /\{\{\s*ushr\s*\|\s*([A-Za-z]{2})\s*\|\s*(\d{1,2}|AL)\s*\|\s*X\s*\}\}/i.exec(text);
  if (!m) return undefined;
  const d = m[2].toUpperCase();
  return { state: m[1].toUpperCase(), district: d === "AL" ? "AL" : d.padStart(2, "0") };
}

/** D − R margin (points) from a candidate list with pcts. */
export function marginFromCandidates(cands: ParsedCandidate[]): number | undefined {
  const withPct = cands.filter((c) => typeof c.pct === "number");
  if (withPct.length === 0) return undefined;
  const topD = Math.max(0, ...withPct.filter((c) => c.party === "D").map((c) => c.pct!));
  const topR = Math.max(0, ...withPct.filter((c) => c.party === "R").map((c) => c.pct!));
  if (topD === 0 && topR === 0) return undefined;
  return Math.round((topD - topR) * 10) / 10;
}
