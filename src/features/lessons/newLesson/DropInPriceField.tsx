import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

/**
 * 單堂付費（Lesson.dropInPrice）：開了之後，沒課卡的學生可以付這個價錢上這堂，
 * 不扣課卡。關掉 = null。金額另外存一份字串，打字中途清空也不會被開關吃掉。
 */
const DropInPriceField = ({
  enabled,
  amount,
  onEnabledChange,
  onAmountChange,
  error,
}: {
  enabled: boolean;
  amount: string;
  onEnabledChange: (enabled: boolean) => void;
  onAmountChange: (amount: string) => void;
  error?: string;
}) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={`${id}-switch`}>開放單堂付費</FieldLabel>
        <Switch id={`${id}-switch`} checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {enabled && (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-neutral-500">
            $
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="單堂價"
            aria-label="單堂價"
            aria-invalid={Boolean(error)}
            className={cn(fieldControlClass(Boolean(error)), "h-11 pl-8 tabular-nums")}
          />
        </div>
      )}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        enabled && <p className="text-xs text-neutral-500">沒課卡的學生付這個價錢上課，不扣課卡</p>
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
