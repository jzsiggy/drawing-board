import { ApiError, GoogleGenAI } from "@google/genai";
import sharp from "sharp";

import { GenerationError, type GenerateInput, type ImageGenerator } from "./types";

// Nano Banana 2.1. Set IMAGE_MODEL to compare others, e.g. gemini-3-pro-image
// (Nano Banana Pro).
export const DEFAULT_IMAGE_MODEL = "gemini-nano-banana-2.1";
// Names finished posters: about a second, where gemini-3.8-flash took 2-8.
// Set TITLE_MODEL to try another.
export const DEFAULT_TITLE_MODEL = "gemini-3.5-flash-lite";
// The poster waits for its title, so don't wait long.
const TITLE_TIMEOUT_MS = 15_000;

const TITLE_PROMPT =
  "This is a retro poster made from someone's sketch. Suggest a title for it, like the name of a " +
  "vintage travel or exhibition poster: one to five words, about what the poster shows. " +
  "Reply with the title only, no quotes.";

export class GeminiImageGenerator implements ImageGenerator {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly titleModel: string = DEFAULT_TITLE_MODEL,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate({ sketch, prompt, aspectRatio }: GenerateInput): Promise<Buffer> {
    const response = await this.client.models
      .generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: sketch.toString("base64") } }],
          },
        ],
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
      })
      .catch((e: unknown) => {
        // Out of quota (or billing not set up): nothing a guest can fix.
        if (e instanceof ApiError && e.status === 429) {
          throw new GenerationError("The poster machine is out of credits right now. Ask the host to check it.");
        }
        throw e;
      });

    const candidate = response.candidates?.[0];
    const data = candidate?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
    if (!data) {
      const reason = candidate?.finishReason ?? response.promptFeedback?.blockReason;
      const text = candidate?.content?.parts?.map((part) => part.text ?? "").join(" ").trim();
      throw new GenerationError(
        `The image model didn't return a poster${reason ? ` (${reason})` : ""}${text ? `: ${text.slice(0, 200)}` : ""}`,
      );
    }
    return sharp(Buffer.from(data, "base64")).png().toBuffer();
  }

  async suggestTitle(poster: Buffer): Promise<string> {
    const image = await sharp(poster).resize(512).jpeg({ quality: 80 }).toBuffer();
    const response = await this.client.models.generateContent({
      model: this.titleModel,
      contents: [
        {
          role: "user",
          parts: [{ text: TITLE_PROMPT }, { inlineData: { mimeType: "image/jpeg", data: image.toString("base64") } }],
        },
      ],
      config: { abortSignal: AbortSignal.timeout(TITLE_TIMEOUT_MS) },
    });
    return response.text ?? "";
  }
}
