import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { NO_CLASSROOM } from "@/lib/authz";

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

export const createAuthSession = async (userId: number, classroomId?: number) => {
  const token = generateAuthToken(userId, classroomId);
  await setAuthCookie(token);
  return token;
};

type AuthSession = {
  userId?: number;
  classroomId?: number;
  exp?: number;
};

/**
 * Read + verify the auth cookie without any side effect.
 * Safe to call from a Server Component (unlike decodeAuthToken, which may
 * re-set the cookie — writing cookies during render throws in Next 15).
 */
export const readAuthSession = async (): Promise<AuthSession> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return {};
  }

  try {
    const { userId, classroomId, exp } = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      classroomId?: number;
      exp: number;
    };
    return { userId, classroomId, exp };
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
 * When there is no live classroom, `classroomId` comes back as `NO_CLASSROOM`
 * rather than `undefined` — see the constant for why that distinction matters.
 */
export const decodeAuthToken = async (): Promise<{
  userId?: number;
  classroomId: number;
  role?: string;
}> => {
  const { userId, classroomId, exp } = await readAuthSession();

  if (!userId) {
    return { classroomId: NO_CLASSROOM };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (exp! - nowSeconds < TWO_WEEKS_SECONDS) {
    await createAuthSession(userId, classroomId);
  }

  if (!classroomId) {
    return { userId, classroomId: NO_CLASSROOM };
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, classroomId, classroom: { deletedAt: null } },
    select: { role: true },
  });

  if (!membership) {
    return { userId, classroomId: NO_CLASSROOM };
  }

  return { userId, classroomId, role: membership.role };
};