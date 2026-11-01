"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    kofiWidgetOverlay?: { draw: (user: string, options: Record<string, string>) => void };
  }
}

/**
 * Ko-fi's "Support me" button, shown only at the very bottom of the page. The footer ends with an empty strip as tall
 * as the button's corner; while that whole strip is on screen the button fades in over it, so it never covers text.
 * Everywhere else it stays hidden (globals.css, `html[data-kofi]`). The script loads after the page is idle.
 */
export function KofiWidget() {
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const root = document.documentElement;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? root.setAttribute("data-kofi", "") : root.removeAttribute("data-kofi")), {
      threshold: 0.98,
    });
    io.observe(el);
    return () => {
      io.disconnect();
      root.removeAttribute("data-kofi");
    };
  }, []);

  return (
    <>
      <div ref={strip} aria-hidden className="h-24" />
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
    </>
  );
}
