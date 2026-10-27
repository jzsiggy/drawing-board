/* eslint-disable @next/next/no-img-element -- signed Supabase URLs, shown as-is */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useResetOnLeave } from "@/components/useResetOnLeave";
import { FramePanel } from "@/components/FramePanel";

const POLL_MS = 2000;

type Generation =
  | { status: "pending" | "running" }
  | { status: "succeeded"; imageUrl: string }
  | { status: "failed"; error: string };

interface Props {
  generationId: string;
  drawingId: string;
  sketchUrl: string;
  artistName: string;
}

export function ResultView({ generationId, drawingId, sketchUrl, artistName }: Props) {
  const router = useRouter();
  const [generation, setGeneration] = useState<Generation>({ status: "pending" });
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useResetOnLeave(
    useCallback(() => {
      setRetrying(false);
      setRetryError(null);
    }, []),
  );

  // Poll until the poster is done or has failed.
  const finished = generation.status === "succeeded" || generation.status === "failed";
  useEffect(() => {
    if (finished) return;
    let stopped = false;
    const poll = async () => {
      const res = await fetch(`/api/generations/${generationId}`, { cache: "no-store" }).catch(() => null);
      if (stopped || !res?.ok) return;
      const body = await res.json();
      if (body.status === "succeeded") setGeneration({ status: "succeeded", imageUrl: body.imageUrl });
      else if (body.status === "failed") setGeneration({ status: "failed", error: body.error ?? "Something went wrong." });
      else setGeneration({ status: body.status });
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [generationId, finished]);

  async function tryAgain() {
    setRetrying(true);
    setRetryError(null);
    const res = await fetch(`/api/drawings/${drawingId}/generations`, { method: "POST" });
    if (!res.ok) {
      setRetrying(false);
      setRetryError((await res.json().catch(() => null))?.error ?? "Couldn't start a new version. Try again.");
      return;
    }
    const { id } = await res.json();
    router.push(`/result/${id}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between text-sm">
        <Link href="/draw" className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink">
          ← New drawing
        </Link>
        <Link href={`/gallery/${drawingId}`} className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink">
          Gallery
        </Link>
      </header>

      {generation.status === "succeeded" ? (
        <img
          src={generation.imageUrl}
          alt={`Retro poster made from ${artistName}'s drawing`}
          className="aspect-[3/4] w-full rounded-md bg-card object-cover shadow-[0_2px_12px_rgb(0_0_0/0.18)]"
        />
      ) : (
        <Printing sketchUrl={sketchUrl} failed={generation.status === "failed"} />
      )}

      <section className="flex flex-col gap-3" aria-live="polite">
        <p className="-mb-2 text-sm text-muted">by {artistName}</p>
        {generation.status === "succeeded" && (
          <h1 className="font-display text-3xl font-bold tracking-tight">Your poster</h1>
        )}
        {generation.status === "failed" && (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight">That didn&rsquo;t work</h1>
            <p className="text-muted">{generation.error}</p>
          </>
        )}
        {!finished && (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight">Printing your poster…</h1>
            <p className="text-muted">This usually takes under a minute. You can keep this page open.</p>
          </>
        )}
        {retryError && <p className="text-sm text-accent">{retryError}</p>}
      </section>

      {generation.status === "succeeded" && <FramePanel generationId={generationId} />}

      {finished && (
        <div className="mt-auto grid grid-cols-2 gap-3">
          <Link
            href={`/draw?from=${drawingId}`}
            className="flex h-12 items-center justify-center rounded-full border border-ink font-medium"
          >
            Keep drawing
          </Link>
          <button
            type="button"
            onClick={tryAgain}
            disabled={retrying}
            className={`h-12 rounded-full font-medium disabled:bg-line disabled:text-muted ${
              generation.status === "succeeded" ? "border border-ink" : "bg-ink text-card"
            }`}
          >
            {retrying ? "Starting…" : "Try again"}
          </button>
        </div>
      )}
    </main>
  );
}

// The sketch under a band of the panel's inks (white would vanish) sweeping
// down, like a print run.
function Printing({ sketchUrl, failed }: { sketchUrl: string; failed: boolean }) {
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)]">
      <img src={sketchUrl} alt="Your drawing" className={`size-full object-cover ${failed ? "" : "opacity-60"}`} />
      {!failed && (
        <div
          aria-hidden
          className="absolute inset-x-0 h-3 motion-safe:animate-[print_2.4s_ease-in-out_infinite] motion-reduce:top-1/2"
          style={{
            background:
              "linear-gradient(90deg, #1b1e20 0 20%, #c4302b 20% 40%, #f2c230 40% 60%, #2a5bb8 60% 80%, #2f8a4a 80%)",
          }}
        />
      )}
    </div>
  );
}
