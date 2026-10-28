/* eslint-disable @next/next/no-img-element -- signed Supabase URLs and /api/images redirects */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { BackHeader } from "@/components/AppHeader";
import { buttonClass } from "@/components/buttonClass";
import { useFrame } from "@/components/useFrame";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import { estimateProgress, type Stage } from "@/lib/generate/progress";

const POLL_MS = 2000;

// The panel's six inks, as drawn in the app.
const INKS = ["#000000", "#ffffff", "#c8102e", "#f2c300", "#1f4e9e", "#2e7d32"];

type Generation =
  | { status: "pending" | "running"; stage: Stage }
  | { status: "succeeded"; imageUrl: string }
  | { status: "failed"; error: string };

interface Props {
  generationId: string;
  drawingId: string;
  title: string;
  styleName: string;
  artistName: string;
}

// Steps 2 and 3 of 3: the poster being made, then the poster.
export function ResultView(props: Props) {
  const { generationId } = props;
  const [generation, setGeneration] = useState<Generation>({ status: "pending", stage: "queued" });

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
      else setGeneration({ status: body.status, stage: body.stage ?? "queued" });
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [generationId, finished]);

  if (generation.status === "succeeded") return <Poster {...props} imageUrl={generation.imageUrl} />;
  return <Generating {...props} generation={generation} />;
}

