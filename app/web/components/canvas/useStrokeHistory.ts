"use client";

import { useCallback, useState } from "react";

import type { Stroke } from "@/lib/strokes";

interface History {
  past: Stroke[][];
  present: Stroke[];
  future: Stroke[][];
}

// Undo/redo over whole snapshots, so "start over" is undoable like any stroke.
export function useStrokeHistory(initial: Stroke[] | (() => Stroke[]) = []) {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: typeof initial === "function" ? initial() : initial,
    future: [],
  }));

  const add = useCallback(
    (stroke: Stroke) =>
      setHistory((h) => ({ past: [...h.past, h.present], present: [...h.present, stroke], future: [] })),
    [],
  );
  const clear = useCallback(
    () =>
      setHistory((h) => (h.present.length ? { past: [...h.past, h.present], present: [], future: [] } : h)),
    [],
  );
  const undo = useCallback(
    () =>
      setHistory((h) =>
        h.past.length
          ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
          : h,
      ),
    [],
  );
  const redo = useCallback(
    () =>
      setHistory((h) =>
        h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h,
      ),
    [],
  );
  const reset = useCallback((strokes: Stroke[]) => setHistory({ past: [], present: strokes, future: [] }), []);

  return {
    strokes: history.present,
    add,
    clear,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
