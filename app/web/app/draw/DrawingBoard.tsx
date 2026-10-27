"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { StrokeCanvas } from "@/components/canvas/StrokeCanvas";
import { strokesToPng } from "@/components/canvas/strokesToPng";
import { useStrokeHistory } from "@/components/canvas/useStrokeHistory";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import { DRAWING_ASPECT, type Stroke, type StrokeDoc } from "@/lib/strokes";

// The panel's six inks plus orange and pink.
const COLORS = [
  { name: "Black", value: "#1b1e20" },
  { name: "White", value: "#ffffff" },
  { name: "Red", value: "#c4302b" },
  { name: "Orange", value: "#e8742a" },
  { name: "Yellow", value: "#f2c230" },
  { name: "Green", value: "#2f8a4a" },
  { name: "Blue", value: "#2a5bb8" },
  { name: "Pink", value: "#e46a9c" },
];

// Brush widths as fractions of the canvas width.
const SIZES = [
  { name: "Thin", value: 0.008 },
  { name: "Medium", value: 0.018 },
  { name: "Thick", value: 0.04 },
];

// Same size as the panel, so the sketch needs no scaling later.
const SKETCH_WIDTH = 1200;
const SKETCH_HEIGHT = 1600;

type Status = { kind: "drawing" } | { kind: "confirm-restart" } | { kind: "saving" } | { kind: "error"; message: string };

interface Props {
  personName: string;
  // "Keep drawing" from a poster: start from that drawing's strokes, and
  // record it as the new drawing's parent.
  initialStrokes?: Stroke[];
  parentId?: string;
}

export default function DrawingBoard({ personName, initialStrokes, parentId }: Props) {
  const router = useRouter();
  const [startingStrokes] = useState(() => initialStrokes ?? []);
  const history = useStrokeHistory(startingStrokes);
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(SIZES[1].value);
  const [tool, setTool] = useState<Stroke["tool"]>("pen");
  const [status, setStatus] = useState<Status>({ kind: "drawing" });

  // A fresh canvas every time you come back.
  const { reset } = history;
  useResetOnLeave(
    useCallback(() => {
      reset(startingStrokes);
      setColor(COLORS[0].value);
      setSize(SIZES[1].value);
      setTool("pen");
      setStatus({ kind: "drawing" });
    }, [reset, startingStrokes]),
  );

  async function submit() {
    setStatus({ kind: "saving" });
    try {
      const doc: StrokeDoc = { version: 1, aspect: DRAWING_ASPECT, strokes: history.strokes };
      const form = new FormData();
      form.set("strokes", JSON.stringify(doc));
      form.set("sketch", await strokesToPng(history.strokes, SKETCH_WIDTH, SKETCH_HEIGHT), "sketch.png");
      if (parentId) form.set("parent_drawing_id", parentId);
      const saved = await fetch("/api/drawings", { method: "POST", body: form });
      if (!saved.ok) throw new Error((await saved.json().catch(() => null))?.error ?? "Couldn't save your drawing.");
      const { id: drawingId } = await saved.json();

      const started = await fetch(`/api/drawings/${drawingId}/generations`, { method: "POST" });
      if (!started.ok) throw new Error((await started.json().catch(() => null))?.error ?? "Couldn't start your poster.");
      const { id: generationId } = await started.json();
      router.push(`/result/${generationId}`);
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "Couldn't save your drawing." });
    }
  }

  const empty = history.strokes.length === 0;
  const busy = status.kind === "saving";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-paper select-none">
      <header className="flex items-center justify-between px-4 pt-3 pb-2 text-sm">
        <span className="truncate">
          Drawing as <strong className="font-semibold">{personName}</strong>
        </span>
        <nav className="flex shrink-0 gap-4 font-mono text-xs tracking-widest text-muted uppercase">
          <Link href="/gallery" className="hover:text-ink">
            Gallery
          </Link>
          <Link href="/who" className="hover:text-ink">
            Switch
          </Link>
        </nav>
      </header>

      <StrokeCanvas
        aspect={DRAWING_ASPECT}
        strokes={history.strokes}
        tool={tool}
        color={color}
        size={size}
        onStroke={history.add}
        label="Drawing canvas"
        fit="contain"
        className="min-h-0 flex-1 px-4"
        canvasClassName="rounded-md bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
      />

      <footer className="flex flex-col gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 justify-between" role="radiogroup" aria-label="Colour">
            {COLORS.map((c) => {
              const selected = tool === "pen" && color === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={c.name}
                  onClick={() => {
                    setColor(c.value);
                    setTool("pen");
                  }}
                  className={`size-7 rounded-full border transition ${selected ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : ""}`}
                  style={{ background: c.value, borderColor: c.value === "#ffffff" ? "var(--line)" : c.value }}
                />
              );
            })}
          </div>
          <IconButton
            label="Eraser"
            pressed={tool === "eraser"}
            onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
          >
            <path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21" />
            <path d="M22 21H7M5 11l9 9" />
          </IconButton>
        </div>

        {status.kind === "confirm-restart" ? (
          <div className="flex h-11 items-center justify-between gap-2">
            <span className="text-sm">Start over?</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStatus({ kind: "drawing" })} className="h-10 rounded-full border border-line px-4 text-sm">
                Keep drawing
              </button>
              <button
                type="button"
                onClick={() => {
                  history.clear();
                  setStatus({ kind: "drawing" });
                }}
                className="h-10 rounded-full bg-accent px-4 text-sm font-medium text-card"
              >
                Start over
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-11 items-center gap-1">
            <div className="flex items-center" role="radiogroup" aria-label="Brush size">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={size === s.value}
                  aria-label={s.name}
                  onClick={() => setSize(s.value)}
                  className={`flex size-9 items-center justify-center rounded-full ${size === s.value ? "bg-card ring-1 ring-ink" : ""}`}
                >
                  <span className="rounded-full bg-ink" style={{ width: 4 + s.value * 400, height: 4 + s.value * 400 }} />
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center justify-center">
              <IconButton label="Undo" onClick={history.undo} disabled={!history.canUndo || busy}>
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h11a5 5 0 0 1 0 10h-4" />
              </IconButton>
              <IconButton label="Redo" onClick={history.redo} disabled={!history.canRedo || busy}>
                <path d="m15 14 5-5-5-5" />
                <path d="M20 9H9a5 5 0 0 0 0 10h4" />
              </IconButton>
              <IconButton label="Start over" onClick={() => setStatus({ kind: "confirm-restart" })} disabled={empty || busy}>
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </IconButton>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={empty || busy}
              className="h-11 shrink-0 rounded-full bg-ink px-5 font-medium text-card transition disabled:bg-line disabled:text-muted"
            >
              {busy ? "Sending…" : "Submit"}
            </button>
          </div>
        )}
        {status.kind === "error" && <p className="text-sm text-accent">{status.message}</p>}
      </footer>

    </div>
  );
}

function IconButton({
  label,
  pressed,
  children,
  ...props
}: { label: string; pressed?: boolean } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full transition disabled:text-line ${
        pressed ? "bg-ink text-card" : ""
      }`}
      {...props}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
