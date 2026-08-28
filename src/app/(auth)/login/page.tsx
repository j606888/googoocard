"use client";

import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLoginMutation } from "@/store/slices/me";
import AuthScaffold from "../AuthScaffold";

const HERO_TITLE = (
  <>
    還在用紙本課程卡嗎？
    <br />
    現在就把它丟掉吧！
  </>
);

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"email" | "password">("password");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const token = searchParams.get("token");
  const [login] = useLoginMutation();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

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
        setError("This email is not registered");
        setErrorField("email");
      } else if (code === "INVALID_PASSWORD") {
        setError("Incorrect password");
        setErrorField("password");
      } else {
        setError("Something went wrong. Please try again");
        setErrorField("password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold heroTitle={HERO_TITLE}>
      <div className="w-full">
        <h2 className="text-[28px] font-semibold mb-4 text-center">登入</h2>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-neutral-500" />
            <div className="relative w-full">
              <input
                type="email"
                placeholder="電子郵件"
                className={`w-full border-b-2 ${
                  error && errorField === "email"
                    ? "border-danger-500"
                    : "border-neutral-300"
                } px-1.5 py-3 text-base focus:outline-none focus:border-primary-500`}
                value={email}
                onChange={handleEmailChange}
              />
              {error && errorField === "email" && (
                <p className="text-danger-500 text-sm mt-1 absolute -bottom-5 left-0">
                  {error}
                </p>
              )}
            </div>
          </div>
          <div className="relative flex items-center gap-3">
            <Lock className="w-6 h-6 text-neutral-500" />
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="密碼"
                className={`w-full border-b-2 ${
                  error && errorField === "password"
                    ? "border-danger-500"
                    : "border-neutral-300"
                } px-1.5 py-3 text-base focus:outline-none focus:border-primary-500`}
                value={password}
                onChange={handlePasswordChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit(e);
                  }
                }}
              />
              {error && errorField === "password" && (
                <p className="text-danger-500 text-sm mt-1 absolute -bottom-5 left-0">
                  {error}
                </p>
              )}
            </div>
            <button className="absolute right-0 top-0 bottom-0 p-3 cursor-pointer">
              {showPassword ? (
                <EyeOff
                  className="w-6 h-6 text-neutral-500"
                  onClick={() => setShowPassword(false)}
                />
              ) : (
                <Eye
                  className="w-6 h-6 text-neutral-500"
                  onClick={() => setShowPassword(true)}
                />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-auto lg:mt-10 w-full">
        <button
          className={`bg-primary-500 w-full text-white px-4 py-3 rounded-md font-bold text-lg cursor-pointer hover:bg-primary-600 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={loading}
          onClick={handleSubmit}
        >
          登入
        </button>
        <p className="text-sm text-neutral-500 text-center mt-3">
          還沒有帳號嗎？{" "}
          <Link href="/signup" className="text-primary-500 underline">
            註冊
          </Link>
        </p>
      </div>
    </AuthScaffold>
  );
}

function LoginPageFallback() {
  return (
    <AuthScaffold heroTitle={HERO_TITLE}>
      <div className="w-full">
        <h2 className="text-[28px] font-semibold mb-4 text-center">登入</h2>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-neutral-500" />
            <div className="relative w-full">
              <div className="w-full border-b-2 border-neutral-300 px-1.5 py-3 text-base bg-neutral-50 animate-pulse h-6"></div>
            </div>
          </div>
          <div className="flex items-center gap-3 relative">
            <Lock className="w-6 h-6 text-neutral-500" />
            <div className="relative w-full">
              <div className="w-full border-b-2 border-neutral-300 px-1.5 py-3 text-base bg-neutral-50 animate-pulse h-6"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto lg:mt-10 w-full">
        <div className="bg-neutral-200 w-full px-4 py-3 rounded-md animate-pulse h-12"></div>
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
