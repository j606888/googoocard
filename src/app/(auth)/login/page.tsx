"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLoginMutation } from "@/store/slices/me";
import AuthScaffold from "../AuthScaffold";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Field from "@/components/Field";
import SocialLogin from "../SocialLogin";

const TITLE = "歡迎回來";
const SUBTITLE = "登入你的教室，繼續今天的課";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"email" | "password">("password");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const token = searchParams.get("token");
  const [login] = useLoginMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      await login({ email, password, token: token ?? undefined }).unwrap();
      router.push(redirect || "/redirect");
    } catch (error) {
      console.error("Login error:", error);
      const code = (error as { data?: { code?: string } })?.data?.code;
      if (code === "EMAIL_NOT_FOUND") {
        setError("這個 Email 還沒註冊");
        setErrorField("email");
      } else if (code === "SOCIAL_ONLY") {
        setError("這個帳號是用 Google 或 Apple 註冊的，請用上方按鈕登入");
        setErrorField("password");
      } else if (code === "INVALID_PASSWORD") {
        setError("密碼不正確");
        setErrorField("password");
      } else {
        setError("發生錯誤，請再試一次");
        setErrorField("password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold title={TITLE} subtitle={SUBTITLE} backHref="/">
      <SocialLogin inviteToken={token} redirect={redirect} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4">
        <Field
          label="電子郵件"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errorField === "email" ? error : undefined}
        />
        <Field
          label="密碼"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errorField === "password" ? error : undefined}
        />

        <div className="mt-auto lg:mt-4 flex flex-col gap-3 pt-4">
          <Button type="submit" size="lg" className="w-full" isLoading={loading}>
            登入
          </Button>
          <p className="text-sm text-neutral-600 text-center">
            還沒有帳號？{" "}
            <Link href="/signup" className="font-bold text-primary-900 hover:text-primary-700">
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
