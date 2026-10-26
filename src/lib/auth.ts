import { cookies, headers } from "next/headers";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { NO_CLASSROOM } from "@/lib/authz";
import { findMembershipAccess } from "@/lib/access";

const TWO_WEEKS_SECONDS = 14 * 24 * 60 * 60;
const JWT_SECRET = process.env.JWT_SECRET!;

export const generateAuthToken = (userId: number, classroomId?: number) => {
  return jwt.sign({ userId, classroomId }, JWT_SECRET, { expiresIn: "30d" });
};

export const setAuthCookie = async (token: string) => {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
};

/**
 * The iOS App's token (`Authorization: Bearer`). Carries no `classroomId`: the
 * App and its WebView share one "current classroom", so `decodeAuthToken` reads
 * `User.currentClassroomId` instead — switching classroom inside the WebView
 * (which updates that column) is then seen by the App's native screens too.
 */
export const generateAppToken = (userId: number) => {
  return jwt.sign({ userId, app: true }, JWT_SECRET, { expiresIn: "30d" });
};

export const createAuthSession = async (userId: number, classroomId?: number) => {
  const token = generateAuthToken(userId, classroomId);
  await setAuthCookie(token);
  return token;
};

type AuthSession = {
  userId?: number;
  classroomId?: number;
  exp?: number;
  /** Came from the App's bearer token rather than the web cookie. */
  app?: boolean;
};

/** The bearer token, if this request sent one (the iOS App does; browsers don't). */
export const readBearerToken = async (): Promise<string | undefined> => {
  const authorization = (await headers()).get("authorization");
  const match = authorization?.match(/^Bearer (.+)$/);
  return match?.[1];
};

/**
 * Read + verify the auth cookie without any side effect.
 * Safe to call from a Server Component (unlike decodeAuthToken, which may
 * re-set the cookie — writing cookies during render throws in Next 15).
 */
export const readAuthSession = async (): Promise<AuthSession> => {
  const bearer = await readBearerToken();
  const token = bearer ?? (await cookies()).get("auth_token")?.value;

  if (!token) {
    return {};
  }

  try {
    const { userId, classroomId, exp, app } = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      classroomId?: number;
      exp: number;
      app?: boolean;
    };
    // Only an App token may arrive as a bearer: a web cookie's JWT pinned to
    // a classroom shouldn't be replayable from outside the browser either.
    if (bearer && !app) return {};
    return { userId, classroomId, exp, app: bearer ? true : undefined };
  } catch {
    console.error("Error decoding auth token");
    return {};
  }
};

/**
 * The session every API handler runs on: verifies the cookie, slides its expiry,
 * and — crucially — re-checks that `classroomId` from the JWT is still a
 * classroom this user belongs to.
 *
 * That last step is what makes leaving a classroom, being removed from one, and
 * archiving one take effect on the very next request. The token itself lives 30
 * days and cannot be revoked, so without re-reading `Membership` a removed
 * assistant would keep full access for a month. It costs one indexed lookup
 * (`@@unique([userId, classroomId])`) per request.
 *
 * The same query brings back the member's permission overrides and the
 * classroom's modules, which `apiRoute` turns into `permissions`
 * (src/lib/permissions.ts).
 *
 * When there is no live classroom, `classroomId` comes back as `NO_CLASSROOM`
 * rather than `undefined` — see the constant for why that distinction matters.
 */
export const decodeAuthToken = async (): Promise<{
  userId?: number;
  classroomId: number;
  role?: string;
  grants?: string[];
  revokes?: string[];
  modules?: string[];
}> => {
  const session = await readAuthSession();
  const { userId, exp } = session;
  let { classroomId } = session;

  if (!userId) {
    return { classroomId: NO_CLASSROOM };
  }

  if (session.app) {
    // The App refreshes its own token (POST /api/app/token), so no cookie here.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentClassroomId: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return { classroomId: NO_CLASSROOM };
    classroomId = user.currentClassroomId ?? undefined;
  } else {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (exp! - nowSeconds < TWO_WEEKS_SECONDS) {
      await createAuthSession(userId, classroomId);
    }
  }

  if (!classroomId) {
    return (await isDeletedUser(userId))
      ? { classroomId: NO_CLASSROOM }
      : { userId, classroomId: NO_CLASSROOM };
  }

  const access = await findMembershipAccess(userId, classroomId);

  if (!access) {
    return (await isDeletedUser(userId))
      ? { classroomId: NO_CLASSROOM }
      : { userId, classroomId: NO_CLASSROOM };
  }

  return { userId, classroomId, ...access };
};
/**
 * A deleted account has no memberships left (DELETE /api/me removes them), so
 * every one of its requests lands on the classroom-less paths above — the only
 * place this extra lookup runs. Without it, a JWT still sitting on another
 * device would keep working for the `sessionRoute` endpoints (create a
 * classroom, accept an invite, register a push token) for up to 30 days.
 */
async function isDeletedUser(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletedAt: true },
  });
  return !user || user.deletedAt !== null;
}
