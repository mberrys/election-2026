"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false during SSR/hydration, true after mount. Use to gate UI that depends on the browser-side
 * TanStack cache (which may already hold data on client navigation, unlike the server's fresh client).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
