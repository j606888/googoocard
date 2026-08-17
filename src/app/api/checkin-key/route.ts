import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import prisma from "@/lib/prisma";
import { decodeAuthToken } from "@/lib/auth";

// The wall-poster check-in key for the caller's current classroom.
// Longer than the usual nanoid(8) share keys because this one gets printed and
// photographed; rotating it (POST) is the remedy when a poster leaks.
const KEY_LENGTH = 10;

// The QR encodes an absolute URL, so fall back to the request origin when
// NEXT_PUBLIC_HOST_URL isn't configured — a relative path would be unscannable.
function buildUrl(request: Request, key: string) {
  const host = process.env.NEXT_PUBLIC_HOST_URL || new URL(request.url).origin;
  return `${host}/checkin/${key}`;
}

// GET — returns the classroom's key, creating one on first view so teachers
// never have to "enable" the feature.
export async function GET(request: Request) {
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { name: true, checkinKey: true },
  });
  if (!classroom) {
    return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  }

  let key = classroom.checkinKey;
  if (!key) {
    key = nanoid(KEY_LENGTH);
    await prisma.classroom.update({
      where: { id: classroomId },
      data: { checkinKey: key },
    });
  }

  return NextResponse.json({
    classroomName: classroom.name,
    key,
    url: buildUrl(request, key),
  });
}

// POST — rotate: the old poster's URL stops working immediately.
export async function POST(request: Request) {
  const { classroomId } = await decodeAuthToken();
  if (!classroomId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = nanoid(KEY_LENGTH);
  const classroom = await prisma.classroom.update({
    where: { id: classroomId },
    data: { checkinKey: key },
    select: { name: true },
  });

  return NextResponse.json({
    classroomName: classroom.name,
    key,
    url: buildUrl(request, key),
  });
}
