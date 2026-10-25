import { describe, expect, it, vi } from "vitest";

// status.ts talks to Supabase in listFrameStatuses; these tests only use the
// pure helpers, so stub the client module.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { batteryPercent, checkInTiming } = await import("./status");

describe("batteryPercent", () => {
  it("maps a LiPo's voltage to a rough percentage", () => {
    expect(batteryPercent(4200)).toBe(100);
    expect(batteryPercent(4191)).toBe(99);
    expect(batteryPercent(3850)).toBe(59);
    expect(batteryPercent(3300)).toBe(0);
  });

  it("clamps outside the curve", () => {
    expect(batteryPercent(4350)).toBe(100);
    expect(batteryPercent(3100)).toBe(0);
  });

  it("returns null without a battery reading", () => {
    expect(batteryPercent(null)).toBeNull();
    expect(batteryPercent(0)).toBeNull();
  });
});

describe("checkInTiming", () => {
  const seen = "2026-10-25T10:00:00.000Z";
  const at = (iso: string) => new Date(iso).getTime();

  it("expects the next check-in one interval after the last", () => {
    expect(checkInTiming(seen, 600, at("2026-10-25T10:05:00Z"))).toEqual({
      nextCheckAt: "2026-10-25T10:10:00.000Z",
      late: false,
    });
  });

  it("allows half an interval and a minute of slack before calling it late", () => {
    expect(checkInTiming(seen, 600, at("2026-10-25T10:15:59Z")).late).toBe(false);
    expect(checkInTiming(seen, 600, at("2026-10-25T10:16:01Z")).late).toBe(true);
  });

  it("knows nothing about a frame that never checked in", () => {
    expect(checkInTiming(null, 600)).toEqual({ nextCheckAt: null, late: false });
  });
});
