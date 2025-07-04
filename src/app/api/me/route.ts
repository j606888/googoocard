import { NextResponse } from "next/server";
import { decodeAuthToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const { userId } = await decodeAuthToken();
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id, email, name } = user;

  return NextResponse.json({ id, email, name });
}