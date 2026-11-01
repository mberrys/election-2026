import { ImageResponse } from "next/og";
import { SITE_URL } from "./site";

/** Share-card renderer for `opengraph-image` files. Satori (behind `ImageResponse`) takes hex colors and flexbox only. */
export const OG_SIZE = { width: 1200, height: 630 };

const D = "#59a0f9";
const R = "#f36358";
const NEUTRAL = "#2a313d";
const BG = "#07090d";
const INK = "#f2f4f8";
const SOFT = "#c9d0db";
const MUTED = "#8b94a5";

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

function mix(a: string, b: string, t: number): string {
  const c = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** D minus R margin -> a color: gray at a tie, a visible tint for any lead, full party color at 25 points or more. */
export function marginHex(margin: number): string {
  if (Math.abs(margin) < 0.05) return NEUTRAL;
  return mix(NEUTRAL, margin > 0 ? D : R, 0.3 + 0.7 * Math.min(Math.abs(margin) / 25, 1));
}

export interface StripCell {
  label: string;
  margin: number;
  /** The 2026 projection, outlined. */
  projected?: boolean;
}

export const clipText = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function ogCard({ eyebrow, title, lines, strip, stripLabel }: { eyebrow: string; title: string; lines: string[]; strip?: StripCell[]; stripLabel?: string }) {
  const host = SITE_URL.replace(/^https?:\/\//, "");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, color: INK, padding: 56 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", width: 56, height: 12, background: D }} />
            <div style={{ display: "flex", width: 56, height: 12, background: R }} />
            <div style={{ display: "flex", marginLeft: 22, fontSize: 26, letterSpacing: 4, color: MUTED }}>{eyebrow.toUpperCase()}</div>
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: title.length > 18 ? 76 : 96, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
          {lines.map((l) => (
            <div key={l} style={{ display: "flex", marginTop: 16, fontSize: 33, color: SOFT, lineHeight: 1.3 }}>
              {clipText(l, 120)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
          {strip && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 22, color: MUTED, marginBottom: 10 }}>{stripLabel}</div>
              <div style={{ display: "flex" }}>
                {strip.map((c) => (
                  <div key={c.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        width: c.projected ? 78 : 70,
                        height: 70,
                        background: marginHex(c.margin),
                        border: c.projected ? `4px solid ${INK}` : "4px solid transparent",
                      }}
                    />
                    <div style={{ display: "flex", marginTop: 6, fontSize: 20, color: c.projected ? INK : MUTED }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", marginTop: 22, fontSize: 24, color: MUTED }}>{host}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/** Square app icon: the site's blue and red bars under a "B". */
export function iconImage(px: number) {
  const bar = Math.round(px * 0.09);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", background: BG }}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: Math.round(px * 0.62), fontWeight: 700, color: INK }}>B</div>
        <div style={{ display: "flex", height: bar }}>
          <div style={{ display: "flex", flex: 1, background: D }} />
          <div style={{ display: "flex", flex: 1, background: R }} />
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
