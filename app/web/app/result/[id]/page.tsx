import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { BackHeader } from "@/components/AppHeader";
import { PRESETS } from "@/lib/generate/presets";
import { displayTitle } from "@/lib/posters";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResultView } from "./ResultView";

export const metadata: Metadata = { title: "Your poster · Sketch to poster" };

export default function ResultPage({ params }: PageProps<"/result/[id]">) {
  return (
    <Suspense fallback={<ResultSkeleton />}>
      <Result params={params} />
    </Suspense>
  );
}

// Shown instantly after "Generate poster", while the page streams in.
function ResultSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <BackHeader label="Step 2 of 3" />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-7 px-5 pt-8">
        <h1 className="text-[44px] leading-[42px]">Turning your sketch into a poster</h1>
        <div className="mx-auto aspect-[3/4] w-60 animate-pulse border border-line bg-card" />
      </main>
    </div>
  );
}

async function Result({ params }: { params: PageProps<"/result/[id]">["params"] }) {
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const { data } = await createAdminClient()
    .from("generations")
    .select("id, drawing_id, preset_id, drawing:drawings(title, artist:people(name))")
    .eq("id", id.data)
    .maybeSingle();
  if (!data?.drawing) notFound();

  return (
    <ResultView
      generationId={data.id}
      drawingId={data.drawing_id}
      title={displayTitle(data.drawing.title)}
      styleName={PRESETS[data.preset_id as keyof typeof PRESETS]?.name ?? "Retro poster"}
      artistName={data.drawing.artist?.name ?? "Someone"}
    />
  );
}
