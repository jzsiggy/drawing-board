// "On e-ink": the poster dithered to the panel's six inks, as the frame
// will show it, so people can see the difference before sending.

import sharp from "sharp";

import { renderForPanel, renderPreviewPng, renderSettingsFrom } from "@/lib/render/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PANEL = "spectra6-13in3";

export function previewPath(generationId: string) {
  return `${generationId}-eink.png`;
}

// Uses the first frame's panel and settings, so the preview matches what
// sending it there would show.
export async function makeEinkPreview(poster: Buffer): Promise<Buffer> {
  const { data: board, error } = await createAdminClient()
    .from("boards")
    .select("panel_type, settings")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const panelType = board?.panel_type ?? DEFAULT_PANEL;
  const settings = renderSettingsFrom(board?.settings);
  const { codes } = await renderForPanel(poster, panelType, settings);
  const png = await renderPreviewPng(codes, panelType, settings.palette);
  // Six colours fit an indexed PNG: a fraction of the size, same pixels.
  return sharp(png).png({ palette: true, colours: 8, dither: 0 }).toBuffer();
}
