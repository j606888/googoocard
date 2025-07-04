"use client";

import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

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
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/redirect?redirect=${redirect}`);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center left-0 right-0 top-0 bottom-0 absolute bg-primary-500 overflow-hidden">
      <div className="relative w-full flex items-center justify-center h-[40vh]">
        <h2 className="text-white text-center text-2xl font-semibold">
          Still using the Lesson Card?
          <br />
          Throw it right away!
        </h2>
        <div className="w-30 h-30 rounded-full bg-primary-50 absolute -bottom-15 -left-15"></div>
        <div className="w-30 h-30 rounded-full bg-primary-50 absolute -top-15 -right-15"></div>
      </div>
      <div className="h-[60vh] bg-white rounded-t-3xl w-full p-6 flex flex-col items-center z-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="w-full">
          <h2 className="text-[28px] font-semibold mb-4 text-center">Login</h2>
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full border-b-2 border-gray-300 px-1.5 py-3 text-base focus:outline-none"
                  value={email}
                  onChange={handleEmailChange}
                />
              </div>
            </div>
            <div className="relative flex items-center gap-3">
              <Lock className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className={`w-full border-b-2 ${
                    error ? "border-red-500" : "border-gray-300"
                  } px-1.5 py-3 text-base focus:outline-none`}
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSubmit(e);
                    }
                  }}
                />
                {error && (
                  <p className="text-red-500 text-sm mt-1 absolute -bottom-5 left-0">
                    {error}
                  </p>
                )}
              </div>
              <button className="absolute right-0 top-0 bottom-0 p-3">
                {showPassword ? (
                  <EyeOff
                    className="w-6 h-6 text-gray-500"
                    onClick={() => setShowPassword(false)}
                  />
                ) : (
                  <Eye
                    className="w-6 h-6 text-gray-500"
                    onClick={() => setShowPassword(true)}
                  />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-auto w-full">
          <button
            className={`bg-primary-500 w-full text-white px-4 py-3 rounded-md font-bold text-lg ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={loading}
            onClick={handleSubmit}
          >
            Login
          </button>
          <p className="text-sm text-gray-500 text-center mt-3">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary-500 underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginPageFallback() {
  return (
    <div className="flex flex-col items-center justify-center left-0 right-0 top-0 bottom-0 absolute bg-primary-500 overflow-hidden">
      <div className="relative w-full flex items-center justify-center h-[40vh]">
        <h2 className="text-white text-center text-2xl font-semibold">
          Still using the Lesson Card?
          <br />
          Throw it right away!
        </h2>
        <div className="w-30 h-30 rounded-full bg-primary-50 absolute -bottom-15 -left-15"></div>
        <div className="w-30 h-30 rounded-full bg-primary-50 absolute -top-15 -right-15"></div>
      </div>
      <div className="h-[60vh] bg-white rounded-t-3xl w-full p-6 flex flex-col items-center z-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="w-full">
          <h2 className="text-[28px] font-semibold mb-4 text-center">Login</h2>
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <div className="w-full border-b-2 border-gray-300 px-1.5 py-3 text-base bg-gray-50 animate-pulse h-6"></div>
              </div>
            </div>
            <div className="flex items-center gap-3 relative">
              <Lock className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <div className="w-full border-b-2 border-gray-300 px-1.5 py-3 text-base bg-gray-50 animate-pulse h-6"></div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto w-full">
          <div className="bg-gray-200 w-full px-4 py-3 rounded-md animate-pulse h-12"></div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginForm />
    </Suspense>
  );
}
