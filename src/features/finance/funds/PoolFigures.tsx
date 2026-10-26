import { cn } from "@/lib/utils";
import Money from "../Money";

/** 小水庫三個數字：目前餘額、保留零用金、可繳回。 */
export default function PoolFigures({ balance, reserve, remittable }: { balance: number; reserve: number; remittable: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Figure label="目前餘額" value={balance} />
      <Figure label="保留零用金" value={reserve} className="text-neutral-500" />
      <Figure label="可繳回" value={remittable} className="text-primary-900" />
    </div>
  );
}

function Figure({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-neutral-500">{label}</div>
      <Money value={value} className={cn("text-lg font-semibold text-neutral-900 lg:text-[22px]", className)} />
    </div>
  );
}
