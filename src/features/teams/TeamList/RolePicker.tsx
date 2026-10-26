import { ASSIGNABLE_ROLES, ROLE_LABELS, type AssignableRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  admin: "可以邀請、改角色、把人移出教室",
  teacher: "連到一筆老師資料，課程頁最上面是自己接下來的課",
  assistant: "幫忙點名、收款，看全部課程",
};

/** The three roles as radio cards — invite and role change share it. */
export default function RolePicker({
  value,
  onChange,
  legend,
}: {
  value: AssignableRole;
  onChange: (role: AssignableRole) => void;
  legend: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-neutral-900">{legend}</legend>
      {ASSIGNABLE_ROLES.map((role) => {
        const checked = role === value;
        return (
          <label
            key={role}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5",
              checked ? "border-primary-900 bg-primary-50 ring-1 ring-primary-900" : "border-neutral-200"
            )}
          >
            <input
              type="radio"
              name="member-role"
              value={role}
              checked={checked}
              onChange={() => onChange(role)}
              className="mt-0.5 size-5 shrink-0 accent-primary-900"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold text-neutral-900">{ROLE_LABELS[role]}</span>
              <span className="text-[13px] leading-relaxed text-neutral-500">{ROLE_DESCRIPTIONS[role]}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
