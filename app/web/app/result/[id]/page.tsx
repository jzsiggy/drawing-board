import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { createAdminClient } from "@/lib/supabase/admin";
import { ResultView } from "./ResultView";

export const metadata: Metadata = { title: "Your poster · Drawing Board" };

const SKETCH_URL_SECONDS = 60 * 60;

export default function ResultPage({ params }: PageProps<"/result/[id]">) {
  return (
    <Suspense fallback={<ResultSkeleton />}>
      <Result params={params} />
    </Suspense>
  );
}

// Shown instantly after Submit, while the page streams in.
function ResultSkeleton() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 pt-6">
      <div className="h-5" />
      <div className="aspect-[3/4] w-full animate-pulse rounded-md bg-white/70 shadow-[0_1px_3px_rgb(0_0_0/0.12)]" />
      <h1 className="font-display text-3xl font-bold tracking-tight">Printing your poster…</h1>
    </main>
  );
}

async function Result({ params }: { params: PageProps<"/result/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("generations")
    .select("id, drawing_id, drawing:drawings(sketch_path, artist:people(name))")
    .eq("id", id)
    .maybeSingle();
  if (!data?.drawing) notFound();

  const sketch = await supabase.storage.from("sketches").createSignedUrl(data.drawing.sketch_path, SKETCH_URL_SECONDS);
  if (sketch.error) throw sketch.error;

  return (
    <ResultView
      generationId={data.id}
      drawingId={data.drawing_id}
      sketchUrl={sketch.data.signedUrl}
      artistName={data.drawing.artist?.name ?? "Someone"}
    />
  );
}
