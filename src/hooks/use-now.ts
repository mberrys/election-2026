"use client";

import { useSyncExternalStore } from "react";

const subscribeClock = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};
const clientNow = () => Math.floor(Date.now() / 1000) * 1000;
const serverNow = () => null;

/** Wall clock at 1 s resolution; null during SSR/hydration so Date.now() never runs in the prerender. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeClock, clientNow, serverNow);
}
