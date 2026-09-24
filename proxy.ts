import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

// /api/cron/ checks its own secret.
const PUBLIC_PATHS = ["/login", "/auth/", "/api/cron/"];

/**
 * Per-request Content-Security-Policy. Next.js reads the nonce from the
 * request's CSP header and adds it to its own scripts (pages must render
 * dynamically — see app/layout.tsx). Inline `style` attributes are allowed
 * because React components set colours and sizes through them.
 */
function contentSecurityPolicy(nonce: string, supabaseUrl: string) {
  const dev = process.env.NODE_ENV === "development";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Only when everything is on HTTPS (local Supabase runs on plain http).
  if (!dev && supabaseUrl.startsWith("https://")) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** Refreshes the Supabase session cookie, keeps signed-out visitors on /login, and sets the CSP. */
export async function proxy(request: NextRequest) {
  const { url, key } = supabaseEnv();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, url);

  // Rebuilt after Supabase refreshes cookies, so the page sees both the new session and the nonce.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = forward();
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
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except build assets, PWA files and images.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
