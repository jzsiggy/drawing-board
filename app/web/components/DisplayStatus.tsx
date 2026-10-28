"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { FrameStatus } from "@/lib/frames/status";

// Asking more often than the frame checks in would tell us nothing new.
const REFRESH_MS = 60_000;

// "Display online · 72%" (battery) while the frame keeps its check-in
// schedule. Links to the poster it's showing.
export function DisplayStatus({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [frame, setFrame] = useState<FrameStatus | null | undefined>(undefined);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const res = await fetch("/api/boards", { cache: "no-store" }).catch(() => null);
      if (!stopped && res?.ok) setFrame((await res.json()).frames[0] ?? null);
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  // Keeps the header's height while loading, and with no frame set up.
  if (!frame) return <span className="min-h-11" aria-hidden />;

  const online = Boolean(frame.lastSeenAt) && !frame.late;
  const battery = frame.batteryPercent !== null ? ` · ${frame.batteryPercent}%` : "";
  const text = online
    ? `Display online${battery}`
    : frame.lastSeenAt
      ? `Display offline · ${ago(frame.lastSeenAt)}`
      : "Display not seen yet";
  const content = (
    <>
      <span className={`block size-2 shrink-0 ${online ? "bg-online" : "bg-faint"}`} aria-hidden />
      {text}
    </>
  );
  const className = `flex min-h-11 items-center gap-2 text-sm no-underline ${tone === "dark" ? "text-white" : "text-ink"}`;

  return frame.showingGenerationId ? (
    <Link href={`/gallery/${frame.showingGenerationId}`} className={className}>
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}
