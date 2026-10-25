// Turns Supabase's refusal to create a phone session into something a person
// can act on. Shared by the proxy (error page) and the API (JSON error).
export function explainSessionError(message: string): string {
  return /anonymous sign-ins are disabled/i.test(message)
    ? "Phone sign-in is turned off in Supabase. In the Supabase dashboard, turn on Authentication → Sign In / Providers → Allow anonymous sign-ins, then reload."
    : `Couldn't start a session for this phone (${message}). Reload to try again.`;
}
