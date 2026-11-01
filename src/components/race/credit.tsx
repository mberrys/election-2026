import type { CreditedImage } from "@/data/reference/images";
import { cn } from "@/lib/utils";

const LINK = "underline underline-offset-4 hover:text-foreground";

/** One muted line crediting a Commons photo: "Photo: {author} / {license}", linked to the file page and licence. */
export function Credit({ image, className }: { image: CreditedImage | undefined; className?: string }) {
  if (!image) return null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      <a href={image.filePage} target="_blank" rel="noopener noreferrer" className={LINK}>
        Photo
      </a>
      : {image.author} /{" "}
      {image.licenseUrl ? (
        <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
          {image.license}
        </a>
      ) : (
        image.license
      )}
    </p>
  );
}
