// Shared by the generator implementations and the code that picks one.

export interface GenerateInput {
  // The drawing as a PNG.
  sketch: Buffer;
  prompt: string;
  aspectRatio: "3:4";
}

export interface ImageGenerator {
  // Recorded on every generation.
  readonly model: string;
  // Returns the poster as a PNG.
  generate(input: GenerateInput): Promise<Buffer>;
}

// A failure worth showing to the person, e.g. the model refused the image.
export class GenerationError extends Error {}
