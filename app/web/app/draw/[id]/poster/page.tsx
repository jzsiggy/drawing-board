import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { BackHeader } from "@/components/AppHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { PosterForm } from "./PosterForm";

export const metadata: Metadata = { title: "Make it a poster · Sketch to poster" };

// Step 1 of 3: name the poster, then generate it.
export default function MakePosterPage({ params }: PageProps<"/draw/[id]/poster">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={<BackHeader href="/draw" back="Sketch" label="Step 1 of 3" />}>
        <MakePoster params={params} />
      </Suspense>
    </div>
  );
}

async function MakePoster({ params }: { params: PageProps<"/draw/[id]/poster">["params"] }) {
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = createAdminClient();
  const { data: drawing } = await supabase.from("drawings").select("id, title, parent_drawing_id").eq("id", id.data).maybeSingle();
  if (!drawing) notFound();
  // An edited sketch keeps the title of the one it came from.
  let title = drawing.title;
  if (!title && drawing.parent_drawing_id) {
    const { data: parent } = await supabase.from("drawings").select("title").eq("id", drawing.parent_drawing_id).maybeSingle();
    title = parent?.title ?? null;
  }

  return (
    <>
      <BackHeader href={`/draw?from=${drawing.id}`} back="Sketch" label="Step 1 of 3" />
      <PosterForm drawingId={drawing.id} initialTitle={title ?? ""} />
    </>
  );
}
