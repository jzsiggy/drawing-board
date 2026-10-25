import { z } from "zod";

import { signatureDocSchema } from "@/lib/strokes";

export const personInputSchema = z.object({
  name: z.string().trim().min(1, "Write your name").max(80, "That name is too long"),
  signature: signatureDocSchema,
});

// Name problems carry their own message; anything about the strokes is
// something the person can only fix by signing again.
export function describePersonIssue(issue: z.core.$ZodIssue): string {
  return issue.path[0] === "name" ? issue.message : "Your signature couldn't be saved. Clear it and sign again.";
}
