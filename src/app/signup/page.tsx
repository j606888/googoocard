"use client";

import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string) => {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
  }

  return "";
};

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError && validateEmail(e.target.value)) {
      setEmailError("");
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (validatePassword(password) !== "") {
      setPasswordError(validatePassword(password));
      return;
    }

    const response = await fetch("/api/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();
    console.log("success");
    console.log(data);
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
            Sign up
          </h2>
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-gray-500" />
              <input
                type="text"
                placeholder="Name"
                className="w-full border-b-2 border-gray-300 px-1.5 py-3 text-base focus:outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <input
                  type="email"
                  placeholder="Email"
                  className={`w-full border-b-2 border-gray-300 px-1.5 py-3 text-base focus:outline-none ${
                    emailError ? "border-red-500" : ""
                  }`}
                  value={email}
                  onChange={handleEmailChange}
                />
                {emailError && (
                  <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                    {emailError}
                  </p>
                )}
              </div>
            </div>
            <div className="relative flex items-center gap-3">
              <Lock className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full border-b-2 border-gray-300 px-1.5 py-3 text-base focus:outline-none"
                  value={password}
                  onChange={handlePasswordChange}
                />
                {passwordError && (
                  <p className="text-red-500 text-xs absolute -bottom-5 left-0">
                    {passwordError}
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
            className="bg-primary-500 w-full text-white px-4 py-3 rounded-md font-bold text-lg"
            onClick={handleSubmit}
          >
            Sign up
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
