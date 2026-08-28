"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { validateForm, ValidationErrors } from "@/lib/validation";
import { useSignupMutation } from "@/store/slices/me";
import AuthScaffold from "../AuthScaffold";

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthScaffold
      heroTitle={
        <>
          還在用紙本課程卡嗎？
          <br />
          現在就把它丟掉吧！
        </>
      }
    >
      <div className="w-full">
        <h2 className="text-[28px] font-semibold mb-4 text-center">註冊</h2>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-neutral-500" />
            <div className="relative w-full">
              <input
                type="text"
                placeholder="姓名"
                className={`w-full border-b-2 ${
                  errors.name ? "border-danger-500" : "border-neutral-300"
                } px-1.5 py-3 text-base focus:outline-none focus:border-primary-500`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && (
                <p className="text-danger-500 text-sm mt-1 absolute -bottom-5 left-0">
                  {errors.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-neutral-500" />
            <div className="relative w-full">
              <input
                type="email"
                placeholder="電子郵件"
                className={`w-full border-b-2 ${
                  errors.email ? "border-danger-500" : "border-neutral-300"
                } px-1.5 py-3 text-base focus:outline-none focus:border-primary-500`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && (
                <p className="text-danger-500 text-sm mt-1 absolute -bottom-5 left-0">
                  {errors.email}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 relative">
            <Lock className="w-6 h-6 text-neutral-500" />
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="密碼"
                className={`w-full border-b-2 ${
                  errors.password ? "border-danger-500" : "border-neutral-300"
                } px-1.5 py-3 text-base focus:outline-none focus:border-primary-500`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit(e);
                  }
                }}
              />
              {errors.password && (
                <p className="text-danger-500 text-sm mt-1 absolute -bottom-5 left-0">
                  {errors.password}
                </p>
              )}
            </div>
            <button className="absolute right-0 top-0 bottom-0 p-3 cursor-pointer">
              {showPassword ? (
                <EyeOff className="w-6 h-6 text-neutral-500" onClick={() => setShowPassword(false)} />
              ) : (
                <Eye className="w-6 h-6 text-neutral-500" onClick={() => setShowPassword(true)} />
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
          註冊
        </button>
        <p className="text-sm text-neutral-500 text-center mt-3">
          已經有帳號了嗎？{" "}
          <Link href="/login" className="text-primary-500 underline">
            登入
          </Link>
        </p>
      </div>
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
