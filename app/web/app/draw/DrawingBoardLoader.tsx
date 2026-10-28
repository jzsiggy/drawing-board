"use client";

import dynamic from "next/dynamic";

import type { Stroke, StrokeDoc } from "@/lib/strokes";

// The board is all canvas and touch, so it renders in the browser only.
const DrawingBoard = dynamic(() => import("./DrawingBoard"), { ssr: false });

export function DrawingBoardLoader(props: {
  personName: string;
  personSignature: StrokeDoc;
  initialStrokes?: Stroke[];
  parentId?: string;
}) {
  // A different starting drawing means a different board.
  return <DrawingBoard key={props.parentId ?? "new"} {...props} />;
}
