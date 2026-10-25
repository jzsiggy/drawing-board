import { describe, expect, it } from "vitest";

import { describePersonIssue, personInputSchema } from "./people";
import { DRAWING_ASPECT, SIGNATURE_ASPECT, drawingDocSchema, signatureDocSchema, strokePath, type Stroke } from "./strokes";

const line: Stroke = {
  tool: "pen",
  color: "#1b1e20",
  size: 0.02,
  points: [
    [0.1, 0.1, 0.5],
    [0.5, 0.5, 0.5],
    [0.9, 0.2, 0.5],
  ],
};

describe("strokePath", () => {
  it("outlines a stroke as a closed SVG path in canvas pixels", () => {
    const d = strokePath(line, 1200, 1600);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const numbers = d.match(/-?\d+\.\d+/g)!.map(Number);
    expect(Math.max(...numbers)).toBeLessThan(1600);
    expect(Math.max(...numbers)).toBeGreaterThan(900);
  });

  it("draws a dot for a single tap", () => {
    expect(strokePath({ ...line, points: [[0.5, 0.5, 0.5]] }, 100, 100)).not.toBe("");
  });
});

describe("drawingDocSchema", () => {
  const doc = { version: 1, aspect: DRAWING_ASPECT, strokes: [line] };

  it("accepts a drawing", () => {
    expect(drawingDocSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects an empty drawing, the wrong aspect and bad colours", () => {
    expect(drawingDocSchema.safeParse({ ...doc, strokes: [] }).success).toBe(false);
    expect(drawingDocSchema.safeParse({ ...doc, aspect: 1 }).success).toBe(false);
    expect(drawingDocSchema.safeParse({ ...doc, strokes: [{ ...line, color: "red" }] }).success).toBe(false);
  });
});

describe("signatures", () => {
  const signature = { version: 1, aspect: SIGNATURE_ASPECT, strokes: [line] };

  it("clamps points that slid past the edge instead of rejecting them", () => {
    const offEdge = { ...line, points: [[-0.3, 0.5, 0.5], [1.4, 1.2, 0.5]] };
    const parsed = signatureDocSchema.safeParse({ ...signature, strokes: [offEdge] });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.strokes[0].points).toEqual([
      [0, 0.5, 0.5],
      [1, 1, 0.5],
    ]);
  });

  it("explains signature problems in plain words", () => {
    const parsed = personInputSchema.safeParse({ name: "Ana", signature: { ...signature, strokes: [] } });
    expect(describePersonIssue(parsed.error!.issues[0])).toBe("Your signature couldn't be saved. Clear it and sign again.");
  });

  it("rejects eraser strokes", () => {
    expect(signatureDocSchema.safeParse(signature).success).toBe(true);
    expect(
      signatureDocSchema.safeParse({ ...signature, strokes: [{ ...line, tool: "eraser" }] }).success,
    ).toBe(false);
  });

  it("needs a name, trimmed, of at most 80 characters", () => {
    expect(personInputSchema.safeParse({ name: "  Ana  ", signature }).data?.name).toBe("Ana");
    expect(personInputSchema.safeParse({ name: "   ", signature }).success).toBe(false);
    expect(personInputSchema.safeParse({ name: "x".repeat(81), signature }).success).toBe(false);
  });
});
