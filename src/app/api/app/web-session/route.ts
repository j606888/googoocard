import { NextResponse } from "next/server";
import { decodeAuthToken, generateAuthToken, readBearerToken } from "@/lib/auth";
import { NO_CLASSROOM } from "@/lib/authz";

/**
 * Hands the App's login to its WebView: the WebView's first request is a POST
 * here carrying the App's bearer token, and gets the web cookie plus a 303 to
 * `?next=`. Done this way rather than syncing cookies natively because the
 * WebView's cookie store is separate from the App's, and the cookie is pinned
 * to the classroom the App currently shows — so the App re-enters through here
 * whenever it opens a page for a different classroom.
 */
export async function POST(request: Request) {
  const next = new URL(request.url).searchParams.get("next") ?? "/";
  // Same-origin paths only — never an open redirect.
  const target = /^\/(?!\/)/.test(next) ? next : "/";

  if (!(await readBearerToken())) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  const { userId, classroomId } = await decodeAuthToken();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const response = NextResponse.redirect(new URL(target, request.url), 303);
  response.cookies.set(
    "auth_token",
    generateAuthToken(userId, classroomId === NO_CLASSROOM ? undefined : classroomId),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    }
  );
  return response;
}
