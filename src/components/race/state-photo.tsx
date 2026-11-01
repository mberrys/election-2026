import type { CreditedImage } from "@/data/reference/images";
import { cn } from "@/lib/utils";
import { Credit } from "./credit";

/** Wide 16:7 photo of a state's capitol with its credit underneath. Renders nothing without an image. */
export function StatePhoto({
  image,
  stateName,
  className,
}: {
  image: CreditedImage | undefined;
  stateName: string;
  className?: string;
}) {
  if (!image) return null;
  return (
    <figure className={cn("space-y-1.5", className)}>
      <div className="overflow-hidden rounded-lg bg-s3">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail, deliberately not routed through next/image */}
        <img
          src={image.thumbUrl}
          alt={`The ${stateName} state capitol`}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className="block aspect-[16/7] w-full object-cover"
        />
      </div>
      <figcaption>
        <Credit image={image} />
      </figcaption>
    </figure>
  );
}
