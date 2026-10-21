import { NextResponse } from "next/server";
import { decodeAuthToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sessionRoute } from "@/lib/apiRoute";

export async function GET() {
  const { userId } = await decodeAuthToken();

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id, email, name } = user;

  return NextResponse.json({ id, email, name });
}
/**
 * Delete your own account (App Store Guideline 5.1.1(v): an app that creates
 * accounts must let you delete one from inside it).
 *
 * Refused while you still own a live classroom — hand it to an assistant
 * (`POST /api/memberships/[id]/transfer-ownership`) or archive it first, so no
 * classroom is ever left without an owner.
 *
 * The `User` row is **anonymised, not deleted**: `StudentCard.purchasedBy` /
 * `paidBy` and archived classrooms' `ownerId` still point at it, and those are
 * revenue history. Everything that identifies the person or lets them back in
 * is cleared, and the email is freed so it can sign up again.
 */
export const DELETE = sessionRoute(async ({ userId }) => {
  const owned = await prisma.membership.findMany({
    where: { userId, role: "owner", classroom: { deletedAt: null } },
    select: { classroom: { select: { id: true, name: true } } },
  });
  if (owned.length > 0) {
    return NextResponse.json(
      {
        error: "Transfer or archive your classrooms first",
        code: "OWNS_CLASSROOMS",
        classrooms: owned.map((m) => m.classroom),
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.membership.deleteMany({ where: { userId } }),
    prisma.pushToken.deleteMany({ where: { userId } }),
    prisma.webPushSubscription.deleteMany({ where: { userId } }),
    prisma.notificationPreference.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.invalid`,
        name: "已刪除的使用者",
        // Not a bcrypt hash, so no password can ever match it.
        password: "!",
        randomKey: null,
        lineUserId: null,
        // 再用同一個 Google／Apple 帳號登入時，要變成全新的帳號
        googleSub: null,
        appleSub: null,
        currentClassroomId: null,
        deletedAt: new Date(),
      },
    }),
  ]);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "auth_token",
    value: "",
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  return response;
});
