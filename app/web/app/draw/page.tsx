import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { z } from "zod";

import { getCurrentPerson } from "@/lib/session";
import type { StrokeDoc } from "@/lib/strokes";
import { createAdminClient } from "@/lib/supabase/admin";
import { DrawingBoardLoader } from "./DrawingBoardLoader";

export const metadata: Metadata = { title: "Draw · Drawing Board" };

// Pinch-zoom would fight with drawing.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#eceeeb",
};

export default function DrawPage({ searchParams }: PageProps<"/draw">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-paper" />}>
      <Board searchParams={searchParams} />
    </Suspense>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/draw">["searchParams"] }) {
  const person = await getCurrentPerson();
  if (!person) redirect("/who");

  // ?from=<drawing id>: "Keep drawing" from a poster.
  const from = z.uuid().safeParse((await searchParams).from);
  if (from.success) {
    const { data } = await createAdminClient().from("drawings").select("id, strokes").eq("id", from.data).maybeSingle();
    if (data) {
      const strokes = (data.strokes as unknown as StrokeDoc).strokes;
      return <DrawingBoardLoader personName={person.name} initialStrokes={strokes} parentId={data.id} />;
    }
  }
  return <DrawingBoardLoader personName={person.name} />;
}
