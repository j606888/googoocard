import { NextResponse } from "next/server";
import { verifyIdToken, type OAuthProvider } from "@/lib/oauth";
import { completeLogin, findOrCreateOAuthUser } from "@/service/login";

// Google／Apple 登入（網頁和 App 共用）。body: { provider, idToken, name?, token? }
// name 只有 Apple 第一次授權時會給（不在 ID token 裡），token 是教室邀請。
export async function POST(request: Request) {
  try {
    const { provider, idToken, name, token } = await request.json();

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
    return completeLogin(request, userId, typeof token === "string" ? token : null);
  } catch (error) {
    console.error("OAuth login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
