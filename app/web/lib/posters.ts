// Poster titles: typed on the "Make it a poster" step and stored on the
// drawing, so every version of a drawing shares one. Never printed on the
// poster itself.

import { z } from "zod";

export const TITLE_MAX = 60;

// Blank means no title.
export const posterTitleSchema = z
  .string()
  .trim()
  .max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`)
  .transform((title) => title || null);

export function displayTitle(title: string | null | undefined): string {
  return title || "Untitled";
}
