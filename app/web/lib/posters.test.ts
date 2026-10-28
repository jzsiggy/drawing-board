import { describe, expect, it } from "vitest";

import { displayTitle, posterTitleSchema } from "./posters";

describe("posterTitleSchema", () => {
  it("trims, and turns blank into no title", () => {
    expect(posterTitleSchema.parse("  Sunday hills ")).toBe("Sunday hills");
    expect(posterTitleSchema.parse("   ")).toBeNull();
  });

  it("rejects long titles with a message a person can act on", () => {
    const result = posterTitleSchema.safeParse("x".repeat(61));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Keep the title under 60 characters.");
  });
});

describe("displayTitle", () => {
  it("shows Untitled when there's no title", () => {
    expect(displayTitle(null)).toBe("Untitled");
    expect(displayTitle("Fern")).toBe("Fern");
  });
});
