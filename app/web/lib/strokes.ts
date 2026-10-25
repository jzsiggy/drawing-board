// Drawings and signatures are stored as strokes, not pixels. Points are
// fractions of the canvas (0..1) and sizes are fractions of its width, so a
// drawing looks the same on any screen and can be redrawn at any resolution.

import { getStroke } from "perfect-freehand";
import { z } from "zod";

export type Point = [x: number, y: number, pressure: number];

export interface Stroke {
  tool: "pen" | "eraser";
  color: string;
  size: number;
  points: Point[];
}

export interface StrokeDoc {
  version: 1;
  // Width / height of the canvas the strokes were drawn on.
  aspect: number;
  strokes: Stroke[];
}

// Portrait 3:4, like the panel. Signatures are a wide strip.
export const DRAWING_ASPECT = 3 / 4;
export const SIGNATURE_ASPECT = 5 / 2;

const MAX_STROKES = 3000;
const MAX_POINTS = 150_000;

// Clamped rather than rejected: a point just past the edge is still a point.
const unit = z.number().refine(Number.isFinite).transform((v) => Math.min(1, Math.max(0, v)));

const strokeSchema = z.object({
  tool: z.enum(["pen", "eraser"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  size: z.number().positive().max(0.2),
  points: z.array(z.tuple([unit, unit, unit])).min(1),
});

function strokeDocSchema(aspect: number) {
  return z
    .object({
      version: z.literal(1),
      aspect: z.literal(aspect),
      strokes: z.array(strokeSchema).min(1).max(MAX_STROKES),
    })
    .refine((doc) => doc.strokes.reduce((n, s) => n + s.points.length, 0) <= MAX_POINTS, {
      message: "Too many points",
    });
}

export const drawingDocSchema = strokeDocSchema(DRAWING_ASPECT);
export const signatureDocSchema = strokeDocSchema(SIGNATURE_ASPECT).refine(
  (doc) => doc.strokes.every((s) => s.tool === "pen"),
  { message: "Signatures have no eraser strokes" },
);

// Touch screens without pressure report 0 or 0.5 for every point; then let
// perfect-freehand simulate it from speed instead.
function hasRealPressure(points: Point[]): boolean {
  return points.some(([, , p]) => p !== 0 && p !== 0.5);
}

// Outline of one stroke as an SVG path, in pixels for a width x height canvas.
export function strokePath(stroke: Stroke, width: number, height: number): string {
  const outline = getStroke(
    stroke.points.map(([x, y, p]) => [x * width, y * height, p]),
    {
      size: stroke.size * width,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: !hasRealPressure(stroke.points),
      last: true,
    },
  );
  if (outline.length < 2) return "";
  // Quadratic curves through the midpoints, as in perfect-freehand's README.
  const n = (v: number) => v.toFixed(2);
  const parts = ["M", n(outline[0][0]), n(outline[0][1]), "Q"];
  outline.forEach(([x0, y0], i) => {
    const [x1, y1] = outline[(i + 1) % outline.length];
    parts.push(n(x0), n(y0), n((x0 + x1) / 2), n((y0 + y1) / 2));
  });
  parts.push("Z");
  return parts.join(" ");
}

// Draws strokes onto a transparent canvas context. Eraser strokes cut through
// what's below, so composite the result onto paper afterwards.
export function drawStrokes(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
) {
  for (const stroke of strokes) {
    const d = strokePath(stroke, width, height);
    if (!d) continue;
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = stroke.color;
    ctx.fill(new Path2D(d));
  }
  ctx.globalCompositeOperation = "source-over";
}
