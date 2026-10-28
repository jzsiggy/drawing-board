import type { Metadata } from "next";
import { Suspense } from "react";

import { TabPage } from "@/components/TabPage";
import { getCurrentPerson, getDeviceId } from "@/lib/session";
import type { StrokeDoc } from "@/lib/strokes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { PeoplePicker, type PickerPerson } from "./PeoplePicker";

export const metadata: Metadata = { title: "Who's drawing? · Sketch to poster" };

export default function WhoPage() {
  return (
    <TabPage className="gap-6 pt-10 pb-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-[44px] leading-[42px]">Who&rsquo;s drawing?</h1>
        <p className="text-sm text-muted">Pick yourself before you start. Your name and signature go on every poster you make.</p>
      </header>
      {/* The list depends on this phone, so it streams in after the shell. */}
      <Suspense fallback={<PickerSkeleton />}>
        <People />
      </Suspense>
    </TabPage>
  );
}

async function People() {
  const supabase = await createSessionClient();
  const [deviceId, current, people, posters] = await Promise.all([
    getDeviceId(),
    getCurrentPerson(),
    supabase
      .from("people")
      .select("id, name, signature_strokes, created_by_device_id")
      .order("last_active_at", { ascending: false }),
    createAdminClient().from("generations").select("drawing:drawings!inner(artist_id)").eq("status", "succeeded"),
  ]);
  if (people.error) throw people.error;
  if (posters.error) throw posters.error;

  const counts = new Map<string, number>();
  for (const { drawing } of posters.data) counts.set(drawing.artist_id, (counts.get(drawing.artist_id) ?? 0) + 1);
  const list: PickerPerson[] = people.data.map((p) => ({
    id: p.id,
    name: p.name,
    signature: p.signature_strokes as unknown as StrokeDoc,
    posters: counts.get(p.id) ?? 0,
    createdHere: p.created_by_device_id === deviceId,
  }));

  return <PeoplePicker people={list} currentId={current?.id ?? null} />;
}

function PickerSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-11 bg-sunken" />
      <div className="flex flex-col gap-px bg-line">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[72px] bg-card" />
        ))}
      </div>
    </div>
  );
}
