"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { drawStrokes, type Point, type Stroke } from "@/lib/strokes";

interface Props {
  aspect: number;
  strokes: Stroke[];
  tool: Stroke["tool"];
  color: string;
  size: number;
  onStroke: (stroke: Stroke) => void;
  label: string;
  // "width": as wide as the container, height from the aspect ratio.
  // "contain": the largest box that fits a container with its own height.
  fit?: "width" | "contain";
  className?: string;
  canvasClassName?: string;
  // Drawn over the canvas, inside its box (labels, guide lines).
  overlay?: React.ReactNode;
}

// A finger/pen canvas at a fixed aspect ratio, sized from its container. Committed strokes are cached in an offscreen canvas; only the stroke
// being drawn is redrawn on each move.
export function StrokeCanvas({
  aspect,
  strokes,
  tool,
  color,
  size,
  onStroke,
  label,
  fit = "width",
  className,
  canvasClassName,
  overlay,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<{ pointerId: number; points: Point[] } | null>(null);
  const frameRef = useRef(0);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      let w = width;
      let h = w / aspect;
      if (fit === "contain" && h > height) {
        h = height;
        w = h * aspect;
      }
      setBox({ width: Math.floor(w), height: Math.floor(h) });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [aspect, fit]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const committed = committedRef.current;
    if (!canvas || !committed) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(committed, 0, 0);
    const live = liveRef.current;
    if (live) drawStrokes(ctx, [{ tool, color, size, points: live.points }], canvas.width, canvas.height);
  }, [tool, color, size]);

  // Redraw everything when the strokes or the size change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    const committed = (committedRef.current ??= document.createElement("canvas"));
    committed.width = canvas.width;
    committed.height = canvas.height;
    drawStrokes(committed.getContext("2d")!, strokes, committed.width, committed.height);
    paint();
  }, [strokes, box, paint]);

  const requestPaint = () => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(paint);
  };

  const toPoint = (e: PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    // A finger can slide past the edge while drawing; keep it on the canvas.
    const unit = (v: number, places: number) => Math.round(Math.min(1, Math.max(0, v)) * 10 ** places) / 10 ** places;
    return [
      unit((e.clientX - rect.left) / rect.width, 4),
      unit((e.clientY - rect.top) / rect.height, 4),
      unit(e.pressure, 2),
    ];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (liveRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    liveRef.current = { pointerId: e.pointerId, points: [toPoint(e.nativeEvent)] };
    requestPaint();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const live = liveRef.current;
    if (!live || live.pointerId !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const event of events.length ? events : [e.nativeEvent]) {
      const point = toPoint(event);
      const last = live.points[live.points.length - 1];
      if (point[0] !== last[0] || point[1] !== last[1]) live.points.push(point);
    }
    requestPaint();
  };

  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const live = liveRef.current;
    if (!live || live.pointerId !== e.pointerId) return;
    liveRef.current = null;
    const stroke: Stroke = { tool, color, size, points: live.points };
    // Commit to the cache right away so the stroke doesn't blink out while
    // the parent re-renders with the new list.
    const committed = committedRef.current;
    if (committed) drawStrokes(committed.getContext("2d")!, [stroke], committed.width, committed.height);
    requestPaint();
    onStroke(stroke);
  };

  return (
    <div
      ref={wrapRef}
      className={`flex items-center justify-center ${className ?? ""}`}
      // Holds the canvas's height from the first paint, before it measures.
      style={fit === "width" ? { aspectRatio: aspect } : undefined}
    >
      <div className="relative" style={{ width: box.width, height: box.height }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          style={{ width: box.width, height: box.height, touchAction: "none" }}
          className={`block ${canvasClassName ?? ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
        {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
      </div>
    </div>
  );
}
