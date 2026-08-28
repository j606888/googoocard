import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { decodeAuthToken } from "@/lib/auth";
import { ApiError } from "@/lib/apiError";
import { NO_CLASSROOM } from "@/lib/authz";

/**
 * Wrapper for Next.js route handlers that makes the two things we kept getting
 * wrong the default instead of the exception:
 *
 *  1. **Auth is required unless you opt out.** `src/middleware.ts` treats all of
 *     `/api` as public, so before this every handler had to remember to call
 *     `decodeAuthToken()` itself — and eight of them didn't (see docs/roadmap.md
 *     P0). Here a handler only runs once there's a session with a classroom the
 *     caller is still a member of; public endpoints must say `publicApiRoute`
 *     out loud.
 *  2. **Unexpected throws become a clean 500.** Only 7 of 64 routes had a
 *     try/catch, so anything unforeseen surfaced as a framework error page.
 *
 * Handlers receive one context object rather than Next's `(request, segment)`
 * pair, so `params` arrives already awaited and `classroomId` is non-nullable —
 * no more `classroomId!` at every call site.
 */

type Handler<P, R> = (ctx: {
  request: Request;
  params: P;
  userId: number;
  classroomId: number;
  /** The caller's role in `classroomId` — "owner" or "assistant". */
  role: string;
}) => Promise<R>;

type PublicHandler<P, R> = (ctx: { request: Request; params: P }) => Promise<R>;

// Next's generated route typing requires the second argument to be present and
// non-optional, so it's declared required here even though a non-dynamic route
// resolves `params` to `{}`. The runtime still guards with `?.` in case Next
// calls a static route with one argument.
type NextSegment<P> = { params: Promise<P> };

// A handler may return a Response itself, or a plain value to be JSON-encoded.
async function toResponse(result: unknown): Promise<Response> {
  if (result instanceof Response) return result;
  return NextResponse.json(result ?? null);
}

function errorResponse(error: unknown, label: string): Response {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof ZodError) {
    // A rule that's part of the documented API contract (docs/architecture.md's
    // validation matrix) tags its issue with `params.apiCode`, so the response
    // keeps answering with that exact string rather than a generic message.
    // `params` is only present on custom issues, so it isn't part of zod's
    // issue union type — read it through a narrow cast.
    const apiCodeOf = (issue: unknown) =>
      (issue as { params?: { apiCode?: unknown } }).params?.apiCode;
    const code = error.issues.map(apiCodeOf).find((c) => typeof c === "string");
    if (code) {
      return NextResponse.json({ error: code, code }, { status: 400 });
    }

    // Otherwise flatten to `{ field: "message" }` — enough for a form to
    // highlight the offending input without shipping zod's issue tree.
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { error: "Invalid request", code: "VALIDATION_FAILED", fields: fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025 = "record required but not found" (an update/delete that matched
    // nothing), P2002 = unique violation.
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Already exists", code: "CONFLICT" }, { status: 409 });
    }
  }

  // Anything else is a bug. Log it server-side; never let the stack reach the
  // client, since it leaks file paths and query shapes.
  console.error(`[api] ${label} failed`, error);
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

/**
 * Authenticated, classroom-scoped route: 401 unless the caller has a session
 * with a classroom they are still a member of.
 *
 * `decodeAuthToken` does the membership re-check and reports `NO_CLASSROOM`
 * when it fails, so leaving, being removed, and archiving all take effect on
 * the next request. It also hands back the caller's `role`, so owner-only
 * routes need no query of their own.
 *
 * Not for the routes a user must reach *without* a live classroom — listing
 * their classrooms, creating one, switching between them. Those guard
 * themselves, or a stale JWT would lock them out of their own recovery path.
 */
export function apiRoute<P = Record<string, never>, R = unknown>(handler: Handler<P, R>) {
  return async (request: Request, segment: NextSegment<P>): Promise<Response> => {
    const label = `${request.method} ${new URL(request.url).pathname}`;
    try {
      const { userId, classroomId, role } = await decodeAuthToken();
      if (!userId || !classroomId || classroomId === NO_CLASSROOM) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
      }

      const params = ((await segment?.params) ?? {}) as P;
      return await toResponse(
        // `role` is only absent when the membership lookup was skipped, which
        // the guard above already ruled out.
        await handler({ request, params, userId, classroomId, role: role ?? "assistant" })
      );
    } catch (error) {
      return errorResponse(error, label);
    }
  };
}

/**
 * Unauthenticated route — login/signup, the LINE webhook, LIFF endpoints (which
 * verify a LINE ID token instead) and the walk-in QR check-in pages (which are
 * gated by the classroom key in the URL). Still gets the error handling.
 *
 * Use this deliberately: it is the opt-out from `apiRoute`'s auth.
 */
export function publicApiRoute<P = Record<string, never>, R = unknown>(
  handler: PublicHandler<P, R>
) {
  return async (request: Request, segment: NextSegment<P>): Promise<Response> => {
    const label = `${request.method} ${new URL(request.url).pathname}`;
    try {
      const params = ((await segment?.params) ?? {}) as P;
      return await toResponse(await handler({ request, params }));
    } catch (error) {
      return errorResponse(error, label);
    }
  };
}

/**
 * Parse a path segment as a positive integer id.
 *
 * There were 52 bare `parseInt(id)` calls, none NaN-guarded — `/api/students/abc`
 * reached Prisma as NaN and threw, answering 500 for what is a client mistake.
 */
export function parseId(raw: string | undefined, what = "id"): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, "INVALID_ID", `Invalid ${what}`);
  }
  return value;
}

/** Parse and validate a JSON body, throwing ZodError (→ 400) on mismatch. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(raw);
}

/** Parse and validate query params from the request URL. */
export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return schema.parse(params);
}
