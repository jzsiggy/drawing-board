"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False in the pre-rendered HTML, true once React runs in the browser. Text
// typed into a field before then is wiped when React takes over, so fields
// stay disabled until this is true.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
