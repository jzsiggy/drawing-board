"use client";

import { useCallback, useState } from "react";

import { buttonClass } from "@/components/buttonClass";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import { TITLE_MAX } from "@/lib/posters";

// Renames the drawing (and so every version of the poster). Shown in place of
// the title while editing.
export function TitleEditor({
  drawingId,
  title,
  onSaved,
  onCancel,
}: {
  drawingId: string;
  title: string | null;
  onSaved: (title: string | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(title ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetOnLeave(useCallback(() => onCancel(), [onCancel]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/drawings/${drawingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setSaving(false);
      setError(body?.error ?? "Couldn't save the title. Try again.");
      return;
    }
    onSaved(body.title);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Poster title</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={TITLE_MAX}
          disabled={saving}
          placeholder="Untitled"
          autoComplete="off"
          autoFocus
          className="h-11 border border-line bg-card px-3 text-lg outline-none placeholder:text-faint focus:border-ink"
        />
      </label>
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" disabled={saving} className={buttonClass("secondary")}>
          {saving ? "Saving…" : "Save title"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className={buttonClass("quiet")}>
          Cancel
        </button>
      </div>
    </form>
  );
}
