"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { validateForm, ValidationErrors } from "@/lib/validation";
import { useSignupMutation } from "@/store/slices/me";
import AuthScaffold, { authPrimaryButton } from "../AuthScaffold";
import AuthField from "../AuthField";
import SocialLogin from "../SocialLogin";

const TITLE = "建立你的帳號";
const SUBTITLE = "免費開始，下一步再建立教室";

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [signup] = useSignupMutation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const redirect = searchParams.get("redirect");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm({ name, email, password });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      await signup({ name, email, password, token: token ?? undefined }).unwrap();

      router.push(redirect || "/redirect");
    } catch (err) {
      console.error("Signup error:", err);
      setErrors({ email: "發生錯誤，請再試一次。" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold title={TITLE} subtitle={SUBTITLE} backHref="/">
      <SocialLogin inviteToken={token} redirect={redirect} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4">
        <AuthField
          label="你的名字"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <AuthField
          label="電子郵件"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <AuthField
          label="密碼"
          type="password"
          autoComplete="new-password"
          placeholder="至少 8 個字元"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <div className="mt-auto lg:mt-4 flex flex-col gap-3 pt-4">
          <button type="submit" disabled={loading} className={authPrimaryButton}>
            建立帳號
          </button>
          <p className="text-xs text-neutral-500 text-center">
            建立帳號即表示同意{" "}
            <Link href="/terms" className="underline hover:text-neutral-700">服務條款</Link>
            {" "}與{" "}
            <Link href="/privacy" className="underline hover:text-neutral-700">隱私權政策</Link>
          </p>
          <p className="text-sm text-neutral-600 text-center">
            已經有帳號？{" "}
            <Link href="/login" className="font-bold text-primary-900 hover:text-primary-700">
              登入
            </Link>
          </p>
        </div>
      </form>
    </AuthScaffold>
  );
}


export default function SignupPage() {
  return (
    <Suspense fallback={<div>載入中…</div>}>
      <SignupForm />
    </Suspense>
  );
}
