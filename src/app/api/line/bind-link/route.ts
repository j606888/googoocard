import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";
import { generateRandomKey, bindDeepLink } from "@/lib/line";

// Returns a LINE deep link that opens the official-account chat with the
// user's one-time binding key pre-filled. The teacher just taps "send".
export async function GET() {
  const { userId } = await decodeAuthToken();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.lineUserId) {
    return NextResponse.json({ bound: true });
  }

  // Reuse an existing key, or mint a fresh one.
  let key = user.randomKey;
  if (!key) {
    key = generateRandomKey();
    await prisma.user.update({ where: { id: userId }, data: { randomKey: key } });
  }

  return NextResponse.json({ bound: false, key, deepLink: bindDeepLink(key) });
}
