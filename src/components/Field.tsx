"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The boxed control look shared by every text input, select trigger, date/time trigger and
 * textarea (docs/design-system.md「輸入框」): white, 1.5px neutral-300 border, radius 14,
 * primary-700 border + primary-100 glow on focus (`focus-within` too, for a box wrapping an input), danger-600 border on error
 * (danger-100 glow when an erroring control has focus, so moving focus to it doesn't hide the error).
 * Height is the caller's (`h-12` for single-line controls).
 */
export const fieldControlClass = (error?: boolean) =>
  cn(
    "w-full rounded-xl border-[1.5px] bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors focus:border-primary-700 focus:ring-[3px] focus:ring-primary-100 focus-within:border-primary-700 focus-within:ring-[3px] focus-within:ring-primary-100 disabled:bg-neutral-50 disabled:text-neutral-500",
    error
      ? "border-danger-600 focus:border-danger-600 focus:ring-danger-100 focus-within:border-danger-600 focus-within:ring-danger-100"
      : "border-neutral-300"
  );

/** Label above a control; `hint` is the grey 「（選填）」-style suffix. */
export function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-900">
      {children}
      {hint && <span className="ml-1 font-normal text-neutral-500">{hint}</span>}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-[13px] text-danger-700">
      {children}
    </p>
  );
}

/**
 * A labelled text field: label above, boxed input, error below.
 * `type="password"` adds a show/hide toggle; `labelAction` sits at the right end of the label row.
 */
export default function Field({
  ref,
  label,
  labelAction,
  hint,
  error,
  type = "text",
  className,
  ...inputProps
}: {
  ref?: React.Ref<HTMLInputElement>;
  label: string;
  labelAction?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {labelAction ? (
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor={id} hint={hint}>
            {label}
          </FieldLabel>
          {labelAction}
        </div>
      ) : (
        <FieldLabel htmlFor={id} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && showPassword ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(fieldControlClass(!!error), "h-12", isPassword && "pr-13")}
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
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}
