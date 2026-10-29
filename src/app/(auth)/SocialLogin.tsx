"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useOauthLoginMutation } from "@/store/slices/me";

// 網頁版 Google／Apple 登入：兩家的官方 JS 都在瀏覽器拿到 ID token，丟給 /api/auth/oauth。
// 沒設 client ID 的那一家就不顯示按鈕。
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const APPLE_SERVICE_ID = process.env.NEXT_PUBLIC_APPLE_SERVICE_ID;

type GoogleId = {
  initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
type AppleSignInResponse = {
  authorization: { id_token: string; code: string };
  user?: { name?: { firstName?: string; lastName?: string } };
};
type AppleIdAuth = {
  init: (opts: Record<string, unknown>) => void;
  signIn: () => Promise<AppleSignInResponse>;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
    AppleID?: { auth: AppleIdAuth };
  }
}

export type SocialProvider = "google" | "apple";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded) return resolve();
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => {
      script.dataset.loaded = "1";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export default function SocialLogin({
  inviteToken,
  redirect,
  googleText = "continue_with",
  highlight,
}: {
  inviteToken?: string | null;
  redirect?: string | null;
  /** Wording of Google's own button (GSI `text`): 使用 Google 帳戶登入／透過 Google 帳戶繼續操作… */
  googleText?: "signin_with" | "continue_with" | "signup_with";
  /** Ring the button the user should press (the login page's SOCIAL_ONLY answer). */
  highlight?: SocialProvider | null;
}) {
  const router = useRouter();
  const [oauthLogin] = useOauthLoginMutation();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);

  const submit = async (provider: "google" | "apple", idToken: string, name?: string, code?: string) => {
    setError("");
    setLoading(true);
    try {
      await oauthLogin({ provider, idToken, name, code, token: inviteToken ?? undefined }).unwrap();
      router.push(redirect || "/redirect");
    } catch (e) {
      console.error("OAuth login error:", e);
      setError("登入失敗，請再試一次");
      setLoading(false);
    }
  };
  // The Google callback is registered once; keep it pointing at the latest `submit`.
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadScript("https://accounts.google.com/gsi/client")
      .then(() => {
        const el = googleRef.current;
        if (cancelled || !el || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => void submitRef.current("google", credential),
        });
        window.google.accounts.id.renderButton(el, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          logo_alignment: "center",
          text: googleText,
          locale: "zh-TW",
          width: Math.min(el.offsetWidth || 400, 400),
        });
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [googleText]);

  useEffect(() => {
    if (!APPLE_SERVICE_ID) return;
    loadScript(
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/zh_TW/appleid.auth.js"
    )
      .then(() => {
        window.AppleID?.auth.init({
          clientId: APPLE_SERVICE_ID,
          scope: "name email",
          // 必須跟 Apple Services ID 登記的 Return URL 一樣；popup 模式不會真的跳過去
          redirectURI: `${window.location.origin}/login`,
          usePopup: true,
        });
      })
      .catch(console.error);
  }, []);

  const signInWithApple = async () => {
    if (!window.AppleID) return;
    try {
      const res = await window.AppleID.auth.signIn();
      const n = res.user?.name;
      const name = [n?.lastName, n?.firstName].filter(Boolean).join("") || undefined;
      await submit("apple", res.authorization.id_token, name, res.authorization.code);
    } catch (e) {
      // 使用者自己關掉視窗不算錯
      if ((e as { error?: string })?.error !== "popup_closed_by_user") {
        console.error("Apple sign-in error:", e);
        setError("Apple 登入失敗，請再試一次");
      }
    }
  };

  if (!GOOGLE_CLIENT_ID && !APPLE_SERVICE_ID) return null;

  return (
    // Google 不允許在 App 的 WebView 裡登入；App 有自己的原生登入
    <div data-in-app="hide" className={`w-full ${loading ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex flex-col gap-2.5">
        {GOOGLE_CLIENT_ID && (
          // Google's own button (GSI renders it into this div); only its size and shape are ours.
          <div
            ref={googleRef}
            className={`w-full flex justify-center min-h-[44px] rounded-md transition-shadow ${
              highlight === "google" ? "ring-[3px] ring-primary-300" : ""
            }`}
          />
        )}
        {APPLE_SERVICE_ID && (
          <button
            type="button"
            onClick={signInWithApple}
            // Apple's white-with-outline style, so it sits level with Google's outline button
            // instead of out-weighing the form's own primary button.
            className={`w-full min-h-[44px] rounded-[4px] border border-neutral-900 bg-white text-neutral-900 text-sm font-medium flex items-center justify-center gap-2.5 cursor-pointer hover:bg-neutral-50 transition-shadow ${
              highlight === "apple" ? "ring-[3px] ring-primary-300" : ""
            }`}
          >
            <svg viewBox="0 0 17 20" className="w-4 h-4 fill-current" aria-hidden>
              <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
            </svg>
            使用 Apple 繼續
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-danger-700 text-sm text-center mt-3">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 my-5 text-[13px] text-neutral-500">
        <div className="h-px flex-1 bg-neutral-200" />
        或用電子郵件
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
    </div>
  );
}
