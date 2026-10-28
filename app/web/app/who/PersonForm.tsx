"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { BackHeader } from "@/components/AppHeader";
import { buttonClass } from "@/components/buttonClass";
import { StrokeCanvas } from "@/components/canvas/StrokeCanvas";
import { useStrokeHistory } from "@/components/canvas/useStrokeHistory";
import { useHydrated } from "@/components/useHydrated";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import { SIGNATURE_ASPECT, type StrokeDoc } from "@/lib/strokes";

const SIGNATURE_INK = "#161514";
const SIGNATURE_SIZE = 0.012;

interface Props {
  // Present when editing an existing person.
  person?: { id: string; name: string; signature: StrokeDoc };
}

export function PersonForm({ person }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
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
    <div className="flex min-h-dvh flex-col">
      <BackHeader href="/who" back="People" label={person ? "Edit person" : "New person"} />
      <form onSubmit={save} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 pt-10 pb-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[44px] leading-[42px]">{person ? `Edit ${person.name}` : "Add your name and signature"}</h1>
          <p className="text-sm text-muted">Your signature is printed in the corner of each poster, like an artist&rsquo;s mark.</p>
        </header>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Name</span>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            disabled={!hydrated}
            autoComplete="name"
            placeholder="Whatever you like to be called"
            className="h-12 border border-ink bg-card px-3.5 text-lg outline-none placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-primary"
          />
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Signature</span>
            <div className="flex gap-3 text-sm text-primary">
              <button type="button" onClick={signature.undo} disabled={!signature.canUndo} className="min-h-11 px-1 underline disabled:text-faint">
                Undo
              </button>
              <button type="button" onClick={signature.clear} disabled={!signature.strokes.length} className="min-h-11 px-1 underline disabled:text-faint">
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
              canvasClassName="border border-line bg-white"
            />
            {/* The line to sign on, and the hint under it; under the strokes. */}
            <div className="pointer-events-none absolute right-6 bottom-11 left-6 border-t border-dashed border-faint" />
            <span className="pointer-events-none absolute bottom-4 left-6 text-xs text-muted">Sign above the line with your finger</span>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-sunken p-4">
          <span className="mt-[5px] block size-2 shrink-0 bg-accent" aria-hidden />
          <p className="text-sm">
            Signatures go bottom right on the poster, in black or white to stand out, sized to stay legible on the e-ink
            display.
          </p>
        </div>

        {error && <p className="text-sm text-accent">{error}</p>}

        <div className="mt-auto flex flex-col gap-2">
          <button type="submit" disabled={!ready || saving} className={buttonClass("primary")}>
            {saving ? "Saving…" : person ? "Save changes" : "Save person"}
          </button>
          <Link href="/who" className={buttonClass("quiet")}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
