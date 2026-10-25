"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { StrokeCanvas } from "@/components/canvas/StrokeCanvas";
import { useStrokeHistory } from "@/components/canvas/useStrokeHistory";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import { SIGNATURE_ASPECT, type StrokeDoc } from "@/lib/strokes";

const SIGNATURE_INK = "#1b1e20";
const SIGNATURE_SIZE = 0.012;

interface Props {
  // Present when editing an existing person.
  person?: { id: string; name: string; signature: StrokeDoc };
}

export function PersonForm({ person }: Props) {
  const router = useRouter();
  const [initial] = useState(() => ({ name: person?.name ?? "", strokes: person?.signature.strokes ?? [] }));
  const [name, setName] = useState(initial.name);
  const signature = useStrokeHistory(initial.strokes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The form as new (or as saved, when editing) every time you come back.
  const { reset } = signature;
  useResetOnLeave(
    useCallback(() => {
      setName(initial.name);
      reset(initial.strokes);
      setSaving(false);
      setError(null);
    }, [initial, reset]),
  );

  const ready = name.trim().length > 0 && signature.strokes.length > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError(null);
    const doc: StrokeDoc = { version: 1, aspect: SIGNATURE_ASPECT, strokes: signature.strokes };
    const res = await fetch(person ? `/api/people/${person.id}` : "/api/people", {
      method: person ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), signature: doc }),
    });
    if (!res.ok) {
      setSaving(false);
      setError((await res.json().catch(() => null))?.error ?? "Couldn't save. Try again.");
      return;
    }
    router.push(person ? "/who" : "/draw");
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-2">
        <Link href="/who" className="font-mono text-xs tracking-widest text-muted uppercase hover:text-ink">
          ← Back
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {person ? `Edit ${person.name}` : "Add yourself"}
        </h1>
        <p className="text-muted">Your signature goes in the corner of every poster you make.</p>
      </header>

      <form onSubmit={save} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-xs tracking-widest text-muted uppercase">Your name</span>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            placeholder="Whatever you like to be called"
            className="h-12 rounded-lg border border-line bg-card px-4 text-lg outline-none placeholder:text-muted focus:border-ink"
          />
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs tracking-widest text-muted uppercase">Sign here</span>
            <div className="flex gap-4 font-mono text-xs tracking-widest uppercase">
              <button type="button" onClick={signature.undo} disabled={!signature.canUndo} className="disabled:text-line">
                Undo
              </button>
              <button type="button" onClick={signature.clear} disabled={!signature.strokes.length} className="disabled:text-line">
                Clear
              </button>
            </div>
          </div>
          <div className="relative">
            <StrokeCanvas
              aspect={SIGNATURE_ASPECT}
              strokes={signature.strokes}
              tool="pen"
              color={SIGNATURE_INK}
              size={SIGNATURE_SIZE}
              onStroke={signature.add}
              label="Signature pad"
              canvasClassName="rounded-lg border border-line bg-white"
            />
            {/* Baseline to sign on; purely visual, under the strokes. */}
            <div className="pointer-events-none absolute right-[8%] bottom-[24%] left-[8%] border-b border-dashed border-line" />
          </div>
        </div>

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={!ready || saving}
          className="h-12 rounded-full bg-ink font-medium text-card transition disabled:bg-line disabled:text-muted"
        >
          {saving ? "Saving…" : person ? "Save changes" : "Start drawing"}
        </button>
      </form>
    </main>
  );
}
