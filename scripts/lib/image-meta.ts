/**
 * Pure helpers for the credited-image pipeline (scripts/build-images.ts): licence and watermark
 * filters, Commons `extmetadata` clean-up, and the "is this Wikipedia article really that person"
 * checks. Nothing here touches the network, so all of it is unit-tested (tests/data/images.test.ts).
 *
 * Policy: accuracy over coverage. Anything we cannot positively confirm (licence, subject, quality)
 * is rejected, and a missing picture is always better than the wrong person's picture.
 */
import { nameTokens } from "./util";

/** One credited image, as stored in public/data/reference/images.json. */
export interface ImageEntry {
  /** upload.wikimedia.org thumbnail URL (about 500 px wide for portraits, 960 px for state photos). */
  thumbUrl: string;
  /** Pixel size of the thumbnail at `thumbUrl`. */
  width: number;
  height: number;
  /** Wikimedia Commons file description page. */
  filePage: string;
  /** Plain-text author, at most 120 characters ("Unknown" when the file page names no one). */
  author: string;
  /** Short licence name, e.g. "CC BY-SA 4.0" or "Public domain". */
  license: string;
  licenseUrl?: string;
}

/** A page of the Commons `imageinfo` query (formatversion=2), reduced to what we read. */
export interface CommonsInfo {
  /** "File:Name.jpg" */
  title: string;
  descriptionurl: string;
  url?: string;
  thumburl?: string;
  mime?: string;
  /** Original pixel size. */
  width: number;
  height: number;
  extmetadata: Record<string, { value?: unknown } | undefined>;
}

export const MIN_WIDTH = 300;
export const AUTHOR_MAX = 120;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// ---------- Commons extmetadata ----------

/** Read an extmetadata field as a string ("" when absent or not a string/number). */
export function metaValue(meta: CommonsInfo["extmetadata"], key: string): string {
  const v = meta[key]?.value;
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  eacute: "é",
  egrave: "è",
  aacute: "á",
  oacute: "ó",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ntilde: "ñ",
  ccedil: "ç",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Commons `Artist` / `Credit` HTML to plain text: tags dropped, entities decoded, whitespace folded, capped. */
export function htmlToText(html: string, max = AUTHOR_MAX): string {
  let s = html;
  // remove tags until stable so nested/overlapping fragments cannot reassemble into a tag
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/<[^<>]*>/g, " ");
  }
  s = decodeEntities(s)
    .replace(/[<>]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}

/** Author line for the credit: the Artist field as plain text, or "Unknown". */
export function authorOf(meta: CommonsInfo["extmetadata"]): string {
  const t = htmlToText(metaValue(meta, "Artist"));
  if (!t || /^(unknown|anonymous)(\s+author)?$/i.test(t)) return "Unknown";
  return t;
}

// ---------- licence ----------

/**
 * True for licences that allow reuse with attribution: public domain (incl. PD-USGov), CC0,
 * CC BY and CC BY-SA of any version. Everything else (NC/ND, GFDL-only, fair use, "free use"
 * custom terms, unknown) is rejected, as is any file Commons flags `NonFree` or `Copyrighted`
 * without a recognised free licence.
 */
export function isAllowedLicense(meta: CommonsInfo["extmetadata"]): boolean {
  const short = metaValue(meta, "LicenseShortName").trim();
  const key = metaValue(meta, "License").trim().toLowerCase();
  const nonFree = metaValue(meta, "NonFree").trim().toLowerCase();
  if (nonFree === "true" || nonFree === "1") return false;
  if (!short && !key) return false;

  const hay = `${short} ${key}`.toLowerCase();
  if (/\b(nc|nd)\b|non-?commercial|no-?derivs?|fair[- ]use|non-?free|all rights reserved|gfdl|copyrighted free use/.test(hay)) {
    return false;
  }

  const shortOk =
    /^public domain\b/i.test(short) ||
    /^pd([-\s]|$)/i.test(short) ||
    /^cc0\b/i.test(short) ||
    /^cc[- ]zero\b/i.test(short) ||
    /^cc[- ]by(-sa)?[- ]\d(\.\d)?(\s+[a-z]{2,3})?$/i.test(short);
  const keyOk = /^pd($|-)/.test(key) || key === "cc0" || /^cc-by(-sa)?-\d(\.\d)?(-[a-z0-9]+)*$/.test(key);
  // both fields must agree when both are present, so a mislabelled short name cannot sneak through
  if (short && key) return shortOk && keyOk;
  return shortOk || keyOk;
}

// ---------- watermark ----------

/** True when categories, description or file name say the image carries a watermark. */
export function hasWatermark(meta: CommonsInfo["extmetadata"], title = ""): boolean {
  const text = [metaValue(meta, "Categories"), metaValue(meta, "ImageDescription"), metaValue(meta, "ObjectName"), title].join("|");
  return /watermark/i.test(text);
}

// ---------- image acceptance ----------

export type RejectReason = "no-info" | "mime" | "too-small" | "aspect" | "licence" | "watermark" | "no-thumb";

