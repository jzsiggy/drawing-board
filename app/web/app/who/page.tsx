import type { Metadata } from "next";
import { Suspense } from "react";

import { getCurrentPerson, getDeviceId } from "@/lib/session";
import type { StrokeDoc } from "@/lib/strokes";
import { createSessionClient } from "@/lib/supabase/server";
import { PeoplePicker, type PickerPerson } from "./PeoplePicker";

export const metadata: Metadata = { title: "Who's drawing? · Drawing Board" };

export default function WhoPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-10 pb-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Who&rsquo;s drawing?</h1>
        <p className="text-muted">Pick yourself, or add yourself if it&rsquo;s your first time.</p>
      </header>
      {/* The list depends on this phone, so it streams in after the shell. */}
      <Suspense fallback={<PickerSkeleton />}>
        <People />
      </Suspense>
    </main>
  );
}

async function People() {
  const supabase = await createSessionClient();
  const [deviceId, current, people, history] = await Promise.all([
    getDeviceId(),
    getCurrentPerson(),
    supabase
      .from("people")
      .select("id, name, signature_strokes, created_by_device_id")
      .order("last_active_at", { ascending: false }),
    supabase.from("device_people").select("person_id"),
  ]);
  if (people.error) throw people.error;

  const usedHere = new Set((history.data ?? []).map((row) => row.person_id));
  const list: PickerPerson[] = people.data.map((p) => ({
    id: p.id,
    name: p.name,
    signature: p.signature_strokes as unknown as StrokeDoc,
    createdHere: p.created_by_device_id === deviceId,
    usedHere: usedHere.has(p.id) || p.created_by_device_id === deviceId,
  }));

  return <PeoplePicker people={list} currentId={current?.id ?? null} />;
}

function PickerSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden>
      <div className="h-12 rounded-full bg-line/60" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[5/3] rounded-xl bg-line/60" />
        ))}
      </div>
    </div>
  );
}
