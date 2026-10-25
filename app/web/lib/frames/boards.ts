// Frame-side logic for the /api/frame routes: who is asking, what they
// report, and what they should show. Protocol: app/docs/frame-protocol.md

import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

export type Board = Tables<"boards">;

export const DEFAULT_CHECK_INTERVAL_S = 600;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newBoardToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function findBoardByAuthorization(header: string | null): Promise<Board | null> {
  const token = header?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await createAdminClient()
    .from("boards")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function checkIntervalSeconds(board: Board): number {
  const value = (board.settings as { check_interval_s?: unknown } | null)?.check_interval_s;
  return typeof value === "number" && value >= 60 ? value : DEFAULT_CHECK_INTERVAL_S;
}

export interface Telemetry {
  batteryMv: number | null;
  rssi: number | null;
  firmware: string | null;
}

export function readTelemetry(headers: Headers): Telemetry {
  const int = (name: string) => {
    const value = Number.parseInt(headers.get(name) ?? "", 10);
    return Number.isFinite(value) ? value : null;
  };
  return {
    batteryMv: int("x-battery-mv"),
    rssi: int("x-rssi"),
    firmware: headers.get("x-firmware"),
  };
}

// "If-None-Match: "<sha>"" -> sha, or null.
export function parseShownSha(header: string | null): string | null {
  const sha = header?.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  return sha && /^[0-9a-f]{64}$/i.test(sha) ? sha.toLowerCase() : null;
}

export async function recordCheckin(board: Board, telemetry: Telemetry, result: string) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const [checkin, update] = await Promise.all([
    supabase.from("board_checkins").insert({
      board_id: board.id,
      at: now,
      battery_mv: telemetry.batteryMv,
      rssi: telemetry.rssi,
      firmware: telemetry.firmware,
      result,
    }),
    // Keep the last known values when a request leaves a header out.
    supabase
      .from("boards")
      .update({
        last_seen_at: now,
        ...(telemetry.batteryMv !== null && { battery_mv: telemetry.batteryMv }),
        ...(telemetry.rssi !== null && { rssi: telemetry.rssi }),
        ...(telemetry.firmware !== null && { firmware: telemetry.firmware }),
      })
      .eq("id", board.id),
  ]);
  if (checkin.error) throw checkin.error;
  if (update.error) throw update.error;
}

export async function getRendition(id: string | null) {
  if (!id) return null;
  const { data, error } = await createAdminClient()
    .from("renditions")
    .select("id, path, sha256, bytes")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Records that the frame is showing `sha`: from an ack, or implicitly when a
// check-in reports the hash of the image it was sent.
export async function markShown(board: Board, sha: string) {
  const supabase = createAdminClient();
  if (board.shown_sha256 !== sha) {
    const { error } = await supabase.from("boards").update({ shown_sha256: sha }).eq("id", board.id);
    if (error) throw error;
  }
  const desired = await getRendition(board.desired_rendition_id);
  if (desired?.sha256 !== sha) return;
  const { error } = await supabase
    .from("displays")
    .update({ shown_at: new Date().toISOString() })
    .eq("board_id", board.id)
    .eq("rendition_id", desired.id)
    .is("shown_at", null);
  if (error) throw error;
}
