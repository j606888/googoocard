import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

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

export const decodeAuthToken = async () => {
  const { userId, classroomId, exp } = await readAuthSession();

  if (!userId) {
    return {};
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (exp! - nowSeconds < TWO_WEEKS_SECONDS) {
    await createAuthSession(userId, classroomId);
  }
  return { userId, classroomId };
};