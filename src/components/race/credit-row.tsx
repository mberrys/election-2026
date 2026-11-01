import Link from "next/link";
import { thumbAt, type CreditedImage } from "@/data/reference/images";

const LINK = "underline underline-offset-4 hover:text-foreground";

/** One line of the photo credits list: a 44 px thumb, the subject linked to its page, and author, licence and file page in grey. */
export function CreditRow({ image, name, href, note }: { image: CreditedImage; name: string; href: string; note?: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote Commons thumbnail, deliberately not routed through next/image */}
      <img
        src={thumbAt(image.thumbUrl, 120)}
        alt=""
        width={44}
        height={44}
        loading="lazy"
        decoding="async"
        className="size-11 shrink-0 rounded-lg bg-s3 object-cover object-top"
      />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-snug">
          <Link href={href} className="hover:underline underline-offset-4">
            {name}
          </Link>
          {note && <span className="font-normal text-muted-foreground"> {note}</span>}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {image.author} /{" "}
          {image.licenseUrl ? (
            <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
              {image.license}
            </a>
          ) : (
            image.license
          )}{" "}
          /{" "}
          <a href={image.filePage} target="_blank" rel="noopener noreferrer" className={LINK}>
            File page
          </a>
        </p>
      </div>
    </li>
  );
}
