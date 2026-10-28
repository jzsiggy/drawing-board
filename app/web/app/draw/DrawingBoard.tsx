"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { buttonClass } from "@/components/buttonClass";
import { StrokeCanvas } from "@/components/canvas/StrokeCanvas";
import { strokesToPng } from "@/components/canvas/strokesToPng";
import { useStrokeHistory } from "@/components/canvas/useStrokeHistory";
import { SignatureSvg } from "@/components/SignatureSvg";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import { DRAWING_ASPECT, type Stroke, type StrokeDoc } from "@/lib/strokes";

// The panel's six inks.
const INKS = [
  { name: "Black", value: "#000000" },
  { name: "White", value: "#ffffff" },
  { name: "Red", value: "#c8102e" },
  { name: "Yellow", value: "#f2c300" },
  { name: "Blue", value: "#1f4e9e" },
  { name: "Green", value: "#2e7d32" },
];

// Brush widths as fractions of the canvas width.
const TOOLS = {
  pen: { name: "Fine pen", size: 0.01, icon: "M4 20l4-1 11-11-3-3L5 16l-1 4z" },
  marker: { name: "Thick marker", size: 0.03, icon: "M6 18l-2 2M8 16l-3-3 9-9 6 6-9 9zM12 6l6 6" },
  eraser: { name: "Eraser", size: 0.04, icon: "M7 20h13M4 15l9-9 6 6-7 7H8z" },
};
type Tool = keyof typeof TOOLS;

// Same size as the panel, so the sketch needs no scaling later.
const SKETCH_WIDTH = 1200;
const SKETCH_HEIGHT = 1600;

type Status = { kind: "drawing" } | { kind: "confirm-clear" } | { kind: "saving" } | { kind: "error"; message: string };

interface Props {
  personName: string;
  personSignature: StrokeDoc;
  // "Edit sketch" from a poster: start from that drawing's strokes, and
  // record it as the new drawing's parent.
  initialStrokes?: Stroke[];
  parentId?: string;
}

export default function DrawingBoard({ personName, personSignature, initialStrokes, parentId }: Props) {
  const router = useRouter();
  const [startingStrokes] = useState(() => initialStrokes ?? []);
  const history = useStrokeHistory(startingStrokes);
  const [ink, setInk] = useState(INKS[0].value);
  const [tool, setTool] = useState<Tool>("pen");
  // The brush to go back to when an ink is picked while erasing.
  const [brush, setBrush] = useState<Exclude<Tool, "eraser">>("pen");
  const [status, setStatus] = useState<Status>({ kind: "drawing" });

  // A fresh canvas every time you come back.
  const { reset } = history;
  useResetOnLeave(
    useCallback(() => {
      reset(startingStrokes);
      setInk(INKS[0].value);
      setTool("pen");
      setBrush("pen");
      setStatus({ kind: "drawing" });
    }, [reset, startingStrokes]),
  );

  function pickTool(next: Tool) {
    setTool(next);
    if (next !== "eraser") setBrush(next);
  }

  // Saves the drawing, then asks for a title on the next step.
  async function makePoster() {
    setStatus({ kind: "saving" });
    try {
      const doc: StrokeDoc = { version: 1, aspect: DRAWING_ASPECT, strokes: history.strokes };
      const form = new FormData();
      form.set("strokes", JSON.stringify(doc));
      form.set("sketch", await strokesToPng(history.strokes, SKETCH_WIDTH, SKETCH_HEIGHT), "sketch.png");
      if (parentId) form.set("parent_drawing_id", parentId);
      const saved = await fetch("/api/drawings", { method: "POST", body: form });
      if (!saved.ok) throw new Error((await saved.json().catch(() => null))?.error ?? "Couldn't save your drawing.");
      const { id } = await saved.json();
      router.push(`/draw/${id}/poster`);
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "Couldn't save your drawing." });
    }
  }

  const empty = history.strokes.length === 0;
  const busy = status.kind === "saving";
  const firstName = personName.trim().split(/\s+/)[0];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-paper select-none">
      <AppHeader />

      <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-5">
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
          <span className="truncate">
            Drawing as <strong className="font-medium text-ink">{firstName}</strong>
          </span>
          <SignatureSvg signature={personSignature} label={`${personName}'s signature`} className="h-[22px] w-14 shrink-0 text-ink" />
        </span>
        <Link href="/who" className="flex min-h-11 items-center text-sm text-primary underline underline-offset-2">
          Change
        </Link>
      </div>

      <StrokeCanvas
        aspect={DRAWING_ASPECT}
        strokes={history.strokes}
        tool={tool === "eraser" ? "eraser" : "pen"}
        color={ink}
        size={TOOLS[tool].size}
        onStroke={history.add}
        label="Drawing canvas"
        fit="contain"
        className="min-h-0 flex-1 px-5 pt-1 pb-3"
        canvasClassName="border border-line bg-white"
        overlay={<span className="absolute right-2 bottom-2 text-xs text-muted">3:4 · same shape as the display</span>}
      />

      <div role="radiogroup" aria-label="Ink colour" className="flex shrink-0 justify-center gap-1.5 px-5">
        {INKS.map((c) => {
          const selected = tool !== "eraser" && ink === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.name}
              onClick={() => {
                setInk(c.value);
                if (tool === "eraser") setTool(brush);
              }}
              className="flex size-11 items-center justify-center"
            >
              <span
                className={`block size-8 border ${selected ? "outline-2 outline-offset-[3px] outline-ink" : ""}`}
                style={{ background: c.value, borderColor: c.value === "#ffffff" ? "var(--faint)" : c.value }}
              />
            </button>
          );
        })}
      </div>

      {status.kind === "confirm-clear" ? (
        <div className="flex h-[52px] shrink-0 items-center justify-between gap-2 px-5">
          <span className="text-sm">Clear the canvas?</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStatus({ kind: "drawing" })} className={buttonClass("secondary", "min-h-11 px-4 text-sm")}>
              Keep drawing
            </button>
            <button
              type="button"
              onClick={() => {
                history.clear();
                setStatus({ kind: "drawing" });
              }}
              className="min-h-11 bg-accent px-4 text-sm font-medium text-white"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div role="toolbar" aria-label="Drawing tools" className="flex shrink-0 items-center justify-between px-5 pt-1 pb-2">
          <div className="flex gap-1">
            {(Object.keys(TOOLS) as Tool[]).map((t) => (
              <IconButton key={t} label={TOOLS[t].name} pressed={tool === t} onClick={() => pickTool(t)}>
                <path d={TOOLS[t].icon} />
              </IconButton>
            ))}
          </div>
          <div className="flex gap-1">
            <IconButton label="Undo" onClick={history.undo} disabled={!history.canUndo || busy}>
              <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
            </IconButton>
            <IconButton label="Redo" onClick={history.redo} disabled={!history.canRedo || busy}>
              <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />
            </IconButton>
            <IconButton label="Clear canvas" onClick={() => setStatus({ kind: "confirm-clear" })} disabled={empty || busy}>
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
            </IconButton>
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-2 px-5 pb-3">
        <button type="button" onClick={makePoster} disabled={empty || busy} className={buttonClass("primary")}>
          {busy ? "Saving…" : "Make it a poster"}
        </button>
        {status.kind === "error" && <p className="text-sm text-accent">{status.message}</p>}
      </div>

      <BottomNav />
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
      className={`flex size-11 shrink-0 items-center justify-center disabled:text-faint ${
        pressed ? "bg-primary text-white" : "text-ink"
      }`}
      {...props}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
