"use client";

import Script from "next/script";

declare global {
  interface Window {
    kofiWidgetOverlay?: { draw: (user: string, options: Record<string, string>) => void };
  }
}

/** Ko-fi's floating "Support me" button. Loaded after the page is idle so it never delays the board. */
export function KofiWidget() {
  return (
    <Script
      src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js"
      strategy="lazyOnload"
      onLoad={() =>
        window.kofiWidgetOverlay?.draw("mberrys", {
          type: "floating-chat",
          "floating-chat.donateButton.text": "Support me",
          "floating-chat.donateButton.background-color": "#323842",
          "floating-chat.donateButton.text-color": "#fff",
        })
      }
    />
  );
}
