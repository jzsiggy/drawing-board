// "Send to frame": render an image for a board's panel, store it, and make it
// the board's desired image. The most recent send always wins.

import { renderForPanel, renderSettingsFrom, settingsHash } from "@/lib/render/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SendToBoard {
  boardId: string;
  image: Buffer;
  // Where the image came from, e.g. a storage path or "script:flowers.jpg".
  sourcePath: string;
  generationId?: string;
  sentBy?: string;
  deviceId?: string;
}

export async function sendImageToBoard(send: SendToBoard) {
  const supabase = createAdminClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, panel_type, settings")
    .eq("id", send.boardId)
    .single();
  if (boardError) throw boardError;

  const settings = renderSettingsFrom(board.settings);
  const rendered = await renderForPanel(send.image, board.panel_type, settings);

  // Reuse the rendition if this exact image was already rendered for this
  // panel. Posters match on (generation, panel, settings), never on the file
  // hash alone: two posters can be byte-identical, and the rendition is what
  // records which poster a frame is showing.
  let query = supabase
    .from("renditions")
    .select("id")
    .eq("panel_type", board.panel_type)
    .eq("settings_hash", settingsHash(settings))
    .eq("sha256", rendered.sha256);
  query = send.generationId ? query.eq("generation_id", send.generationId) : query.is("generation_id", null);
  const { data: existing, error: findError } = await query.limit(1).maybeSingle();
  if (findError) throw findError;

  let renditionId = existing?.id;
  if (!renditionId) {
    const path = `${board.panel_type}/${rendered.sha256}.bin`;
    const upload = await supabase.storage
      .from("renditions")
      .upload(path, rendered.file, { contentType: "application/octet-stream", upsert: true });
    if (upload.error) throw upload.error;

    const { data, error } = await supabase
      .from("renditions")
      .insert({
        generation_id: send.generationId ?? null,
        source_path: send.sourcePath,
        panel_type: board.panel_type,
        settings_hash: settingsHash(settings),
        path,
        sha256: rendered.sha256,
        bytes: rendered.file.length,
      })
      .select("id")
      .single();
    if (error) throw error;
    renditionId = data.id;
  }

  const [display, update] = await Promise.all([
    supabase
      .from("displays")
      .insert({
        board_id: board.id,
        rendition_id: renditionId,
        sent_by: send.sentBy ?? null,
        device_id: send.deviceId ?? null,
      })
      .select("id")
      .single(),
    supabase.from("boards").update({ desired_rendition_id: renditionId }).eq("id", board.id),
  ]);
  if (display.error) throw display.error;
  if (update.error) throw update.error;

  return { renditionId, displayId: display.data.id, sha256: rendered.sha256, settings };
}
