import { NextResponse } from "next/server";
import { verifyIdToken, type OAuthProvider } from "@/lib/oauth";
import { completeLogin, findOrCreateOAuthUser } from "@/service/login";
import { exchangeAppleCode } from "@/lib/appleAuth";
import prisma from "@/lib/prisma";

// Google／Apple 登入（網頁和 App 共用）。body: { provider, idToken, name?, code?, token? }
// name 只有 Apple 第一次授權時會給（不在 ID token 裡），token 是教室邀請。
// code 是 Apple 的 authorization code：換成 refresh token 存起來，刪帳號時拿去撤銷授權。
export async function POST(request: Request) {
  try {
    const { provider, idToken, name, code, token } = await request.json();

    if ((provider !== "google" && provider !== "apple") || typeof idToken !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const identity = await verifyIdToken(provider as OAuthProvider, idToken);
    if (!identity) {
      return NextResponse.json(
        { error: "Invalid ID token", code: "INVALID_ID_TOKEN" },
        { status: 401 }
      );
    }

    const userId = await findOrCreateOAuthUser(
      provider,
      identity,
      typeof name === "string" ? name : null
    );

    if (provider === "apple" && typeof code === "string" && code) {
      const refreshToken = await exchangeAppleCode(code, identity.audience);
      if (refreshToken) {
        await prisma.user.update({
          where: { id: userId },
          data: { appleRefreshToken: refreshToken, appleClientId: identity.audience },
        });
      }
    }

    return completeLogin(request, userId, typeof token === "string" ? token : null);
  } catch (error) {
    console.error("OAuth login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
