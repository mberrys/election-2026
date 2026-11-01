import type { CandidateMeta, RaceMeta } from "@/data/schema";
import { creditText, getCandidateImage, thumbAt } from "@/data/reference/images";
import { fmtMarginDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Credit } from "./credit";
import { Face } from "./face";
import { mainCandidates } from "./race-view";

const PARTY_WORD: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent", L: "Libertarian", G: "Green", O: "Other party" };
const EDGE: Record<string, string> = { D: "bg-party-d", R: "bg-party-r", I: "bg-party-i" };
const INK: Record<string, string> = { D: "text-party-d-ink", R: "text-party-r-ink" };

/** Portrait edge in CSS pixels per breakpoint is set on the section as `--ps`; the face, its party edge and the chip follow it. */
function Side({ c, align }: { c: CandidateMeta; align: "start" | "end" | "center" }) {
  const image = getCandidateImage(c.id);
  const photo = image ? { src: thumbAt(image.thumbUrl, 330), credit: creditText(image) } : undefined;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2",
        align === "end" && "items-end text-right",
        align === "start" && "items-start text-left",
        align === "center" && "items-center text-center",
      )}
    >
      <div className="w-(--ps) overflow-hidden rounded-lg bg-s3">
        <Face
          name={c.name}
          party={c.party}
          photo={photo}
          eager
          className="size-(--ps) rounded-none"
          fontClass="text-[length:calc(var(--ps)*0.36)]"
        />
        <div className={cn("h-1", EDGE[c.party] ?? "bg-border-strong")} />
      </div>
      <div className="min-w-0 max-w-full space-y-0.5">
        <h2 className={cn("text-lg font-semibold leading-snug text-balance sm:text-xl lg:text-2xl", INK[c.party])}>{c.name}</h2>
        <p className="text-sm text-muted-foreground">{PARTY_WORD[c.party] ?? c.party}</p>
        {c.incumbent && <p className="text-sm font-semibold text-foreground">Incumbent</p>}
      </div>
      <Credit image={image} className={cn("max-w-full break-words", align === "end" && "text-right", align === "center" && "text-center")} />
    </div>
  );
}

/** The poll-average margin between the faces: the figure over a bar split D to R. Without polls, just "vs". */
function Chip({ meta, hasPair }: { meta: RaceMeta; hasPair: boolean }) {
  const poll = hasPair ? meta.polls : undefined;
  if (!poll) {
    return (
      <div className="z-10 -mx-2.5 mt-[calc(var(--ps)/2-18px)] self-start rounded-lg bg-s3 px-3 py-1.5 text-lg font-semibold text-muted-foreground sm:-mx-3.5">
        vs
      </div>
    );
  }
  const margin = poll.d - poll.r;
  const dShare = (poll.d / (poll.d + poll.r)) * 100;
  const label = fmtMarginDR(margin);
  return (
    <div
      className="z-10 -mx-2.5 mt-[calc(var(--ps)/2-32px)] flex w-max flex-col items-center gap-2 self-start rounded-lg bg-s3 px-3 py-2.5 sm:-mx-3.5 sm:px-4"
      title={`Poll average: ${label}. ${poll.n} poll${poll.n === 1 ? "" : "s"}, ${poll.source}, as of ${poll.asOf}`}
    >
      <span className={cn("fig text-xl font-bold leading-none sm:text-2xl", margin > 0.05 ? INK.D : margin < -0.05 ? INK.R : "text-foreground")}>
        <span className="sr-only">Poll average </span>
        {label}
      </span>
      <div aria-hidden className="flex h-2 w-16 overflow-hidden rounded-[2px] sm:w-20">
        <div className="bg-party-d" style={{ width: `${dShare}%` }} />
        <div className="flex-1 bg-party-r" />
      </div>
    </div>
  );
}

/**
 * Face-off header for a candidate race: the two main candidates' portraits (88 px on phones, 120 px, 152 px on large
 * screens) pushed toward the middle, where a chip with the poll-average margin and a D to R bar overlaps both. Flat
 * layering: ground, card, nested chip. Colour is on the party edge under each photo, the names and the bar. A missing photo
 * becomes initials on a party tint; a lone candidate is centred without the chip; with no D v R poll the chip reads "vs".
 */
export function RaceHero({ meta }: { meta: RaceMeta }) {
  const { main } = mainCandidates(meta);
  if (!main.length) return null;
  const [a, b] = main;
  const hasPair = main.length === 2 && ["D", "R"].every((p) => main.some((c) => c.party === p));
  return (
    <section
      aria-label={`${meta.name}: ${main.map((c) => c.name).join(" versus ")}`}
      className="rounded-xl bg-card px-4 py-6 [--ps:88px] sm:px-8 sm:py-8 sm:[--ps:120px] lg:[--ps:152px]"
    >
      {b ? (
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start">
          <Side c={a} align="end" />
          <Chip meta={meta} hasPair={hasPair} />
          <Side c={b} align="start" />
        </div>
      ) : (
        <div className="flex justify-center">
          <Side c={a} align="center" />
        </div>
      )}
    </section>
  );
}
