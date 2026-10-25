"use client";

import dynamic from "next/dynamic";

// The board is all canvas and touch, so it renders in the browser only.
const DrawingBoard = dynamic(() => import("./DrawingBoard"), { ssr: false });

export function DrawingBoardLoader({ personName }: { personName: string }) {
  return <DrawingBoard personName={personName} />;
}
