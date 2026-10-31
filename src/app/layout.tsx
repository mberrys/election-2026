import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/board/site-header";
import { SiteFooter } from "@/components/board/site-footer";
import { SimBanner } from "@/components/board/sim-banner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Big Board: 2026 Midterms", template: "%s · Big Board 2026" },
  description:
    "Live, free-data election tracker for the Nov 3, 2026 US midterms: Senate, House, governors and ballot measures with county-level expected-vote analysis.",
  openGraph: { type: "website", siteName: "Big Board 2026" },
};

export const viewport: Viewport = { themeColor: "#161a24", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${barlow.variable} h-full antialiased`}
      style={{ ["--font-sans" as string]: "var(--font-geist-sans)" }}
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