export interface AcceptOptions {
  /** Reject images that are not clearly landscape (width / height below this). */
  minAspect?: number;
  /** Reject images wider than this (panoramas). */
  maxAspect?: number;
  /** Minimum original width. */
  minWidth?: number;
}

/** Size of a Commons thumbnail from its URL ("…/500px-Name.jpg") scaled to the original's aspect ratio. */
export function thumbDims(thumbUrl: string, origW: number, origH: number): { width: number; height: number } {
  const m = /\/(\d+)px-[^/]+$/.exec(thumbUrl.split("?")[0]);
  const w = m ? Math.min(Number(m[1]), origW) : origW;
  return { width: w, height: Math.max(1, Math.round((origH * w) / origW)) };
}

/** A display label from Commons' licence key ("cc-by-sa-4.0" → "CC BY-SA 4.0"), or "" when the key names no accepted licence. */
export function licenseFromKey(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (/^pd($|-)/.test(key)) return "Public domain";
  if (key === "cc0") return "CC0";
  const cc = /^cc-by(-sa)?-(\d(?:\.\d)?)/.exec(key);
  return cc ? `CC BY${cc[1] ? "-SA" : ""} ${cc[2]}` : "";
}

/** Apply every rule (type, size, licence, watermark) and build the stored entry, or say why not. */
export function toImageEntry(
  info: CommonsInfo | undefined,
  opts: AcceptOptions = {},
): { ok: true; img: ImageEntry } | { ok: false; reason: RejectReason } {
  if (!info || !info.extmetadata) return { ok: false, reason: "no-info" };
  if (!ALLOWED_MIME.has((info.mime ?? "").toLowerCase()) || /\.svg$/i.test(info.title)) return { ok: false, reason: "mime" };
  if (!(info.width >= (opts.minWidth ?? MIN_WIDTH)) || !(info.height > 0)) return { ok: false, reason: "too-small" };
  const aspect = info.width / info.height;
  if ((opts.minAspect && aspect < opts.minAspect) || (opts.maxAspect && aspect > opts.maxAspect)) return { ok: false, reason: "aspect" };
  if (!isAllowedLicense(info.extmetadata)) return { ok: false, reason: "licence" };
  if (hasWatermark(info.extmetadata, info.title)) return { ok: false, reason: "watermark" };
  const rawThumb = info.thumburl || info.url;
  if (!rawThumb || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(rawThumb)) return { ok: false, reason: "no-thumb" };
  // keep the host the API hands out: thumb.wikimedia.org serves thumbnails, upload.wikimedia.org refuses non-browser hotlinks
  const thumbUrl = rawThumb.split("?")[0];
  const { width, height } = thumbDims(thumbUrl, info.width, info.height);
  const license = metaValue(info.extmetadata, "LicenseShortName").trim() || licenseFromKey(metaValue(info.extmetadata, "License"));
  if (!license) return { ok: false, reason: "licence" };
  const licenseUrl = metaValue(info.extmetadata, "LicenseUrl").trim();
  const img: ImageEntry = {
    thumbUrl,
    width,
    height,
    filePage: info.descriptionurl,
    author: authorOf(info.extmetadata),
    license,
  };
  if (/^https?:\/\//.test(licenseUrl)) img.licenseUrl = licenseUrl;
  return { ok: true, img };
}

// ---------- is this article that person? ----------

const NICKNAMES: Record<string, string[]> = {
  mike: ["michael"],
  bill: ["william"],
  billy: ["william"],
  will: ["william"],
  bob: ["robert"],
  bobby: ["robert"],
  rob: ["robert"],
  jim: ["james"],
  jimmy: ["james"],
  tom: ["thomas"],
  tommy: ["thomas"],
  dan: ["daniel"],
  danny: ["daniel"],
  dave: ["david"],
  joe: ["joseph"],
  joey: ["joseph"],
  steve: ["steven", "stephen"],
  chris: ["christopher", "christian", "christine", "christina"],
  rick: ["richard", "frederick"],
  rich: ["richard"],
  dick: ["richard"],
  ted: ["edward", "theodore"],
  ed: ["edward", "edwin"],
  tony: ["anthony"],
  andy: ["andrew"],
  ben: ["benjamin"],
  matt: ["matthew"],
  nick: ["nicholas"],
  sam: ["samuel", "samantha"],
  tim: ["timothy"],
  pat: ["patrick", "patricia"],
  jeff: ["jeffrey", "geoffrey"],
  greg: ["gregory"],
  ron: ["ronald"],
  don: ["donald"],
  ken: ["kenneth"],
  larry: ["lawrence"],
  jack: ["john", "jackson"],
  johnny: ["john"],
  hank: ["henry"],
  harry: ["harold", "henry"],
  jerry: ["gerald", "jerome"],
  jon: ["jonathan", "john"],
  kathy: ["katherine", "kathleen", "catherine"],
  katie: ["katherine", "kathleen", "catherine"],
  kate: ["katherine", "kathleen", "catherine"],
  liz: ["elizabeth"],
  beth: ["elizabeth"],
  becky: ["rebecca"],
  sue: ["susan"],
  jen: ["jennifer"],
  jenny: ["jennifer"],
  deb: ["deborah", "debra"],
  debbie: ["deborah", "debra"],
  cathy: ["catherine"],
  vicky: ["victoria"],
  abby: ["abigail"],
  maggie: ["margaret"],
  peggy: ["margaret"],
  betty: ["elizabeth"],
  sandy: ["sandra"],
  terry: ["terrence", "terrance", "theresa"],
  tammy: ["tamara"],
  randy: ["randall", "randolph"],
  rod: ["roderick", "rodney"],
  fred: ["frederick", "alfred"],
  gene: ["eugene"],
  al: ["albert", "alan", "allen", "alfred"],
  alex: ["alexander", "alexandra"],
  zach: ["zachary"],
  josh: ["joshua"],
  nate: ["nathan", "nathaniel"],
  ray: ["raymond"],
  lenny: ["leonard"],
  len: ["leonard"],
  phil: ["philip", "phillip"],
  doug: ["douglas"],
  drew: ["andrew"],
  gus: ["august", "augustus"],
  trey: ["william"],
  tj: [],
};

function firstNamesAgree(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  return (NICKNAMES[a] ?? []).includes(b) || (NICKNAMES[b] ?? []).includes(a);
}

/**
 * Does an article title ("John Fetterman", "Mike Johnson (politician)") name this candidate?
 * The surname must be a token of the title and the given name must agree (exact, prefix, nickname),
 * for the candidate's name or any alias.
 */
export function titleMatchesName(title: string, name: string, aliases: string[] = []): boolean {
  const tt = nameTokens(title.replace(/\s*\([^)]*\)\s*$/, ""));
  if (tt.length < 2) return false;
  for (const n of [name, ...aliases]) {
    const ct = nameTokens(n);
    if (ct.length < 2) continue;
    const first = ct[0];
    const last = ct[ct.length - 1];
    if (!tt.includes(last)) continue;
    // a given name that is the title's first token or any non-final token (middle names)
    if (tt.slice(0, -1).some((t) => firstNamesAgree(first, t)) || tt.includes(first)) return true;
  }
  return false;
}

