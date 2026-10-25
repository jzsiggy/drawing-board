// The image model behind "make it a poster". Swap providers by adding another
// ImageGenerator; the rest of the app only sees the interface in types.ts.

import { env } from "@/lib/env";
import { FakeImageGenerator } from "./fake";
import { DEFAULT_IMAGE_MODEL, GeminiImageGenerator } from "./gemini";
import type { ImageGenerator } from "./types";

// IMAGE_GENERATOR=fake (local development and tests) avoids spending credits.
export function getImageGenerator(): ImageGenerator {
  if (process.env.IMAGE_GENERATOR === "fake") return new FakeImageGenerator();
  return new GeminiImageGenerator(env.geminiApiKey(), process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL);
}
