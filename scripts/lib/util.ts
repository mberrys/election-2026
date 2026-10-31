import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
export const OUT_DIR = path.join(ROOT, "public", "data", "reference");

export const USER_AGENT = "BigBoard2026/0.1 (contact: dev@example.com)";

// ---------- warnings / logging ----------

const warnings: string[] = [];
export function warn(msg: string): void {
  warnings.push(msg);
  process.stderr.write(`  [warn] ${msg}\n`);
}
export function info(msg: string): void {
  process.stderr.write(`  ${msg}\n`);
}
export function getWarnings(): string[] {
  return warnings.slice();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 1) + "\n", "utf8");
}

// ---------- strings ----------

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugify(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v", "mr", "mrs", "ms", "dr", "rev", "hon"]);

/** Tokens of a person name, lowercased, no accents/punctuation, suffixes removed. */
export function nameTokens(name: string): string[] {
  return stripAccents(name)
    .toLowerCase()
    .replace(/["“”]([^"“”]*)["“”]/g, " ") // nicknames in quotes
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.,']/g, "")
    .split(/[\s-]+/)
    .filter((t) => t && !SUFFIXES.has(t));
}

/** "ossoff-jon" style stable candidate slug. */
export function candidateSlug(name: string): string {
  const t = nameTokens(name);
  if (t.length === 0) return slugify(name) || "unknown";
  if (t.length === 1) return t[0];
  return `${t[t.length - 1]}-${t[0]}`;
}

export function normName(name: string): string {
  return nameTokens(name).join(" ");
}

export function lastName(name: string): string {
  const t = nameTokens(name);
  return t[t.length - 1] ?? "";
}

export function firstName(name: string): string {
  return nameTokens(name)[0] ?? "";
}

const NICKNAMES: string[][] = [
  ["robert", "bob", "bobby", "rob", "robbie"],
  ["william", "bill", "billy", "will", "willie"],
  ["james", "jim", "jimmy", "jamie"],
  ["michael", "mike", "mikey"],
  ["daniel", "dan", "danny"],
  ["thomas", "tom", "tommy"],
  ["joseph", "joe", "joey"],
  ["christopher", "chris"],
  ["steven", "stephen", "steve"],
  ["david", "dave", "davey"],
  ["richard", "rick", "dick", "rich", "ricky"],
  ["anthony", "tony"],
  ["andrew", "andy", "drew"],
  ["matthew", "matt"],
  ["nicholas", "nick"],
  ["benjamin", "ben"],
  ["samuel", "sam"],
  ["gregory", "greg"],
  ["jonathan", "jon", "john", "johnny", "jack"],
  ["jeffrey", "jeff"],
  ["edward", "ed", "ted", "eddie", "theodore"],
  ["elizabeth", "liz", "beth", "betsy", "lisa"],
  ["katherine", "kathleen", "kate", "katie", "kathy", "catherine", "cathy"],
  ["jennifer", "jen", "jenny"],
  ["timothy", "tim"],
  ["patrick", "pat", "patricia", "patty"],
  ["ronald", "ron", "ronnie"],
  ["donald", "don"],
  ["kenneth", "ken", "kenny"],
  ["douglas", "doug"],
  ["joshua", "josh"],
  ["peter", "pete"],
  ["alexander", "alex", "alexandra"],
  ["nathan", "nate", "nathaniel"],
  ["zachary", "zach"],
  ["deborah", "debbie", "deb"],
  ["susan", "sue", "suzanne"],
  ["margaret", "peggy", "maggie", "meg"],
  ["henry", "hank"],
  ["charles", "chuck", "charlie"],
  ["lawrence", "larry"],
  ["gerald", "jerry", "jerome"],
  ["terrence", "terry"],
  ["randall", "randy"],
  ["martin", "marty"],
  ["vincent", "vince"],
  ["russell", "russ"],
  ["frederick", "fred"],
  ["albert", "al", "alan", "alfred"],
  ["raymond", "ray"],
  ["abraham", "abe"],
  ["mitchell", "mitch"],
  ["cory", "corey"],
  ["cynthia", "cindy"],
  ["rebecca", "becky"],
  ["victoria", "vicky", "tori"],
  ["joan", "joanne"],
  ["francis", "frank", "frankie"],
  ["eugene", "gene"],
  ["leonard", "len", "lenny"],
  ["harold", "hal", "harry"],
  ["walter", "walt"],
  ["bernard", "bernie"],
  ["gabriel", "gabe"],
  ["maxwell", "max"],
  ["mary", "molly", "mollie"],
  ["angela", "angie"],
  ["sheldon", "shelly"],
  ["kimberly", "kim"],
  ["jacqueline", "jackie"],
  ["madeline", "maddie"],
  ["eleanor", "ellie", "nell"],
  ["abigail", "abby"],
  ["jessica", "jess"],
  ["ashley", "ash"],
  ["anna", "anne", "annie", "ann"],
];
const NICK_INDEX = new Map<string, number>();
NICKNAMES.forEach((g, i) => g.forEach((n) => NICK_INDEX.set(n, i)));

export function firstNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (a.length === 1 || b.length === 1) return a[0] === b[0];
  const ia = NICK_INDEX.get(a);
  const ib = NICK_INDEX.get(b);
  return ia !== undefined && ia === ib;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function median(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined;
  const s = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

export function csvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const [h, ...body] = rows;
  if (!h) return [];
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), (r[i] ?? "").trim()])));
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
/** "Oct 30, 2026" / "October 30, 2026" / "Oct. 30,2026" → "2026-10-30" */
export function parseEnglishDate(s: string): string | undefined {
  const m = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})/.exec(s);
  if (!m) return undefined;
  const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!mo) return undefined;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export function ensureDir(d: string): void {
  fs.mkdirSync(d, { recursive: true });
}
