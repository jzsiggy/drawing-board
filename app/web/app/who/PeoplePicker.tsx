"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { buttonClass } from "@/components/buttonClass";
import { SignatureSvg } from "@/components/SignatureSvg";
import { useHydrated } from "@/components/useHydrated";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import type { StrokeDoc } from "@/lib/strokes";

export interface PickerPerson {
  id: string;
  name: string;
  signature: StrokeDoc;
  posters: number;
  createdHere: boolean;
}

export function PeoplePicker({ people, currentId }: { people: PickerPerson[]; currentId: string | null }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useResetOnLeave(
    useCallback(() => {
      setQuery("");
      setPicking(null);
      setError(null);
    }, []),
  );

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? people.filter((p) => p.name.toLocaleLowerCase().includes(q)) : people;
  }, [people, query]);

  async function pick(person: PickerPerson) {
    setPicking(person.id);
    setError(null);
    const res = await fetch(`/api/people/${person.id}/select`, { method: "POST" });
    if (!res.ok) {
      setPicking(null);
      setError((await res.json().catch(() => null))?.error ?? "Couldn't pick that person. Try again.");
      return;
    }
    router.push("/draw");
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {people.length > 0 && (
        <input
          id="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names"
          aria-label="Search names"
          disabled={!hydrated}
          autoComplete="off"
          className="h-11 border border-line bg-card px-3 text-base outline-none placeholder:text-muted focus:border-ink"
        />
      )}

      {error && <p className="text-sm text-accent">{error}</p>}
      {query && matches.length === 0 && (
        <p className="text-sm text-muted">No one called &ldquo;{query}&rdquo; yet.</p>
      )}

      {matches.length > 0 && (
        <ul className="flex flex-col bg-card" aria-label="People">
          {matches.map((p) => (
            <PersonRow key={p.id} person={p} current={p.id === currentId} busy={picking === p.id} onPick={pick} />
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <Link href="/who/new" className={buttonClass("primary")}>
          Add a person
        </Link>
        <p className="text-xs text-muted">Tap a name to start drawing as that person.</p>
      </div>
    </div>
  );
}

function PersonRow({
  person,
  current,
  busy,
  onPick,
}: {
  person: PickerPerson;
  current: boolean;
  busy: boolean;
  onPick: (p: PickerPerson) => void;
}) {
  const count = person.posters === 0 ? "No posters yet" : person.posters === 1 ? "1 poster" : `${person.posters} posters`;
  return (
    <li className={`flex items-stretch border-b border-line last:border-b-0 ${current ? "bg-sunken" : ""}`}>
      <button
        type="button"
        onClick={() => onPick(person)}
        disabled={busy}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left disabled:opacity-60"
      >
        <span
          className={`flex size-11 shrink-0 items-center justify-center text-sm font-medium ${
            current ? "bg-primary text-white" : "bg-sunken"
          }`}
          aria-hidden
        >
          {initials(person.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-lg leading-[21px]">{person.name}</span>
          <span className="text-sm leading-4 text-muted">{busy ? "One moment…" : current ? `${count} · drawing now` : count}</span>
        </span>
        <SignatureSvg signature={person.signature} label={`${person.name}'s signature`} className="h-8 w-20 shrink-0 text-ink" />
      </button>
      {person.createdHere && (
        <Link
          href={`/who/${person.id}/edit`}
          aria-label={`Edit ${person.name}`}
          className="flex w-12 shrink-0 items-center justify-center text-xs text-primary underline underline-offset-2"
        >
          Edit
        </Link>
      )}
    </li>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return letters.map((w) => [...w][0]?.toLocaleUpperCase() ?? "").join("") || "?";
}
