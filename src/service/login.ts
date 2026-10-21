import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuthSession, generateAppToken } from "@/lib/auth";
import { joinClassroom } from "@/service/classroom";
import type { OAuthIdentity, OAuthProvider } from "@/lib/oauth";

/**
 * 驗完身分之後的共同步驟（Email 密碼登入、Google／Apple 登入都走這裡）：
 * 有邀請 token 就加入教室、決定落腳的教室，網頁發 cookie、App 回 bearer token。
 */
export async function completeLogin(
  request: Request,
  userId: number,
  inviteToken?: string | null
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      // Archived classrooms must not be a landing spot — every consumer of
      // this list treats it as "classrooms this user can enter".
      memberships: {
        where: { classroom: { deletedAt: null } },
        orderBy: { id: "asc" },
      },
    },
  });

  let classroomId: number | null = null;

  if (inviteToken) {
    classroomId = await joinClassroom({ userId: user.id, token: inviteToken });
  }

  // `memberships[0]` used to be read unguarded, so a user with no live
  // membership (signed up via an invite-less flow, or just left their last
  // classroom) got a 500 instead of being sent to onboarding.
  const stillAMember = user.memberships.some(
    (m) => m.classroomId === user.currentClassroomId
  );
  const currentClassroomId =
    classroomId ??
    (stillAMember ? user.currentClassroomId : null) ??
    user.memberships[0]?.classroomId ??
    undefined;

  // The iOS App gets a bearer token in the body instead of a cookie. Its
  // token has no classroom of its own — it follows `currentClassroomId`
  // (see generateAppToken) — so persist the landing classroom there.
  if (request.headers.get("x-googoocard-client") === "app") {
    if ((currentClassroomId ?? null) !== user.currentClassroomId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { currentClassroomId: currentClassroomId ?? null },
      });
    }
    return NextResponse.json({
      message: "Login successful",
      user: { id: user.id, email: user.email },
      token: generateAppToken(user.id),
    });
  }

  await createAuthSession(user.id, currentClassroomId);

  return NextResponse.json({
    message: "Login successful",
    user: {
      id: user.id,
      email: user.email,
    },
  });
}

const SUB_FIELD = { google: "googleSub", apple: "appleSub" } as const;

/**
 * Google／Apple 登入對應到哪個 User：
 * 1. 綁過這個 Google／Apple 帳號的人
 * 2. 同一個 email 的現有帳號 → 順便綁上（email 已由 Google／Apple 驗證過）
 * 3. 都沒有 → 建新帳號（沒有密碼，之後走 onboarding）
 */
export async function findOrCreateOAuthUser(
  provider: OAuthProvider,
  identity: OAuthIdentity,
  name?: string | null
): Promise<number> {
  const field = SUB_FIELD[provider];

  const linked = await prisma.user.findFirst({
    where: { [field]: identity.sub, deletedAt: null },
    select: { id: true },
  });
  if (linked) return linked.id;

  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: identity.email, mode: "insensitive" }, deletedAt: null },
    select: { id: true },
  });
  if (byEmail) {
    await prisma.user.update({ where: { id: byEmail.id }, data: { [field]: identity.sub } });
    return byEmail.id;
  }

  const created = await prisma.user.create({
    data: {
      email: identity.email,
      name: name?.trim() || identity.email.split("@")[0],
      // Not a bcrypt hash, so no password can ever match it.
      password: "!",
      [field]: identity.sub,
    },
    select: { id: true },
  });
  return created.id;
}
