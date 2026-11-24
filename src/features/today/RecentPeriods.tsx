import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import DanceStyleDot from "@/components/DanceStyleDot";
import { formatMoney } from "@/lib/money";
import type { RecentPeriod } from "@/store/slices/lessons";
import { dayLabel } from "./today";

/** 最近上過：一點就到那一堂的點名結果（誰來了、收了多少）。不包框，列之間一條細線。 */
const RecentPeriods = ({ periods, isLoading }: { periods: RecentPeriod[]; isLoading: boolean }) => (
  <section aria-labelledby="recent-heading">
    <div className="mb-1 flex items-baseline gap-2">
      <h2 id="recent-heading" className="text-[17px] font-semibold text-ink lg:text-[13px] lg:text-ink-3">
        最近上過
      </h2>
      <span className="text-[13px] text-ink-3 lg:hidden">這堂收入</span>
      <Link href="/income" className="ml-auto text-[13px] font-semibold text-primary-800 hover:text-primary-900">
        看收入
      </Link>
    </div>
    {isLoading ? (
      <div aria-busy="true" className="flex flex-col gap-2 pt-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl opacity-60" />
      </div>
    ) : periods.length === 0 ? (
      <p className="py-3 text-sm text-ink-3">還沒有點過名的課</p>
    ) : (
      <ul className="divide-y divide-line">
        {periods.map((period) => (
          <li key={period.id}>
            <Link
              href={`/lessons/${period.lesson.id}/periods/${period.id}/check-success`}
              className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 hover:bg-primary-50"
            >
              <DanceStyleDot style={period.lesson.danceStyle} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{period.lesson.name}</span>
                <span className="block truncate text-xs tabular-nums text-ink-3">
                  {[dayLabel(new Date(period.startTime)), period.lesson.location?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
                ${formatMoney(period.revenue)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default RecentPeriods;
