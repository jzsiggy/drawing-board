/* eslint-disable @next/next/no-img-element -- images come from /api/images redirects */
"use client";

import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { buttonClass } from "@/components/buttonClass";
import { clock, useFrame } from "@/components/useFrame";

// After "Send to display": what the display will show, and whether it has.
// The frame only checks in every 10 minutes, so most of the time this says
// when to expect it, then switches to "On the display" once the frame
// reports it's showing it.
export function SentView({ generationId, title, replaces }: { generationId: string; title: string; replaces: string }) {
  const { frame, send, sending, error } = useFrame(generationId);
  const poster = frame?.poster;

  let heading = "Sending to the display";
  let message = "";
  let status = "…";
  if (frame === null) {
    heading = "No display yet";
    message = "There's no display set up to send posters to.";
    status = "No display";
  } else if (poster === "showing") {
    heading = "On the display";
    message = `${title} is on the display now.`;
    status = "Showing";
  } else if (poster === "waiting") {
    heading = "On its way";
    status = "Waiting";
    message =
      frame?.late && frame.lastSeenAt
        ? `The display hasn't checked in since ${clock(frame.lastSeenAt)}. Is it switched on and in Wi-Fi range?`
        : `${title} shows up when the display next checks in${
            frame?.nextCheckAt ? `, by about ${clock(frame.nextCheckAt)}` : ""
          }. The screen flashes a few times while the inks settle; that is normal.`;
  } else if (poster === "not-sent" || poster === "replaced") {
    heading = poster === "replaced" ? "Not on the display any more" : "Not sent yet";
    message = poster === "replaced" ? "Something newer has been sent since." : "This poster hasn't been sent to the display.";
    status = poster === "replaced" ? "Replaced" : "Not sent";
  }

  return (
    <>
      <AppHeader tone="dark" />
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-xl flex-col gap-7 px-5 pt-10 pb-5" aria-live="polite">
        <div className="flex flex-col gap-2">
          <h1 className="text-[56px] leading-[52px]">{heading}</h1>
          <p className="min-h-[3lh] text-sm">{message}</p>
        </div>

        <figure className="flex flex-col items-center gap-2.5 self-center">
          <img
            src={`/api/images/preview/${generationId}`}
            alt={`${title}, as the e-ink display shows it`}
            className="aspect-[3/4] w-[210px] bg-white object-cover"
          />
          <figcaption className="text-xs text-line">{frame?.name ?? "The display"}</figcaption>
        </figure>

        <dl className="grid grid-cols-2 border-y border-white/20">
          <div className="flex flex-col gap-1 py-3">
            <dt className="microcaps">Status</dt>
            <dd className="text-lg leading-[21px]">{status}</dd>
          </div>
          <div className="flex flex-col gap-1 border-l border-white/20 py-3 pl-4">
            <dt className="microcaps">Replaces</dt>
            <dd className="truncate text-lg leading-[21px]">{replaces}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-2">
          {error && <p className="text-sm">{error}</p>}
          {(poster === "not-sent" || poster === "replaced") && (
            <button type="button" onClick={send} disabled={sending} className={buttonClass("inverse")}>
              {sending ? "Sending…" : "Send to display"}
            </button>
          )}
          <Link href="/draw" className={poster === "not-sent" || poster === "replaced" ? buttonClass("quiet", "text-white!") : buttonClass("inverse")}>
            Draw another
          </Link>
          <Link href="/gallery" className="flex min-h-11 items-center justify-center text-sm text-white underline underline-offset-2">
            Open gallery
          </Link>
        </div>
      </main>
    </>
  );
}
