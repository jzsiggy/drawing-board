// Poster styles. Every generation records the preset id, version and the
// exact prompt it used, so bump `version` whenever a prompt changes.

export interface StylePreset {
  id: string;
  name: string;
  version: number;
  prompt: string;
}

export const PRESETS = {
  "retro-poster": {
    id: "retro-poster",
    name: "Retro poster",
    version: 1,
    // A limited palette close to the panel's six inks dithers far better, and
    // the real signature is added afterwards, so no lettering.
    prompt: [
      "Turn this hand-drawn sketch into a vintage retro poster illustration.",
      "Keep the subject, composition and main shapes of the drawing recognisable.",
      "Use flat areas of colour, bold clean outlines and a subtle screen-print texture.",
      "Limit the palette to black, off-white, red, yellow, blue and green.",
      "Portrait, 3:4. No text, no lettering, no borders, no signature.",
    ].join("\n"),
  },
} satisfies Record<string, StylePreset>;

export type PresetId = keyof typeof PRESETS;

export const DEFAULT_PRESET: PresetId = "retro-poster";
