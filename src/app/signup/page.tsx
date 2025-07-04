"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { validateForm, ValidationErrors } from "@/lib/validation";
import { buildUrlWithParams } from "@/lib/utils";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(false);
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
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ email: data.error });
        return;
      }

      const redirectUrl = buildUrlWithParams('/redirect', { redirect, token });
      router.push(redirectUrl);
    } catch (err) {
      console.error("Signup error:", err);
      setErrors({ email: "An error occurred. Please try again." });
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
          <h2 className="text-[28px] font-semibold mb-4 text-center">
            Sign Up
          </h2>
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Name"
                  className={`w-full border-b-2 ${
                    errors.name ? "border-red-500" : "border-gray-300"
                  } px-1.5 py-3 text-base focus:outline-none`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1 absolute -bottom-5 left-0">
                    {errors.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <input
                  type="email"
                  placeholder="Email"
                  className={`w-full border-b-2 ${
                    errors.email ? "border-red-500" : "border-gray-300"
                  } px-1.5 py-3 text-base focus:outline-none`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1 absolute -bottom-5 left-0">
                    {errors.email}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 relative">
              <Lock className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className={`w-full border-b-2 ${
                    errors.password ? "border-red-500" : "border-gray-300"
                  } px-1.5 py-3 text-base focus:outline-none`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSubmit(e);
                    }
                  }}
                />
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1 absolute -bottom-5 left-0">
                    {errors.password}
                  </p>
                )}
              </div>
              <button className="absolute right-0 top-0 bottom-0 p-3">
                {showPassword ? (
                  <EyeOff className="w-6 h-6 text-gray-500" onClick={() => setShowPassword(false)} />
                ) : (
                  <Eye className="w-6 h-6 text-gray-500" onClick={() => setShowPassword(true)} />
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
            Sign Up
          </button>
          <p className="text-sm text-gray-500 text-center mt-3">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-500 underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
