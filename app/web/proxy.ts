// Runs before every page and app API request. Keeps the phone's Supabase
// session fresh and, on a phone's first visit, creates its anonymous session:
// that session is the phone's permanent device ID. Also sends "/" to the
// canvas or the picker.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { PERSON_COOKIE } from "@/lib/cookies";
import { env } from "@/lib/env";
import { ensureDevice } from "@/lib/devices";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const { data: signIn, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("Anonymous sign-in failed:", error.message);
    } else if (signIn.user) {
      await ensureDevice(signIn.user.id, request.headers.get("user-agent") ?? "").catch((e) =>
        console.error("Device registration failed:", e),
      );
    }
  }

  if (request.nextUrl.pathname === "/") {
    // /draw itself checks the person still exists.
    const target = request.cookies.has(PERSON_COOKIE) ? "/draw" : "/who";
    const redirect = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except the frame API, Next's internals (assets, images, the
    // dev server's HMR socket) and static files.
    "/((?!api/frame|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
