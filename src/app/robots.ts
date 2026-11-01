import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Vercel already sends X-Robots-Tag: noindex on preview deployments; this is the matching robots.txt.
  const nonProduction = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
  if (nonProduction) return { rules: { userAgent: "*", disallow: "/" } };

  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
