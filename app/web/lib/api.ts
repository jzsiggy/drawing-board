// Small helpers shared by the app's API routes.

import type { z } from "zod";

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

// Parses and validates a JSON body. `describe` turns the first validation
// problem into a message a person can act on.
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
  describe: (issue: z.core.$ZodIssue) => string = (issue) => issue.message,
): Promise<{ data: z.output<T> } | { error: Response }> {
  const body = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: jsonError(400, issue ? describe(issue) : "Invalid request") };
  }
  return { data: parsed.data };
}
