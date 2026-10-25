// GET /api/frame/state: "has the image changed?" See app/docs/frame-protocol.md.

import type { NextRequest } from "next/server";

import {
  checkIntervalSeconds,
  findBoardByAuthorization,
  getRendition,
  markShown,
  parseShownSha,
  readTelemetry,
  recordCheckin,
} from "@/lib/frames/boards";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_SECONDS = 300;

export async function GET(request: NextRequest) {
  const board = await findBoardByAuthorization(request.headers.get("authorization"));
  if (!board) return new Response(null, { status: 401 });

  const shown = parseShownSha(request.headers.get("if-none-match"));
  const telemetry = readTelemetry(request.headers);
  const desired = await getRendition(board.desired_rendition_id);
  const headers = { "X-Next-Check": String(checkIntervalSeconds(board)) };

  if (shown) await markShown(board, shown);

  if (!desired || desired.sha256 === shown) {
    await recordCheckin(board, telemetry, "no-change");
    return new Response(null, { status: 304, headers });
  }

  const { data, error } = await createAdminClient()
    .storage.from("renditions")
    .createSignedUrl(desired.path, SIGNED_URL_SECONDS);
  if (error) throw error;

  await recordCheckin(board, telemetry, "new-image");
  return Response.json(
    { sha256: desired.sha256, url: data.signedUrl, bytes: desired.bytes },
    { headers },
  );
}
