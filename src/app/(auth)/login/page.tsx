"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { useLoginMutation } from "@/store/slices/me";
import AuthScaffold from "../AuthScaffold";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Field from "@/components/Field";
import { CONTACT_EMAIL } from "@/lib/legal";
import SocialLogin, { type SocialProvider } from "../SocialLogin";

const TITLE = "歡迎回來";
const SUBTITLE = "登入你的教室，繼續今天的課";

type Errors = { email?: React.ReactNode; password?: React.ReactNode };

/** Checks that need no server round-trip; empty object = fine to submit. */
function validate(email: string, password: string): Errors {
  const errors: Errors = {};
  if (!email.trim()) errors.email = "請輸入電子郵件";
  else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "電子郵件格式不太對，再檢查一下";
  if (!password) errors.password = "請輸入密碼";
  return errors;
}

// No reset-by-email flow yet (no mail service): the link mails the operator, who resets it by hand.
function forgotPasswordHref(email: string) {
  const subject = encodeURIComponent("Googoocard 忘記密碼");
  const body = encodeURIComponent(`我的帳號（電子郵件）：${email.trim()}\n請幫我重設密碼，謝謝！`);
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: "Google",
  apple: "Apple",
};
const PROVIDER_BUTTON: Record<SocialProvider, string> = {
  google: "使用 Google 帳戶登入",
  apple: "使用 Apple 繼續",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const token = searchParams.get("token");
  const [login] = useLoginMutation();

  // Show the errors and move focus to the first field that has one.
  const fail = (next: Errors, focus = true) => {
    setErrors(next);
    if (!focus) return;
    (next.email ? emailRef : passwordRef).current?.focus();
  };

  const signupHref = () => {
    const params = new URLSearchParams();
    if (email.trim()) params.set("email", email.trim());
    if (token) params.set("token", token);
    if (redirect) params.set("redirect", redirect);
    const query = params.toString();
    return query ? `/signup?${query}` : "/signup";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSocialProvider(null);

    const invalid = validate(email, password);
    if (Object.keys(invalid).length > 0) return fail(invalid);

    setErrors({});
    setLoading(true);

    try {
      await login({ email: email.trim(), password, token: token ?? undefined }).unwrap();
      router.push(redirect || "/redirect");
    } catch (error) {
      console.error("Login error:", error);
      const data = (error as { data?: { code?: string; provider?: SocialProvider | null } })?.data;
      if (data?.code === "EMAIL_NOT_FOUND") {
        fail({
          email: (
            <>
              這個電子郵件還沒註冊。
              <Link href={signupHref()} className="font-bold text-primary-900 hover:text-primary-700 underline">
                用它建立帳號
              </Link>
            </>
          ),
        });
      } else if (data?.code === "SOCIAL_ONLY") {
        const provider = data.provider ?? null;
        setSocialProvider(provider);
        fail(
          {
            password: provider
              ? `這個帳號是用 ${PROVIDER_LABEL[provider]} 註冊的，請按上方「${PROVIDER_BUTTON[provider]}」`
              : "這個帳號是用 Google 或 Apple 註冊的，請用上方按鈕登入",
          },
          false
        );
      } else if (data?.code === "INVALID_PASSWORD") {
        fail({ password: "密碼不正確，再試一次或按「忘記密碼？」" });
      } else if (data?.code === "RATE_LIMITED") {
        fail({ password: "嘗試太多次了，請 15 分鐘後再試" }, false);
      } else {
        fail({ password: "發生錯誤，請再試一次" }, false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold title={TITLE} subtitle={SUBTITLE} backHref="/">
      <SocialLogin inviteToken={token} redirect={redirect} googleText="signin_with" highlight={socialProvider} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4">
        <Field
          ref={emailRef}
          label="電子郵件"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={errors.email}
        />
        <Field
          ref={passwordRef}
          label="密碼"
          labelAction={
            <a
              href={forgotPasswordHref(email)}
              className="-my-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-primary-900 hover:text-primary-700"
            >
              忘記密碼？
            </a>
          }
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            if (socialProvider) setSocialProvider(null);
          }}
          error={errors.password}
        />

        <div className="mt-auto lg:mt-4 flex flex-col gap-3 pt-4">
          <Button type="submit" size="lg" className="w-full" isLoading={loading}>
            登入
          </Button>
          <p className="text-sm text-neutral-600 text-center">
            還沒有帳號？{" "}
            <Link href={signupHref()} className="font-bold text-primary-900 hover:text-primary-700">
              建立帳號
            </Link>
          </p>
        </div>
      </form>
    </AuthScaffold>
  );
}

function LoginPageFallback() {
  return (
    <AuthScaffold title={TITLE} subtitle={SUBTITLE} backHref="/">
      <div className="flex flex-1 flex-col gap-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="mt-auto lg:mt-4 h-13 rounded-xl" />
      </div>
    </AuthScaffold>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginForm />
    </Suspense>
  );
}
