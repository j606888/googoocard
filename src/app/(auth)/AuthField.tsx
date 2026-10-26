"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A labelled text field for the auth pages: label above, boxed input, error below.
 * `type="password"` adds a show/hide toggle.
 */
export default function AuthField({
  label,
  error,
  type = "text",
  className,
  ...inputProps
}: {
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && showPassword ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "w-full min-h-[50px] rounded-xl border-[1.5px] bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-primary-700 focus:ring-2 focus:ring-primary-100",
            isPassword && "pr-13",
            error ? "border-danger-600" : "border-neutral-300"
          )}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-lg text-neutral-500 hover:text-neutral-700 cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
