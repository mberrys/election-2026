import type { CandidatePhoto } from "@/data/reference/images";
import { cn } from "@/lib/utils";

const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

/** Two initials: first and last word of the name, ignoring suffixes. "Jon Ossoff" -> "JO". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !SUFFIX.test(w));
  if (!words.length) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const TINT: Record<string, string> = {
  D: "bg-party-d-faint text-party-d-ink",
  R: "bg-party-r-faint text-party-r-ink",
};

/**
 * A candidate's face: the credited photo, or initials on a party-tinted square when there is none, so rows of faces
 * stay aligned. Give `size` (px) for a fixed square, or size it with `className` (and set `fontClass` for the initials).
 * The credit goes in the tooltip; the name is expected next to it, so the image itself is decorative.
 */
export function Face({
  name,
  party,
  photo,
  size,
  className,
  fontClass,
  eager,
}: {
  name: string;
  party: string;
  photo: CandidatePhoto | undefined;
  size?: number;
  className?: string;
  fontClass?: string;
  eager?: boolean;
}) {
  const fixed = size ? { width: size, height: size } : undefined;
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail, deliberately not routed through next/image
      <img
        src={photo.src}
        alt=""
        title={`Photo: ${photo.credit}`}
        width={size}
        height={size}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn("shrink-0 rounded-lg bg-s3 object-cover object-top", className)}
        style={fixed}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-lg font-bold",
        TINT[party] ?? "bg-s3 text-muted-foreground",
        fontClass,
        className,
      )}
      style={size ? { ...fixed, fontSize: Math.round(size * 0.38) } : undefined}
    >
      {initials(name)}
    </span>
  );
}
