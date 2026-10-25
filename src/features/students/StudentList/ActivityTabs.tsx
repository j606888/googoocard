"use client";

import { cn } from "@/lib/utils";
import { ACTIVE_DAYS, ActivityView, StudentActivity } from "./studentFilters";

export const ACTIVITY_META: Record<StudentActivity, { label: string; desc: string; dot: string }> = {
  active: { label: "在上課", desc: `近 ${ACTIVE_DAYS} 天有出席`, dot: "bg-primary-500" },
  idle: { label: "有卡沒來", desc: `還有剩堂，但超過 ${ACTIVE_DAYS} 天沒來`, dot: "bg-warning-500" },
  gone: { label: "已離開", desc: `超過 ${ACTIVE_DAYS} 天沒來，也沒有可用課卡`, dot: "bg-neutral-400" },
};

const VIEWS: ActivityView[] = ["all", "active", "idle", "gone"];

/**
 * 名單上方的分區切換：全部／在上課／有卡沒來／已離開。
 * 手機一排四顆小格；桌面變成四張卡，多一行說明。
 */
const ActivityTabs = ({
  value,
  onChange,
  counts,
}: {
  value: ActivityView;
  onChange: (next: ActivityView) => void;
  counts: Record<StudentActivity, number>;
}) => (
  <div role="group" aria-label="依活躍度分區" className="grid grid-cols-4 gap-1.5 lg:gap-3">
    {VIEWS.map((view) => {
      const active = value === view;
      const meta = view === "all" ? null : ACTIVITY_META[view];
      const count = view === "all" ? counts.active + counts.idle + counts.gone : counts[view];
      return (
        <button
          key={view}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(view)}
          className={cn(
            "flex flex-col items-start min-w-0 rounded-xl border bg-white px-2.5 py-2 lg:px-4 lg:py-3 text-left cursor-pointer transition-colors",
            active
              ? "border-primary-700 ring-1 ring-primary-700"
              : "border-neutral-200 hover:border-primary-300"
          )}
        >
          <span className="flex items-center gap-1.5 text-xs lg:text-sm font-medium text-neutral-700 whitespace-nowrap">
            {meta && <span aria-hidden="true" className={`w-2 h-2 rounded-full ${meta.dot}`} />}
            {meta ? meta.label : "全部"}
          </span>
          <span className="text-lg lg:text-2xl font-bold tabular-nums text-neutral-900">
            {count}
            <span className="ml-0.5 text-xs lg:text-sm font-normal text-neutral-500">位</span>
          </span>
          <span className="hidden lg:block text-xs text-neutral-500 truncate max-w-full">
            {meta ? meta.desc : "依下面三區排列"}
          </span>
        </button>
      );
    })}
  </div>
);

export default ActivityTabs;