const STATE_FORMS: Record<string, RegExp> = {};

/** Word-boundary regex for a state's name in prose, guarding "West Virginia", "Washington, D.C.", "Kansas City", etc. */
export function stateRegex(stateName: string): RegExp {
  const hit = STATE_FORMS[stateName];
  if (hit) return hit;
  const esc = stateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let re: RegExp;
  if (stateName === "Virginia") re = /(?<!West )\bVirginia\b/;
  else if (stateName === "Washington") re = /\bWashington\b(?!,? D\.?C\b)(?! State University)/;
  else if (stateName === "District of Columbia") re = /\b(District of Columbia|Washington,? D\.?C\b)/;
  else if (stateName === "Kansas" || stateName === "Oklahoma") re = new RegExp(`\\b${esc}\\b(?! City)`);
  else re = new RegExp(`\\b${esc}\\b`);
  STATE_FORMS[stateName] = re;
  return re;
}

const POLITICAL = /politic|senator|congress|representative|governor|legislat|lawmaker|candidate|nominee|mayor|member of the|speaker|attorney general|secretary of state|treasurer|republican|democrat|commissioner/i;

/** A deceased person's lead sentence carries a dated span, "(March 5, 1920 – April 1, 2000)"; a living one "(born ...)". */
export function looksDeceased(extract: string): boolean {
  const m = /\(([^)]{0,200})\)/.exec(extract.slice(0, 400));
  if (!m) return false;
  const p = m[1];
  if (/\bborn\b/i.test(p)) return false;
  return /\d{4}[^)]{0,40}[–—-]\s*[^)]{0,40}\d{4}/.test(p) || /\bdied\b/i.test(p);
}

export interface PersonContext {
  name: string;
  aliases?: string[];
  party?: string;
  stateName: string;
}

/**
 * Confident-match test for a Wikipedia search hit. Requires, together: the title names the
 * candidate; the lead mentions the candidate's state; the lead is about a politician or candidate;
 * the person is not deceased; and the lead does not put the person in only the opposite major party.
 */
export function isConfidentArticle(title: string, extract: string, ctx: PersonContext): boolean {
  if (!titleMatchesName(title, ctx.name, ctx.aliases)) return false;
  if (!extract || !stateRegex(ctx.stateName).test(extract)) return false;
  if (!POLITICAL.test(extract)) return false;
  if (looksDeceased(extract)) return false;
  const rep = /\bRepublican\b/.test(extract);
  const dem = /\bDemocrat(ic)?\b/.test(extract);
  if (ctx.party === "D" && rep && !dem) return false;
  if (ctx.party === "R" && dem && !rep) return false;
  return true;
}

/** Wikipedia `pageimage` file name to Commons title ("File:John_Doe.jpg" -> "File:John Doe.jpg"). */
export function commonsTitle(pageimage: string): string {
  return "File:" + pageimage.replace(/^File:/i, "").replace(/_/g, " ");
}

/** Only files that live on Commons are usable (a local en.wikipedia file may be non-free). */
export function isCommonsOriginal(url: string): boolean {
  return /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(url);
}
