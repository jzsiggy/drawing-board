// POST /api/frame/ack: "I'm now showing <sha256>". See app/docs/frame-protocol.md.

import type { NextRequest } from "next/server";

import { findBoardByAuthorization, markShown, readTelemetry, recordCheckin } from "@/lib/frames/boards";

export async function POST(request: NextRequest) {
  const board = await findBoardByAuthorization(request.headers.get("authorization"));
  if (!board) return new Response(null, { status: 401 });

  const body = (await request.json().catch(() => null)) as { sha256?: unknown } | null;
  const sha = typeof body?.sha256 === "string" ? body.sha256.toLowerCase() : "";
  if (!/^[0-9a-f]{64}$/.test(sha)) return new Response("sha256 missing or malformed", { status: 400 });

  await markShown(board, sha);
  await recordCheckin(board, readTelemetry(request.headers), "ack");
  return new Response(null, { status: 204 });
}
