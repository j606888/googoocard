import { useId } from "react";
import { Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import {
  DROP_IN_NAME_MAX,
  DROP_IN_NOTE_MAX,
  MAX_DROP_IN_OPTIONS,
  type DropInOption,
  parseDropInOptions,
} from "@/lib/dropInOptions";
import { cn } from "@/lib/utils";

/**
 * 單堂方案的表單狀態。第一個方案的金額就是原本的單堂價（`amount`），這裡只多記它的
 * 名稱／說明，加上其他方案。`extras` 是空的 = 只有一個價錢，跟以前一樣。
 */
export type DropInPlans = {
  name: string;
  note: string;
  extras: { name: string; amount: string; note: string }[];
};

export const emptyDropInPlans: DropInPlans = { name: "", note: "", extras: [] };

/** 課程（或複製來源）→ 表單狀態。 */
export const dropInPlansFrom = (options: DropInOption[] | null | undefined): DropInPlans => {
  const parsed = parseDropInOptions(options);
  if (!parsed) return emptyDropInPlans;
  const [first, ...rest] = parsed;
  return {
    name: first.name,
    note: first.note ?? "",
    extras: rest.map((o) => ({ name: o.name, amount: String(o.price), note: o.note ?? "" })),
  };
};

/**
 * 表單狀態 → API 的 `dropInOptions`：null = 單一價（不送方案）；
 * 名稱沒填、重複、金額不對回 undefined（讓表單擋）。
 */
export const buildDropInOptions = (
  enabled: boolean,
  amount: string,
  plans: DropInPlans
): DropInOption[] | null | undefined => {
  if (!enabled || plans.extras.length === 0) return null;
  const rows = [{ name: plans.name, amount, note: plans.note }, ...plans.extras];
  if (rows.some((row) => row.amount.trim() === "")) return undefined;
  return (
    parseDropInOptions(
      rows.map((row) => ({ name: row.name, price: Number(row.amount), note: row.note }))
    ) ?? undefined
  );
};

const PriceInput = ({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-neutral-500">$</span>
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="單堂價"
      aria-label="單堂價"
      aria-invalid={Boolean(invalid)}
      className={cn(fieldControlClass(Boolean(invalid)), "h-11 pl-8 tabular-nums")}
    />
  </div>
);

/** 一個有名字的方案：名稱＋金額一列，下面一行選填的說明（給學生看）。 */
const PlanRow = ({
  index,
  name,
  amount,
  note,
  onChange,
  onRemove,
}: {
  index: number;
  name: string;
  amount: string;
  note: string;
  onChange: (patch: { name?: string; amount?: string; note?: string }) => void;
  onRemove?: () => void;
}) => (
  <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3">
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => onChange({ name: e.target.value })}
        maxLength={DROP_IN_NAME_MAX}
        placeholder={index === 0 ? "名稱，例如 原價" : "名稱，例如 雙人合報"}
        aria-label={`方案 ${index + 1} 名稱`}
        className={cn(fieldControlClass(), "h-11 min-w-0 flex-1")}
      />
      <div className="w-28 shrink-0">
        <PriceInput value={amount} onChange={(value) => onChange({ amount: value })} />
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`移除方案 ${index + 1}`}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100"
        >
          <X className="size-4" />
        </button>
      ) : (
        <span className="w-11 shrink-0 text-center text-xs text-neutral-500">預設</span>
      )}
    </div>
    <input
      value={note}
      onChange={(e) => onChange({ note: e.target.value })}
      maxLength={DROP_IN_NOTE_MAX}
      placeholder="給學生看的說明（選填）"
      aria-label={`方案 ${index + 1} 說明`}
      className={cn(fieldControlClass(), "h-10 text-sm")}
    />
  </div>
);

/**
 * 單堂付費（Lesson.dropInPrice）：開了之後，沒課卡的學生可以付這個價錢上這堂，
 * 不扣課卡。關掉 = null。金額另外存一份字串，打字中途清空也不會被開關吃掉。
 */
const DropInPriceField = ({
  enabled,
  amount,
  onEnabledChange,
  onAmountChange,
  plans,
  onPlansChange,
  error,
}: {
  enabled: boolean;
  amount: string;
  onEnabledChange: (enabled: boolean) => void;
  onAmountChange: (amount: string) => void;
  plans: DropInPlans;
  onPlansChange: (plans: DropInPlans) => void;
  error?: string;
}) => {
  const id = useId();
  const hasPlans = plans.extras.length > 0;
  const canAdd = plans.extras.length + 1 < MAX_DROP_IN_OPTIONS;
  const addPlan = () =>
    onPlansChange({ ...plans, extras: [...plans.extras, { name: "", amount: "", note: "" }] });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={`${id}-switch`}>開放單堂付費</FieldLabel>
        <Switch id={`${id}-switch`} checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && !hasPlans && <PriceInput value={amount} onChange={onAmountChange} invalid={Boolean(error)} />}
      {enabled && hasPlans && (
        <div className="flex flex-col gap-2">
          <PlanRow
            index={0}
            name={plans.name}
            amount={amount}
            note={plans.note}
            onChange={(patch) => {
              if (patch.amount !== undefined) onAmountChange(patch.amount);
              else onPlansChange({ ...plans, ...patch });
            }}
          />
          {plans.extras.map((extra, i) => (
            <PlanRow
              key={i}
              index={i + 1}
              {...extra}
              onChange={(patch) =>
                onPlansChange({
                  ...plans,
                  extras: plans.extras.map((e, j) => (j === i ? { ...e, ...patch } : e)),
                })
              }
              onRemove={() =>
                onPlansChange({ ...plans, extras: plans.extras.filter((_, j) => j !== i) })
              }
            />
          ))}
        </div>
      )}
      {enabled && canAdd && (
        <button
          type="button"
          onClick={addPlan}
          className="flex h-9 cursor-pointer items-center gap-1 self-start rounded-lg px-1 text-sm font-medium text-primary-800 hover:underline"
        >
          <Plus className="size-4" />
          {hasPlans ? "再加一個方案" : "加其他價格（複習價、雙人合報…）"}
        </button>
      )}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        enabled && (
          <p className="text-xs text-neutral-500">
            {hasPlans
              ? "學生報到時自己選方案，收款時你可以核對、改回來"
              : "沒課卡的學生付這個價錢上課，不扣課卡"}
          </p>
        )
      )}
    </div>
  );
};

/** 表單字串 → API 值：關掉是 null；開著但不是合法金額回 undefined（讓表單擋）。 */
export const parseDropInPrice = (enabled: boolean, amount: string): number | null | undefined => {
  if (!enabled) return null;
  const value = Number(amount);
  return amount.trim() !== "" && Number.isInteger(value) && value >= 0 ? value : undefined;
};

export default DropInPriceField;
