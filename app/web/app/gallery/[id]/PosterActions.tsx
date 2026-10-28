"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { buttonClass } from "@/components/buttonClass";
import { useFrame } from "@/components/useFrame";
import { useResetOnLeave } from "@/components/useResetOnLeave";

// "Show on display", plus another version of the drawing or editing its sketch.
export function PosterActions({ generationId, drawingId }: { generationId: string; drawingId: string }) {
  const router = useRouter();
  const { frame, send, sending, error } = useFrame(generationId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useResetOnLeave(
    useCallback(() => {
      setStarting(false);
      setStartError(null);
    }, []),
  );

  async function show() {
    if (await send()) router.push(`/result/${generationId}/sent`);
  }

  async function anotherVersion() {
    setStarting(true);
    setStartError(null);
    const res = await fetch(`/api/drawings/${drawingId}/generations`, { method: "POST" });
    if (!res.ok) {
      setStarting(false);
      setStartError((await res.json().catch(() => null))?.error ?? "Couldn't start a new version. Try again.");
      return;
    }
    router.push(`/result/${(await res.json()).id}`);
  }

  const onTheWay = frame?.poster === "waiting" || frame?.poster === "showing";

  return (
    <div className="mt-auto flex flex-col gap-2">
      {(error || startError) && <p className="text-sm text-accent">{error ?? startError}</p>}
      {frame === null && <p className="text-sm text-muted">No display is set up yet.</p>}
      {onTheWay ? (
        <Link href={`/result/${generationId}/sent`} className={buttonClass("primary")}>
          {frame?.poster === "showing" ? "On the display now" : "On its way to the display"}
        </Link>
      ) : (
        <button type="button" onClick={show} disabled={!frame || sending} className={buttonClass("primary")}>
          {sending ? "Sending…" : "Show on display"}
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={anotherVersion} disabled={starting} className={buttonClass("secondary")}>
          {starting ? "Starting…" : "Another version"}
        </button>
        <Link href={`/draw?from=${drawingId}`} className={buttonClass("secondary")}>
          Edit sketch
        </Link>
      </div>
    </div>
  );
}
