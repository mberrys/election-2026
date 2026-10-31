import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/board/site-header";
import { SiteFooter } from "@/components/board/site-footer";
import { SimBanner } from "@/components/board/sim-banner";

// Archivo for every word (variable width 62–125 for wide headings); JetBrains Mono only for figures that tick.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Big Board: 2026 Midterms", template: "%s · Big Board 2026" },
  description:
    "Live, free-data election tracker for the Nov 3, 2026 US midterms: Senate, House, governors and ballot measures with county-level expected-vote analysis.",
  openGraph: { type: "website", siteName: "Big Board 2026" },
};

export const viewport: Viewport = { themeColor: "#07090d", colorScheme: "dark" };

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
          <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