function Generating({
  drawingId,
  title,
  styleName,
  generation,
}: Props & { generation: Exclude<Generation, { status: "succeeded" }> }) {
  const failed = generation.status === "failed";
  const stage = failed ? null : generation.stage;
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (failed) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [failed]);
  const progress = stage ? estimateProgress(stage, now - startedAt) : 0;

  const steps: [string, "done" | "current" | "todo"][] = [
    ["Sketch sent", "done"],
    ["Painting the poster", stage === "fitting" ? "done" : "current"],
    ["Fitting it to the display's six inks", stage === "fitting" ? "current" : "todo"],
    ["Ready to review", "todo"],
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <BackHeader label="Step 2 of 3" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 px-5 pt-8 pb-5" aria-live="polite">
        <div className="flex flex-col gap-2">
          <h1 className="text-[44px] leading-[42px]">{failed ? "That didn’t work" : "Turning your sketch into a poster"}</h1>
          <p className="text-sm text-muted">{failed ? generation.error : `${title} · ${styleName}`}</p>
        </div>

        {/* The sketch, faded, with a scan line sweeping down it. */}
        <div className="relative mx-auto aspect-[3/4] w-60 overflow-hidden border border-line bg-white">
          <img src={`/api/images/sketch/${drawingId}`} alt="Your sketch" className={`size-full object-cover ${failed ? "" : "opacity-35"}`} />
          {!failed && (
            <div
              aria-hidden
              className="absolute inset-0 bg-sunken/70 motion-safe:animate-[reveal_2.4s_ease-in-out_infinite_alternate]"
              style={{ borderBottom: "3px solid var(--primary)" }}
            />
          )}
        </div>

        {!failed && (
          <>
            <div
              className="h-1 bg-line"
              role="progressbar"
              aria-label="Generating poster"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div className="h-1 bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
            <ol className="flex flex-col">
              {steps.map(([label, state]) => (
                <li
                  key={label}
                  aria-current={state === "current" ? "step" : undefined}
                  className={`flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-b-0 ${
                    state === "current" ? "font-medium" : state === "todo" ? "text-muted" : ""
                  }`}
                >
                  <span className="flex size-5 items-center justify-center" aria-hidden>
                    {state === "done" ? (
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="square">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    ) : (
                      <span className={`block size-2 ${state === "current" ? "bg-primary" : "border border-faint"}`} />
                    )}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="mt-auto flex flex-col gap-2">
          {failed ? (
            <>
              <TryAgain drawingId={drawingId} variant="primary" />
              <Link href={`/draw?from=${drawingId}`} className={buttonClass("quiet")}>
                Edit sketch
              </Link>
            </>
          ) : (
            <Link href="/draw" className={buttonClass("quiet")}>
              Cancel
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function Poster({ generationId, drawingId, title, styleName, artistName, imageUrl }: Props & { imageUrl: string }) {
  const router = useRouter();
  const { frame, send, sending, error } = useFrame(generationId);
  const [view, setView] = useState<"generated" | "eink">("generated");
  const [previewMissing, setPreviewMissing] = useState(false);

  useResetOnLeave(useCallback(() => setView("generated"), []));

  async function sendToDisplay() {
    if (await send()) router.push(`/result/${generationId}/sent`);
  }

  const onTheWay = frame?.poster === "waiting" || frame?.poster === "showing";
  const eink = view === "eink";

  return (
    <div className="flex min-h-dvh flex-col">
      <BackHeader href={`/draw/${drawingId}/poster`} back="Title" label="Step 3 of 3" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-5 pt-6 pb-5">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-4xl leading-[34px]">{title}</h1>
            <p className="text-sm text-muted">
              {styleName} · by {artistName}
            </p>
          </div>
          <div role="radiogroup" aria-label="Preview" className="flex shrink-0 border border-ink">
            {(
              [
                ["generated", "Generated"],
                ["eink", "On e-ink"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                onClick={() => setView(id)}
                className={`h-11 px-3 text-sm ${view === id ? "bg-ink text-white" : "bg-card text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-[270px] bg-card">
          {eink && previewMissing ? (
            <p className="flex size-full items-center justify-center p-6 text-center text-sm text-muted">Preview not ready</p>
          ) : (
            <img
              key={view}
              src={eink ? `/api/images/preview/${generationId}` : imageUrl}
              alt={eink ? `Poster made from ${artistName}'s drawing, as the e-ink display will show it` : `Retro poster made from ${artistName}'s drawing`}
              onError={() => eink && setPreviewMissing(true)}
              className="size-full object-cover"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {eink ? "Dithered to the six inks, as the display will show it." : "Full-colour image from the generator."}
          </span>
          <span className="flex shrink-0 gap-[3px]" role="img" aria-label="The display's six inks">
            {INKS.map((ink) => (
              <span key={ink} className="block size-3.5 border" style={{ background: ink, borderColor: ink === "#ffffff" ? "var(--faint)" : ink }} />
            ))}
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {error && <p className="text-sm text-accent">{error}</p>}
          {frame === null && <p className="text-sm text-muted">No display is set up yet.</p>}
          {onTheWay ? (
            <Link href={`/result/${generationId}/sent`} className={buttonClass("primary")}>
              {frame?.poster === "showing" ? "On the display now" : "On its way to the display"}
            </Link>
          ) : (
            <button type="button" onClick={sendToDisplay} disabled={!frame || sending} className={buttonClass("primary")}>
              {sending ? "Sending…" : "Send to display"}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <TryAgain drawingId={drawingId} variant="secondary" />
            <Link href={`/draw?from=${drawingId}`} className={buttonClass("secondary")}>
              Edit sketch
            </Link>
          </div>
          <Link href={`/gallery/${generationId}`} className="flex min-h-11 items-center justify-center text-sm text-primary underline underline-offset-2">
            Save to gallery without displaying
          </Link>
        </div>
      </main>
    </div>
  );
}

// Another version of the same drawing.
function TryAgain({ drawingId, variant }: { drawingId: string; variant: "primary" | "secondary" }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetOnLeave(
    useCallback(() => {
      setStarting(false);
      setError(null);
    }, []),
  );

  async function tryAgain() {
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
    <>
      <button type="button" onClick={tryAgain} disabled={starting} className={buttonClass(variant)}>
        {starting ? "Starting…" : "Try again"}
      </button>
      {error && <p className="col-span-2 text-sm text-accent">{error}</p>}
    </>
  );
}
