import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";

import { replacedPosterTitle } from "@/lib/frames/status";
import { displayTitle } from "@/lib/posters";
import { createAdminClient } from "@/lib/supabase/admin";
import { SentView } from "./SentView";

export const metadata: Metadata = { title: "On the display · Sketch to poster" };

export default function SentPage({ params }: PageProps<"/result/[id]/sent">) {
  return (
    <div className="min-h-dvh bg-ink text-white">
      <Suspense>
        <Sent params={params} />
      </Suspense>
    </div>
  );
}

async function Sent({ params }: { params: PageProps<"/result/[id]/sent">["params"] }) {
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const supabase = createAdminClient();
  const [{ data: generation }, { data: board }] = await Promise.all([
    supabase.from("generations").select("id, status, drawing:drawings(title)").eq("id", id.data).maybeSingle(),
    supabase.from("boards").select("id").order("created_at").limit(1).maybeSingle(),
  ]);
  if (!generation || generation.status !== "succeeded") notFound();
  const replaced = board ? await replacedPosterTitle(board.id, generation.id) : undefined;

  return (
    <SentView
      generationId={generation.id}
      title={displayTitle(generation.drawing?.title)}
      replaces={replaced === undefined ? "Nothing yet" : displayTitle(replaced)}
    />
  );
}
