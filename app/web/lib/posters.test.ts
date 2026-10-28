import { describe, expect, it } from "vitest";

import { cleanSuggestedTitle, displayTitle, posterTitleSchema } from "./posters";

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

describe("cleanSuggestedTitle", () => {
  it("strips quotes, markdown, a label and a closing full stop", () => {
    expect(cleanSuggestedTitle('"Harbour at Dusk"')).toBe("Harbour at Dusk");
    expect(cleanSuggestedTitle("**Title:** Summer Express.\nA poster of a train.")).toBe("Summer Express");
    expect(cleanSuggestedTitle("“The Red Hills”")).toBe("The Red Hills");
  });

  it("cuts long titles at a word, and gives up on empty ones", () => {
    const long = cleanSuggestedTitle("word ".repeat(20));
    expect(long?.length).toBeLessThanOrEqual(60);
    expect(long?.endsWith("word")).toBe(true);
    expect(cleanSuggestedTitle('  ""  ')).toBeNull();
  });
});
