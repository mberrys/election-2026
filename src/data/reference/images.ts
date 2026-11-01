/**
 * Typed, server-side loader for the credited photos in public/data/reference/images.json, produced by
 * `npm run build:images` (scripts/build-images.ts).
 *
 * Every image is a Wikimedia Commons file under a licence that allows reuse with attribution (public
 * domain, CC0, CC BY, CC BY-SA), so anything rendered from this data must show its credit: use the
 * `Credit` component next to the picture. A candidate or state with no confidently matched, freely
 * licensed photo has no entry, and the getters return `undefined`.
 */
import imagesJson from "../../../public/data/reference/images.json";

export interface CreditedImage {
  /** Thumbnail URL on Wikimedia's image servers (about 500 px wide for portraits, 960 px for state photos). */
  thumbUrl: string;
  /** Pixel size of the image at `thumbUrl`. */
  width: number;
  height: number;
  /** Wikimedia Commons file page, linked from the credit. */
  filePage: string;
  /** Plain-text author (at most 120 characters), or "Unknown". */
  author: string;
  /** Short licence name, e.g. "CC BY-SA 4.0" or "Public domain". */
  license: string;
  licenseUrl?: string;
}

export interface ImagesFile {
  builtAt: string;
  /** Keyed by `CandidateMeta.id` from races.json. */
  candidates: Record<string, CreditedImage>;
  /** Keyed by two-letter state abbreviation (51 incl. DC): a photo of the state capitol. */
  states: Record<string, CreditedImage>;
}

const FILE = imagesJson as unknown as ImagesFile;
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Portrait of a candidate (`CandidateMeta.id`), or undefined when none is available. */
export function getCandidateImage(candidateId: string): CreditedImage | undefined {
  return has(FILE.candidates, candidateId) ? FILE.candidates[candidateId] : undefined;
}

/** Photo of a state's capitol building by two-letter abbreviation ("CA", "DC"), or undefined. */
export function getStateImage(abbr: string): CreditedImage | undefined {
  const k = abbr.toUpperCase();
  return has(FILE.states, k) ? FILE.states[k] : undefined;
}

/** Slim photo data for client components: a thumbnail URL and the "Author / Licence" credit for a tooltip. */
export interface CandidatePhoto {
  src: string;
  credit: string;
}

/** Keyed by `CandidateMeta.id`; candidates without a photo are absent. */
export type PhotoMap = Record<string, CandidatePhoto>;

/** "Author / Licence", the text of a photo's `title` and the credits page. */
export function creditText(image: Pick<CreditedImage, "author" | "license">): string {
  return `${image.author} / ${image.license}`;
}

/**
 * The same Commons thumbnail at a smaller standard width (Wikimedia's steps are 20, 40, 60, 120, 250, 330, 500, 960),
 * so a 44 px face does not download a 500 px portrait. URLs that are not in the `/{n}px-File` form, or are already
 * that small, come back unchanged.
 */
export function thumbAt(url: string, px: number): string {
  const m = /\/(\d+)px-([^/]+)$/.exec(url);
  if (!m || Number(m[1]) <= px) return url;
  return url.slice(0, m.index) + `/${px}px-${m[2]}`;
}

/** Photo data for the given candidate ids, at `px` wide. Build it on the server and pass only the races shown. */
export function candidatePhotoMap(ids: Iterable<string>, px = 120): PhotoMap {
  const out: PhotoMap = {};
  for (const id of ids) {
    const img = getCandidateImage(id);
    if (img) out[id] = { src: thumbAt(img.thumbUrl, px), credit: creditText(img) };
  }
  return out;
}
