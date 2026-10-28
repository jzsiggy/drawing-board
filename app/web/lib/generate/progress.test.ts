import { describe, expect, it } from "vitest";

import { estimateProgress } from "./progress";

describe("estimateProgress", () => {
  it("starts small and grows while painting", () => {
    expect(estimateProgress("queued", 0)).toBe(5);
    expect(estimateProgress("painting", 0)).toBe(8);
    expect(estimateProgress("painting", 10_000)).toBeGreaterThan(estimateProgress("painting", 2_000));
  });

  it("never claims to be finished before the poster is", () => {
    expect(estimateProgress("painting", 10 * 60_000)).toBeLessThanOrEqual(85);
    expect(estimateProgress("fitting", 10 * 60_000)).toBeLessThanOrEqual(95);
  });

  it("moves forward when the inks are being fitted", () => {
    expect(estimateProgress("fitting", 3_000)).toBeGreaterThanOrEqual(85);
  });
});
