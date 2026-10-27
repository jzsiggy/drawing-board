// The gallery: drawings first, their poster versions second, and which
// versions are or have been on a frame.

import { isStale } from "@/lib/generate/run";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type GalleryFilter = "all" | "mine" | "frame";
export const GALLERY_LIMIT = 120;

export interface GalleryVersion {
  id: string;
  status: Database["public"]["Enums"]["generation_status"];
  createdAt: string;
  onFrame: boolean;
  beenOnFrame: boolean;
}

export interface GalleryDrawing {
  id: string;
  createdAt: string;
  artistId: string;
  artistName: string;
  versions: GalleryVersion[];
}

export function parseFilter(value: unknown): GalleryFilter {
  return value === "mine" || value === "frame" ? value : "all";
}

// Versions on a frame right now (shown and still the frame's target), and
// every version a frame has ever confirmed showing.
async function frameMarks() {
  const supabase = createAdminClient();
  const [boards, displays] = await Promise.all([
    supabase.from("boards").select("shown_sha256, desired:renditions!boards_desired_rendition_id_fkey(sha256, generation_id)"),
    supabase.from("displays").select("rendition:renditions!inner(generation_id)").not("shown_at", "is", null),
  ]);
  if (boards.error) throw boards.error;
  if (displays.error) throw displays.error;

  const onFrame = new Set<string>();
  for (const board of boards.data) {
    const desired = board.desired;
    if (desired?.generation_id && desired.sha256 === board.shown_sha256) onFrame.add(desired.generation_id);
  }
  const beenOnFrame = new Set<string>();
  for (const display of displays.data) {
    if (display.rendition.generation_id) beenOnFrame.add(display.rendition.generation_id);
  }
  return { onFrame, beenOnFrame };
}

const DRAWING_COLUMNS = "id, created_at, artist_id, artist:people(name), generations(id, status, created_at)";

type DrawingRow = {
  id: string;
  created_at: string;
  artist_id: string;
  artist: { name: string } | null;
  generations: { id: string; status: GalleryVersion["status"]; created_at: string }[];
};

function toGalleryDrawing(row: DrawingRow, marks: Awaited<ReturnType<typeof frameMarks>>): GalleryDrawing {
  return {
    id: row.id,
    createdAt: row.created_at,
    artistId: row.artist_id,
    artistName: row.artist?.name ?? "Someone",
    // Failed and abandoned attempts aren't versions, so the gallery leaves them out.
    versions: row.generations
      .filter((g) => g.status !== "failed" && !isStale(g))
      .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
      .map((g) => ({
        id: g.id,
        status: g.status,
        createdAt: g.created_at,
        onFrame: marks.onFrame.has(g.id),
        beenOnFrame: marks.beenOnFrame.has(g.id),
      })),
  };
}

// Newest first. "mine" needs the current person; "frame" keeps drawings with
// at least one version that's been on a frame.
export async function listGallery(filter: GalleryFilter, personId: string | null): Promise<GalleryDrawing[]> {
  const supabase = createAdminClient();
  const marks = await frameMarks();

  let query = supabase.from("drawings").select(DRAWING_COLUMNS).order("created_at", { ascending: false }).limit(GALLERY_LIMIT);
  if (filter === "mine") {
    if (!personId) return [];
    query = query.eq("artist_id", personId);
  }
  if (filter === "frame") {
    if (marks.beenOnFrame.size === 0) return [];
    const { data, error } = await supabase.from("generations").select("drawing_id").in("id", [...marks.beenOnFrame]);
    if (error) throw error;
    query = query.in("id", [...new Set(data.map((g) => g.drawing_id))]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as DrawingRow[]).map((row) => toGalleryDrawing(row, marks));
}

export async function getGalleryDrawing(id: string): Promise<GalleryDrawing | null> {
  const [marks, { data, error }] = await Promise.all([
    frameMarks(),
    createAdminClient().from("drawings").select(DRAWING_COLUMNS).eq("id", id).maybeSingle(),
  ]);
  if (error) throw error;
  return data ? toGalleryDrawing(data as DrawingRow, marks) : null;
}
