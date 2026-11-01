import type { CreditedImage } from "@/data/reference/images";
import { cn } from "@/lib/utils";

/** Square, face-up crop of a candidate's photo. Renders nothing without an image; pair it with `Credit`. */
export function Portrait({
  image,
  name,
  size = 96,
  className,
}: {
  image: CreditedImage | undefined;
  name: string;
  /** Edge length in CSS pixels. */
  size?: number;
  className?: string;
}) {
  if (!image) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail, deliberately not routed through next/image
    <img
      src={image.thumbUrl}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 rounded-md bg-s3 object-cover object-top", className)}
      style={{ width: size, height: size }}
    />
  );
}
