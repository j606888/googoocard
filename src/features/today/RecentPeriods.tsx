import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { formatMoney } from "@/lib/money";
import type { RecentPeriod } from "@/store/slices/lessons";
import { dayLabel } from "./today";

/** 最近上過：一點就到那一堂的點名結果（誰來了、收了多少）。 */
const RecentPeriods = ({ periods, isLoading }: { periods: RecentPeriod[]; isLoading: boolean }) => (
  <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between">
      <h2 id="recent-heading" className="text-[15px] font-bold text-neutral-900">
        最近上過 <span className="text-[13px] font-normal text-neutral-600">出席與這堂收入</span>
      </h2>
      <Link href="/income" className="text-[13px] font-semibold text-primary-900">
        看收入
      </Link>
    </div>
    {isLoading ? (
      <div aria-busy="true" className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl opacity-60" />
      </div>
    ) : periods.length === 0 ? (
      <EmptyState kind="inline" title="還沒有點過名的課" className="bg-white" />
    ) : (
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-transparent bg-white lg:border-neutral-200">
        {periods.map((period) => (
          <li key={period.id}>
            <Link
              href={`/lessons/${period.lesson.id}/periods/${period.id}/check-success`}
              className="flex min-h-14 items-center gap-2.5 px-3 py-2 hover:bg-neutral-50"
            >
              <span
                aria-hidden="true"
                className={`h-8 w-2 shrink-0 rounded-full ${danceStyleMeta(period.lesson.danceStyle).bg}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-neutral-900">
                  {period.lesson.name}
                </span>
                <span className="block truncate text-xs tabular-nums text-neutral-600">
                  {[
                    dayLabel(new Date(period.startTime)),
                    period.lesson.location?.name,
                    `${period.attendeeCount} 人出席`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-neutral-900">
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
