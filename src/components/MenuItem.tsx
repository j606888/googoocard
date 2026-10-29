import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 「⋯」浮層選單裡的一項（放在 `PopoverContent className="w-60 p-1.5"` 裡）。
 * `hint` 是第二行灰色小字，通常用來說明為什麼停用。
 */
export default function MenuItem({
  icon,
  danger = false,
  disabled = false,
  hint,
  onClick,
  children,
}: {
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full min-h-11 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        danger ? "text-danger-700 hover:bg-danger-50" : "text-neutral-700 hover:bg-neutral-50"
      )}
    >
      {icon}
      <span className="flex flex-col gap-0.5 min-w-0">
        {children}
        {hint && <span className="text-xs font-normal text-neutral-500">{hint}</span>}
      </span>
    </button>
  );
}
