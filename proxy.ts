import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

// /api/cron/ checks its own secret.
const PUBLIC_PATHS = ["/login", "/auth/", "/api/cron/", "/terms", "/privacy"];

/** Refreshes the Supabase session cookie and keeps signed-out visitors on /login. */
export async function proxy(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Verifies the JWT and refreshes it when needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));

  const redirectTo = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };
  if (!signedIn && !isPublic) return redirectTo("/login");
  if (signedIn && path === "/login") return redirectTo("/");
  return response;
}

export const config = {
  matcher: [
    // Everything except build assets, PWA files and images.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|ocr/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
