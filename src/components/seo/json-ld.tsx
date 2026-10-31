import { serializeJsonLd } from "@/lib/seo";

/** Structured data for crawlers: a native script tag, as the Next.js JSON-LD guide recommends (not next/script). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
