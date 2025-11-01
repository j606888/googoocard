import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export const generateAuthToken = (userId: number, classroomId?: number) => {
  return jwt.sign({ userId, classroomId }, JWT_SECRET, { expiresIn: "7d" });
};

export const setAuthCookie = async (token: string) => {
  const cookieStore = await cookies();
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });
};

export const createAuthSession = async (userId: number, classroomId?: number) => {
  const token = generateAuthToken(userId, classroomId);
  await setAuthCookie(token);
  return token;
};

export const decodeAuthToken = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return {};
  }

  const { userId, classroomId } = jwt.verify(token, JWT_SECRET) as { userId: number, classroomId: number };
  return { userId, classroomId };
};