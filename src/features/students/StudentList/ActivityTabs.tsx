"use client";

import InfoTip from "@/components/InfoTip";
import SegmentedTabs from "@/components/SegmentedTabs";
import { ACTIVE_DAYS, ActivityView, StudentActivity } from "./studentFilters";

export const ACTIVITY_META: Record<StudentActivity, { label: string; desc: string }> = {
  active: { label: "在上課", desc: `近 ${ACTIVE_DAYS} 天有出席` },
  idle: { label: "有卡沒來", desc: `還有剩堂，但超過 ${ACTIVE_DAYS} 天沒來` },
  gone: { label: "已離開", desc: `超過 ${ACTIVE_DAYS} 天沒來，也沒有可用課卡` },
};

const ZONES: StudentActivity[] = ["active", "idle", "gone"];
const VIEWS: ActivityView[] = ["all", ...ZONES];

/**
 * 名單上方的分區切換：全部／在上課／有卡沒來／已離開，人數跟在後面當小字。
 * 人數寫在 label 裡而不是 `hint`：手機上四個分頁剛好排滿一列，字和數字不能拆行。
 */
const ActivityTabs = ({
  value,
  onChange,
  counts,
  className,
}: {
  value: ActivityView;
  onChange: (next: ActivityView) => void;
  counts: Record<StudentActivity, number>;
  className?: string;
}) => (
  <SegmentedTabs
    variant="underline"
    ariaLabel="依活躍度分區"
    value={value}
    onChange={onChange}
    className={className}
    options={VIEWS.map((view) => ({
      value: view,
      label: (
        <span className="whitespace-nowrap">
          {view === "all" ? "全部" : ACTIVITY_META[view].label}
          <span className="ml-1 text-xs font-normal tabular-nums text-ink-3">
            {view === "all" ? counts.active + counts.idle + counts.gone : counts[view]}
          </span>
        </span>
      ),
    }))}
  />
);

/** 三區各自怎麼算——說明收在 ⓘ 裡，畫面上不常駐。 */
export const ActivityInfoTip = ({ className }: { className?: string }) => (
  <InfoTip label="分區說明：在上課、有卡沒來、已離開" className={className}>
    <dl className="flex flex-col gap-2">
      {ZONES.map((zone) => (
        <div key={zone}>
          <dt className="font-semibold text-ink">{ACTIVITY_META[zone].label}</dt>
          <dd className="text-ink-2">{ACTIVITY_META[zone].desc}</dd>
        </div>
      ))}
    </dl>
  </InfoTip>
);

export default ActivityTabs;
