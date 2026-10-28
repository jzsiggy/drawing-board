/* eslint-disable @next/next/no-img-element -- images come from /api/images redirects */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { buttonClass } from "@/components/buttonClass";
import { useHydrated } from "@/components/useHydrated";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import { TITLE_MAX } from "@/lib/posters";

export function PosterForm({ drawingId, initialTitle }: { drawingId: string; initialTitle: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [title, setTitle] = useState(initialTitle);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetOnLeave(
    useCallback(() => {
      setTitle(initialTitle);
      setStarting(false);
      setError(null);
    }, [initialTitle]),
  );

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setStarting(true);
    setError(null);
    const res = await fetch(`/api/drawings/${drawingId}/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      setStarting(false);
      setError((await res.json().catch(() => null))?.error ?? "Couldn't start your poster. Try again.");
      return;
    }
    router.push(`/result/${(await res.json()).id}`);
  }

  return (
    <form onSubmit={generate} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 pt-8 pb-5">
      <div className="flex items-stretch gap-4">
        <img
          src={`/api/images/sketch/${drawingId}`}
          alt="Your sketch"
          className="h-28 w-21 shrink-0 border border-line bg-white object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <h1 className="text-4xl leading-[34px]">Make it a poster</h1>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Poster title</span>
            <input
              id="poster-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              disabled={!hydrated || starting}
              placeholder="Untitled"
              autoComplete="off"
              className="h-11 border border-line bg-card px-3 text-lg outline-none placeholder:text-faint focus:border-ink"
            />
          </label>
        </div>
      </div>
      <p className="text-sm text-muted">The title shows in the gallery. Nothing is written on the poster itself.</p>

      {error && <p className="text-sm text-accent">{error}</p>}

      <button type="submit" disabled={!hydrated || starting} className={buttonClass("primary", "mt-auto")}>
        {starting ? "Starting…" : "Generate poster"}
      </button>
    </form>
  );
}
