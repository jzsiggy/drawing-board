"use client";

import { useCallback, useEffect, useState } from "react";

import { useResetOnLeave } from "@/components/useResetOnLeave";
import type { FrameStatus } from "@/lib/frames/status";

// The frame checks in every few minutes; there's no need to ask more often.
const POLL_MS = 5000;

export function FramePanel({ generationId }: { generationId: string }) {
  const [frames, setFrames] = useState<FrameStatus[] | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useResetOnLeave(
    useCallback(() => {
      setSending(null);
      setError(null);
    }, []),
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards?generation=${generationId}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setFrames((await res.json()).frames);
  }, [generationId]);

  // Keep asking while a frame hasn't picked the poster up yet; refresh the
  // "3 min ago" wording now and then either way.
  const waiting = frames?.some((f) => f.poster === "waiting") ?? false;
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

  async function send(frame: FrameStatus) {
    setSending(frame.id);
    setError(null);
    const res = await fetch(`/api/boards/${frame.id}/display`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId }),
    });
    setSending(null);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Couldn't send it to the frame. Try again.");
      return;
    }
    setFrames((await res.json()).frames);
  }

  if (frames === null) return <div className="h-24 animate-pulse rounded-xl bg-line/50" aria-hidden />;
  if (frames.length === 0) return <p className="text-sm text-muted">No frame is set up yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {frames.map((frame) => (
        <FrameCard
          key={frame.id}
          frame={frame}
          label={frames.length > 1 ? `Send to ${frame.name}` : "Send to frame"}
          busy={sending === frame.id}
          onSend={() => send(frame)}
        />
      ))}
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

function FrameCard({ frame, label, busy, onSend }: { frame: FrameStatus; label: string; busy: boolean; onSend: () => void }) {
  const details = [
    frame.batteryPercent !== null ? `Battery ${frame.batteryPercent}%` : null,
    frame.lastSeenAt ? `checked in ${relative(frame.lastSeenAt)}` : "hasn't checked in yet",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs tracking-widest uppercase">{frame.name}</h2>
        <span className="text-right text-xs text-muted">{details}</span>
      </div>

      {frame.poster === "showing" && (
        <p className="flex items-center gap-2 font-medium">
          <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-card" aria-hidden>
            ✓
          </span>
          On the frame now
        </p>
      )}

      {frame.poster === "waiting" &&
        (frame.late && frame.lastSeenAt ? (
          <p className="text-sm">
            Sent. The frame hasn&rsquo;t checked in since {clock(frame.lastSeenAt)}; is it switched on and in Wi-Fi range?
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm">
            <span className="size-2 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden />
            {frame.nextCheckAt
              ? `Sent. It shows up when the frame checks in, by about ${clock(frame.nextCheckAt)}.`
              : "Sent. It shows up when the frame next checks in."}
          </p>
        ))}

      {(frame.poster === "not-sent" || frame.poster === "replaced") && (
        <>
          {frame.poster === "replaced" && (
            <p className="text-sm text-muted">This was on the frame earlier; something newer is there now.</p>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={busy}
            className="h-12 rounded-full bg-ink font-medium text-card disabled:bg-line disabled:text-muted"
          >
            {busy ? "Sending…" : label}
          </button>
        </>
      )}
    </section>
  );
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (minutes < 60) return format.format(-minutes, "minute");
  if (minutes < 48 * 60) return format.format(-Math.round(minutes / 60), "hour");
  return format.format(-Math.round(minutes / 1440), "day");
}
