import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional HTTP Basic Auth gate for the demo deployment (enabled when both
 * BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are set). A real product would use
 * proper auth (e.g. Supabase Auth / SSO) with per-agent accounts and roles.
 */
const USER = process.env.BASIC_AUTH_USER;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;

/** Constant-time comparison; hashing first equalises lengths. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function isAuthorized(header: string | null): boolean {
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  if (sep === -1) return false;
  const user = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);
  // Evaluate both comparisons to avoid leaking which part was wrong via timing.
  const userOk = safeEqual(user, USER ?? "");
  const passwordOk = safeEqual(password, PASSWORD ?? "");
  return userOk && passwordOk;
}

export function proxy(request: NextRequest) {
  if (!USER || !PASSWORD) return NextResponse.next();
  if (isAuthorized(request.headers.get("authorization"))) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Mini AI Support Inbox", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except static assets, the health check and the Sentry tunnel route.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|monitoring).*)"],
};
