// Poster titles: suggested by the model with a drawing's first poster, and
// changeable afterwards. Stored on the drawing, so every version of a drawing
// shares one. Never printed on the poster itself.

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

// Tidies a model's suggested title: its first line, without quotes, markdown
// or a closing full stop, cut to fit at a word. Null if nothing is left.
export function cleanSuggestedTitle(raw: string): string | null {
  let title = (raw.trim().split("\n")[0] ?? "")
    .replace(/[*_#`]/g, "")
    .replace(/^title:\s*/i, "")
    .replace(/^["'“‘]+|["'”’]+$/g, "")
    .replace(/\.$/, "")
    .trim();
  if (title.length > TITLE_MAX) {
    const cut = title.slice(0, TITLE_MAX + 1);
    title = cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : TITLE_MAX).trim();
  }
  return title || null;
}
