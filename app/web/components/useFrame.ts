"use client";

import { useCallback, useEffect, useState } from "react";

import type { FrameStatus } from "@/lib/frames/status";
import { useResetOnLeave } from "./useResetOnLeave";

// The frame checks in every few minutes; there's no need to ask more often.
const POLL_MS = 5000;

// The display (the first frame) and where this poster stands on it, kept up
// to date while it's on its way. `frame` is undefined while loading and null
// with no frame set up.
export function useFrame(generationId: string) {
  const [frame, setFrame] = useState<FrameStatus | null | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useResetOnLeave(
    useCallback(() => {
      setSending(false);
      setError(null);
    }, []),
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards?generation=${generationId}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setFrame((await res.json()).frames[0] ?? null);
  }, [generationId]);

  // Keep asking while the frame hasn't picked the poster up yet; refresh the
  // "checks in by" wording now and then either way.
  const waiting = frame?.poster === "waiting";
  useEffect(() => {
    let stopped = false;
    const refresh = () => !stopped && load();
    refresh();
    const timer = setInterval(waiting ? refresh : () => setTick((t) => t + 1), waiting ? POLL_MS : 30_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [load, waiting]);

  const send = useCallback(async () => {
    if (!frame) return false;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/boards/${frame.id}/display`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId }),
    });
    setSending(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Couldn't send it to the display. Try again.");
      return false;
    }
    setFrame((await res.json()).frames[0] ?? null);
    return true;
  }, [frame, generationId]);

  return { frame, send, sending, error };
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
