// What the app shows about each frame: battery, when it checks in next, and
// where a given poster stands on it.

import { createAdminClient } from "@/lib/supabase/admin";
import { checkIntervalSeconds } from "./boards";

// A poster relative to one frame.
export type PosterOnFrame =
  | "not-sent" // never sent to this frame
  | "waiting" // sent; the frame hasn't shown it yet
  | "showing" // on the frame now
  | "replaced"; // was sent here, but a newer poster has been sent since

export interface FrameStatus {
  id: string;
  name: string;
  batteryPercent: number | null;
  lastSeenAt: string | null;
  // Estimate: last check-in plus the interval the server gave it.
  nextCheckAt: string | null;
  // Well past its next check-in: off, out of battery or out of Wi-Fi range.
  late: boolean;
  // The poster on the frame right now, if it's one made here.
  showingGenerationId: string | null;
  poster: PosterOnFrame | null;
}

// Typical single-cell LiPo resting voltages. Good enough for "about 70%".
const LIPO_CURVE: [mv: number, percent: number][] = [
  [4200, 100],
  [4100, 90],
  [4000, 78],
  [3900, 65],
  [3800, 52],
  [3700, 38],
  [3600, 22],
  [3500, 10],
  [3400, 4],
  [3300, 0],
];

export function batteryPercent(mv: number | null): number | null {
  if (mv === null || mv < 1000) return null; // no battery reading
  if (mv >= LIPO_CURVE[0][0]) return 100;
  for (let i = 1; i < LIPO_CURVE.length; i++) {
    const [hiMv, hiPct] = LIPO_CURVE[i - 1];
    const [loMv, loPct] = LIPO_CURVE[i];
    if (mv >= loMv) return Math.round(loPct + ((mv - loMv) / (hiMv - loMv)) * (hiPct - loPct));
  }
  return 0;
}

// The frame is "late" once it's missed its check-in by half an interval
// plus a minute (Wi-Fi connects and refreshes take a while).
export function checkInTiming(lastSeenAt: string | null, intervalS: number, now = Date.now()) {
  if (!lastSeenAt) return { nextCheckAt: null, late: false };
  const next = new Date(lastSeenAt).getTime() + intervalS * 1000;
  return { nextCheckAt: new Date(next).toISOString(), late: now > next + intervalS * 500 + 60_000 };
}

export async function listFrameStatuses(generationId?: string): Promise<FrameStatus[]> {
  const supabase = createAdminClient();
  const { data: boards, error } = await supabase
    .from("boards")
    .select("id, name, settings, last_seen_at, battery_mv, shown_sha256, desired:renditions!boards_desired_rendition_id_fkey(sha256, generation_id)")
    .order("created_at");
  if (error) throw error;

  // Frames this poster has ever been sent to.
  let sentTo = new Set<string>();
  if (generationId) {
    const { data, error: displaysError } = await supabase
      .from("displays")
      .select("board_id, rendition:renditions!inner(generation_id)")
      .eq("rendition.generation_id", generationId);
    if (displaysError) throw displaysError;
    sentTo = new Set(data.map((d) => d.board_id));
  }

  return boards.map((board) => {
    const timing = checkInTiming(board.last_seen_at, checkIntervalSeconds(board));
    let poster: PosterOnFrame | null = null;
    if (generationId) {
      if (board.desired?.generation_id === generationId) {
        poster = board.shown_sha256 === board.desired.sha256 ? "showing" : "waiting";
      } else {
        poster = sentTo.has(board.id) ? "replaced" : "not-sent";
      }
    }
    const shown = board.desired && board.shown_sha256 === board.desired.sha256 ? board.desired.generation_id : null;
    return {
      id: board.id,
      name: board.name,
      batteryPercent: batteryPercent(board.battery_mv),
      lastSeenAt: board.last_seen_at,
      ...timing,
      showingGenerationId: shown,
      poster,
    };
  });
}
