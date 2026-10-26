import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * 金額字串。千分位走 `formatMoney`；有小數的（787.5、333.33，分帳試算才會出現）
 * 保留到兩位，不然「787.5 捨去到 780」會變成「788 捨去到 780」。
 * 負數用「−」；`sign` 時正數加「+」。
 */
export function moneyText(value: number, { sign = false }: { sign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const text = Number.isInteger(abs) ? formatMoney(abs) : abs.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (value < 0 && text !== "0") return `−${text}`;
  if (sign && value > 0) return `+${text}`;
  return text;
}

/** 收入深綠、支出深橘（淡底＋深字成對的那個深字）。 */
export const INCOME_TEXT = "text-primary-900";
export const EXPENSE_TEXT = "text-warning-950";

/** 金額：等寬數字；`colored` 時收入綠、支出橘。 */
export default function Money({
  value,
  sign = false,
  colored = false,
  className,
}: {
  value: number;
  sign?: boolean;
  colored?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", colored && (value < 0 ? EXPENSE_TEXT : INCOME_TEXT), className)}>
      {moneyText(value, { sign })}
    </span>
  );
}
