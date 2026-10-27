"use client";

import { useHydrated } from "./useHydrated";

// A date in the phone's own time zone and language. The pre-rendered HTML
// uses a fixed format (UTC), which React swaps for the local one after
// hydration without a mismatch.
export function LocalDate({ iso }: { iso: string }) {
  const hydrated = useHydrated();
  const date = new Date(iso);
  const text = hydrated
    ? date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return <time dateTime={iso}>{text}</time>;
}
