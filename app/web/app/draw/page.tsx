import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentPerson } from "@/lib/session";
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

export default function DrawPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-paper" />}>
      <Board />
    </Suspense>
  );
}

async function Board() {
  const person = await getCurrentPerson();
  if (!person) redirect("/who");
  return <DrawingBoardLoader personName={person.name} />;
}
