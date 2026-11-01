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
