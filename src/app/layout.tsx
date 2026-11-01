import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/board/site-header";
import { SiteFooter } from "@/components/board/site-footer";
import { SimBanner } from "@/components/board/sim-banner";
import { JsonLd } from "@/components/seo/json-ld";
import { websiteJsonLd } from "@/lib/seo";
import { DEFAULT_TITLE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// Archivo for every word (variable width 62–125 for wide headings); JetBrains Mono only for figures that tick.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: "%s · Big Board 2026" },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: SITE_NAME, title: DEFAULT_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: DEFAULT_TITLE, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#0b0c0e", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${archivo.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <SimBanner />
          <SiteHeader />
          <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-8 lg:px-10 pt-8 pb-16 md:pt-12 md:pb-24">{children}</main>
          <SiteFooter />
        </Providers>
        <JsonLd data={websiteJsonLd()} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
