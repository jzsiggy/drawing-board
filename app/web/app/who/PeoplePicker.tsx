"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { SignatureSvg } from "@/components/SignatureSvg";
import { useHydrated } from "@/components/useHydrated";
import { useResetOnLeave } from "@/components/useResetOnLeave";
import type { StrokeDoc } from "@/lib/strokes";

export interface PickerPerson {
  id: string;
  name: string;
  signature: StrokeDoc;
  createdHere: boolean;
  usedHere: boolean;
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
  const here = matches.filter((p) => p.usedHere);
  const everyone = matches.filter((p) => !p.usedHere);

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
    <div className="flex flex-col gap-6">
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
          className="h-12 rounded-full border border-line bg-card px-5 text-base outline-none placeholder:text-muted focus:border-ink"
        />
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/who/new"
          className="flex aspect-[5/3] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-muted text-muted transition hover:border-ink hover:text-ink"
        >
          <span className="font-display text-3xl leading-none">+</span>
          <span className="font-mono text-xs tracking-widest uppercase">Add yourself</span>
        </Link>
        {here.length === 0 &&
          everyone.length === 0 &&
          (query ? (
            <p className="col-span-2 py-6 text-center text-muted">No one called &ldquo;{query}&rdquo; yet.</p>
          ) : null)}
      </div>

      {here.length > 0 && (
        <Section title="On this phone">
          {here.map((p) => (
            <PersonCard key={p.id} person={p} current={p.id === currentId} busy={picking === p.id} onPick={pick} />
          ))}
        </Section>
      )}
      {everyone.length > 0 && (
        <Section title={here.length > 0 ? "Everyone else" : "Everyone"}>
          {everyone.map((p) => (
            <PersonCard key={p.id} person={p} current={p.id === currentId} busy={picking === p.id} onPick={pick} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-xs tracking-widest text-muted uppercase">{title}</h2>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function PersonCard({
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
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onPick(person)}
        disabled={busy}
        className={`flex w-full flex-col items-stretch gap-2 rounded-xl border bg-card px-3 pt-3 pb-2.5 text-left transition hover:border-ink disabled:opacity-60 ${
          current ? "border-ink" : "border-line"
        }`}
      >
        <SignatureSvg signature={person.signature} label={`${person.name}'s signature`} className="aspect-[5/2] w-full text-ink" />
        <span className="truncate border-t border-line pt-2 font-mono text-xs tracking-wider uppercase">
          {busy ? "One moment…" : person.name}
        </span>
      </button>
      {person.createdHere && (
        <Link
          href={`/who/${person.id}/edit`}
          className="absolute top-1.5 right-2 rounded px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-muted uppercase hover:text-ink"
        >
          Edit
        </Link>
      )}
    </div>
  );
}
