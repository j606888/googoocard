import { FieldLabel } from "@/components/Field";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: true, label: "已收到錢" },
  { value: false, label: "還沒收" },
] as const;

/**
 * 買卡時「收錢了沒」：沒有預設，一定要選一個才能送出（以前預設已付款，學生沒付也容易直接記成收到）。
 */
export default function PaidChoice({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (paid: boolean) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <FieldLabel>收錢了沒</FieldLabel>
      <div role="radiogroup" aria-label="收錢了沒" className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-11 cursor-pointer rounded-xl border text-sm font-medium",
              value === o.value
                ? "border-primary-700 bg-primary-100 text-primary-900"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-neutral-500">
        {value === null ? "選一個才能送出" : value ? "已收到款項" : "尚未付款，卡片仍可使用，會列在待處理提醒收錢"}
      </span>
    </div>
  );
}
