"use client";

import { useEffect, useRef } from "react";

// The drawing page's sideways-scrolling row of versions. Keeps the selected
// one (aria-current) in view: on arrival, and when another is picked.
export function VersionRow({ selectedId, children }: { selectedId: string | null; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const row = ref.current;
    const selected = row?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!row || !selected) return;
    // Scroll the row only, never the page; jump on arrival, glide after.
    const left = selected.offsetLeft - row.offsetLeft - parseFloat(getComputedStyle(row).paddingLeft);
    row.scrollTo({ left, behavior: first.current ? "instant" : "smooth" });
    first.current = false;
  }, [selectedId]);

  return (
    <section ref={ref} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2" aria-label="Drawing and versions">
      {children}
    </section>
  );
}
