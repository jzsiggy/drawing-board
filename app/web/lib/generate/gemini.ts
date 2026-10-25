import { ApiError, GoogleGenAI } from "@google/genai";
import sharp from "sharp";

import { GenerationError, type GenerateInput, type ImageGenerator } from "./types";

// Nano Banana 2.1. Set IMAGE_MODEL to compare others, e.g. gemini-3-pro-image
// (Nano Banana Pro).
export const DEFAULT_IMAGE_MODEL = "gemini-nano-banana-2.1";

export class GeminiImageGenerator implements ImageGenerator {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
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
}
