"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useResetOnLeave } from "./useResetOnLeave";

// "Keep drawing" and "Make another version" for a drawing.
export function VersionActions({ drawingId }: { drawingId: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetOnLeave(
    useCallback(() => {
      setStarting(false);
      setError(null);
    }, []),
  );

  async function anotherVersion() {
    setStarting(true);
    setError(null);
    const res = await fetch(`/api/drawings/${drawingId}/generations`, { method: "POST" });
    if (!res.ok) {
      setStarting(false);
      setError((await res.json().catch(() => null))?.error ?? "Couldn't start a new version. Try again.");
      return;
    }
    router.push(`/result/${(await res.json()).id}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/draw?from=${drawingId}`}
          className="flex h-12 items-center justify-center rounded-full border border-ink font-medium"
        >
          Keep drawing
        </Link>
        <button
          type="button"
          onClick={anotherVersion}
          disabled={starting}
          className="h-12 rounded-full border border-ink font-medium disabled:border-line disabled:text-muted"
        >
          {starting ? "Starting…" : "Another version"}
        </button>
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
