import { Check } from "lucide-react";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/useCan";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  moduleOf,
  roleBundle,
  type Permission,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** The checkboxes on screen: core permissions plus those of modules that are on. */
export function useVisiblePermissions(): Permission[] {
  const { moduleEnabled } = useAccess();
  return PERMISSION_KEYS.filter((p) => {
    const mod = moduleOf(p);
    return !mod || moduleEnabled(mod);
  });
}

/**
 * 權限 checkboxes under the role picker. The role's defaults start ticked;
 * anything that differs from them is marked 自訂. A permission the viewer
 * doesn't hold can be taken away but not handed out (the API refuses it too).
 */
export default function PermissionPicker({
  role,
  value,
  onChange,
  locked,
}: {
  role: string;
  value: Set<Permission>;
  onChange: (next: Set<Permission>) => void;
  /** Owner or yourself: shown, not editable. */
  locked: boolean;
}) {
  const { can } = useAccess();
  const visible = useVisiblePermissions();
  const bundle = roleBundle(role);
  const customized = visible.some((p) => value.has(p) !== bundle.has(p));

  const toggle = (p: Permission) => {
    const next = new Set(value);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-medium text-neutral-900">權限</legend>
        {!locked && customized && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => onChange(new Set(visible.filter((p) => bundle.has(p))))}
          >
            恢復角色預設
          </Button>
        )}
      </div>
      <p className="-mt-2 text-[13px] text-neutral-500">
        {locked
          ? role === "owner"
            ? "建立者永遠擁有全部權限"
            : "自己的權限要請另一位管理員改"
          : "角色決定預設勾哪些，也可以替這個人另外加減。點名、課卡、收入每個人都能用，不在這裡。"}
      </p>
      {PERMISSION_GROUPS.map(({ group, label }) => {
        const items = visible.filter((p) => PERMISSIONS[p].group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200">
            <p className="bg-neutral-50 px-4 py-2 text-[13px] font-medium text-neutral-500">{label}</p>
            {items.map((p) => {
              const checked = value.has(p);
              const disabled = locked || (!checked && !can(p));
              return (
                <label
                  key={p}
                  className={cn(
                    "flex items-start gap-3 border-t border-neutral-200 px-4 py-3",
                    disabled ? "cursor-not-allowed" : "cursor-pointer"
                  )}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(p)}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm border-[1.5px] peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300",
                      checked ? "border-primary-900 bg-primary-900 text-white" : "border-neutral-300 bg-white",
                      disabled && "opacity-50"
                    )}
                  >
                    {checked && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[15px] font-medium text-neutral-900">
                      {PERMISSIONS[p].label}
                      {!locked && checked !== bundle.has(p) && <StatusTag tone="outline">自訂</StatusTag>}
                    </span>
                    <span className="text-[13px] text-neutral-500">{PERMISSIONS[p].hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        );
      })}
    </fieldset>
  );
}
