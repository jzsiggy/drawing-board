// The gallery, poster first: one card per drawing, showing its poster on the
// display (or else its newest), with a count of its versions. A poster's
// page shows its sibling versions.

import { isStale } from "@/lib/generate/run";
import { PRESETS } from "@/lib/generate/presets";
import { displayTitle } from "@/lib/posters";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type GalleryFilter = "all" | "shown" | "mine";
export const GALLERY_LIMIT = 120;

export function parseFilter(value: unknown): GalleryFilter {
  if (value === "frame") return "shown"; // the old name, in case of saved links
  return value === "mine" || value === "shown" ? value : "all";
}

export interface PosterCard {
  // The featured version's generation id; /gallery/<id> opens it.
  id: string;
  drawingId: string;
  title: string;
  artistName: string;
  createdAt: string;
  versions: number;
  onFrame: boolean;
  // When the featured version started showing, if it's on the display now.
  shownSince: string | null;
}

export interface Gallery {
  onDisplay: PosterCard | null;
  cards: PosterCard[];
  posterCount: number;
}

export interface PosterVersion {
  id: string;
  number: number;
  onFrame: boolean;
}

export interface PosterPage {
  id: string;
  drawingId: string;
  title: string;
  artistName: string;
  styleName: string;
  createdAt: string;
  versions: PosterVersion[];
  onFrame: boolean;
  // The last time a frame confirmed showing it.
  lastShownAt: string | null;
}

type GenerationRow = {
  id: string;
  status: Database["public"]["Enums"]["generation_status"];
  created_at: string;
  preset_id: string;
};

type DrawingRow = {
  id: string;
  title: string | null;
  created_at: string;
  artist_id: string;
  artist: { name: string } | null;
  generations: GenerationRow[];
};

const DRAWING_COLUMNS = "id, title, created_at, artist_id, artist:people(name), generations(id, status, created_at, preset_id)";

// Which posters are on a frame now, and when each was last shown anywhere.
async function frameMarks() {
  const supabase = createAdminClient();
  const [boards, displays] = await Promise.all([
    supabase.from("boards").select("shown_sha256, desired:renditions!boards_desired_rendition_id_fkey(sha256, generation_id)"),
    supabase.from("displays").select("shown_at, rendition:renditions!inner(generation_id)").not("shown_at", "is", null),
  ]);
  if (boards.error) throw boards.error;
  if (displays.error) throw displays.error;

  const onFrame = new Set<string>();
  for (const board of boards.data) {
    const desired = board.desired;
    if (desired?.generation_id && desired.sha256 === board.shown_sha256) onFrame.add(desired.generation_id);
  }
  const lastShown = new Map<string, string>();
  for (const display of displays.data) {
    const id = display.rendition.generation_id;
    if (!id || !display.shown_at) continue;
    const seen = lastShown.get(id);
    if (!seen || display.shown_at > seen) lastShown.set(id, display.shown_at);
  }
  return { onFrame, lastShown };
}

type Marks = Awaited<ReturnType<typeof frameMarks>>;

// Finished posters only, oldest first: failed and abandoned attempts aren't versions.
function posters(row: DrawingRow): GenerationRow[] {
  return row.generations
    .filter((g) => g.status === "succeeded" && !isStale(g))
    .toSorted((a, b) => a.created_at.localeCompare(b.created_at));
}

function toCard(row: DrawingRow, versions: GenerationRow[], marks: Marks, prefer?: (g: GenerationRow) => boolean): PosterCard {
  const featured =
    versions.find((g) => marks.onFrame.has(g.id)) ?? (prefer && versions.findLast(prefer)) ?? versions[versions.length - 1];
  const onFrame = marks.onFrame.has(featured.id);
  return {
    id: featured.id,
    drawingId: row.id,
    title: displayTitle(row.title),
    artistName: row.artist?.name ?? "Someone",
    createdAt: featured.created_at,
    versions: versions.length,
    onFrame,
    shownSince: onFrame ? (marks.lastShown.get(featured.id) ?? null) : null,
  };
}

// Newest first. "mine" needs the current person; "shown" keeps drawings with
// a version that's been on a display, featuring that version.
export async function listGallery(filter: GalleryFilter, personId: string | null): Promise<Gallery> {
  const empty = { onDisplay: null, cards: [], posterCount: 0 };
  if (filter === "mine" && !personId) return empty;

  const supabase = createAdminClient();
  const marks = await frameMarks();
  let query = supabase.from("drawings").select(DRAWING_COLUMNS).order("created_at", { ascending: false }).limit(GALLERY_LIMIT);
  if (filter === "mine") query = query.eq("artist_id", personId!);
  const { data, error } = await query;
  if (error) throw error;

  const shown = (g: GenerationRow) => marks.lastShown.has(g.id);
  let posterCount = 0;
  const cards: PosterCard[] = [];
  for (const row of data as DrawingRow[]) {
    const versions = posters(row);
    if (versions.length === 0) continue;
    if (filter === "shown" && !versions.some(shown)) continue;
    posterCount += versions.length;
    cards.push(toCard(row, versions, marks, filter === "shown" ? shown : undefined));
  }
  // Newest poster first, not newest drawing: another version moves it up.
  cards.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const onDisplay = cards.find((c) => c.onFrame) ?? null;
  return { onDisplay, cards: cards.filter((c) => c !== onDisplay), posterCount };
}

export async function getPoster(id: string): Promise<PosterPage | null> {
  const supabase = createAdminClient();
  const { data: generation, error } = await supabase.from("generations").select("drawing_id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!generation) return null;

  const [marks, drawing] = await Promise.all([
    frameMarks(),
    supabase.from("drawings").select(DRAWING_COLUMNS).eq("id", generation.drawing_id).single(),
  ]);
  if (drawing.error) throw drawing.error;
  const row = drawing.data as DrawingRow;
  const versions = posters(row);
  const poster = versions.find((g) => g.id === id);
  if (!poster) return null;

  return {
    id,
    drawingId: row.id,
    title: displayTitle(row.title),
    artistName: row.artist?.name ?? "Someone",
    styleName: PRESETS[poster.preset_id as keyof typeof PRESETS]?.name ?? "Retro poster",
    createdAt: poster.created_at,
    versions: versions.map((g, i) => ({ id: g.id, number: i + 1, onFrame: marks.onFrame.has(g.id) })),
    onFrame: marks.onFrame.has(id),
    lastShownAt: marks.lastShown.get(id) ?? null,
  };
}

// Old gallery links used the drawing's id: its featured poster, if any.
export async function featuredPosterOfDrawing(drawingId: string): Promise<string | null> {
  const [marks, { data, error }] = await Promise.all([
    frameMarks(),
    createAdminClient().from("drawings").select(DRAWING_COLUMNS).eq("id", drawingId).maybeSingle(),
  ]);
  if (error) throw error;
  if (!data) return null;
  const versions = posters(data as DrawingRow);
  return versions.length ? toCard(data as DrawingRow, versions, marks).id : null;
}
