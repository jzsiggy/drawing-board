"use client";

import { useHydrated } from "./useHydrated";

// Dates and times in the phone's own time zone and language. The
// pre-rendered HTML uses a fixed format (UTC), which React swaps for the
// local one after hydration without a mismatch.
export function LocalDate({ iso, long = false }: { iso: string; long?: boolean }) {
  const hydrated = useHydrated();
  const options: Intl.DateTimeFormatOptions = long
    ? { day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "short" };
  const date = new Date(iso);
  const text = hydrated ? date.toLocaleDateString(undefined, options) : date.toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
  return <time dateTime={iso}>{text}</time>;
}

// "14:20 today", "14:20, 24 Oct".
export function LocalTime({ iso }: { iso: string }) {
  const hydrated = useHydrated();
  const date = new Date(iso);
  const zone = hydrated ? {} : { timeZone: "UTC" };
  const locale = hydrated ? undefined : "en-GB";
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", ...zone });
  const today = date.toLocaleDateString(locale, zone) === new Date().toLocaleDateString(locale, zone);
  const text = today ? `${time} today` : `${time}, ${date.toLocaleDateString(locale, { day: "numeric", month: "short", ...zone })}`;
  return <time dateTime={iso}>{text}</time>;
}
