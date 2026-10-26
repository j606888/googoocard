import Link from "next/link";
import { danceStyleClasses, danceStyleMeta } from "@/lib/danceStyleColors";
import type { TeacherOverviewRow } from "@/store/slices/teachers";
import StatusTag from "@/components/StatusTag";
import TeacherAvatar from "./TeacherAvatar";
import { periodLabel, shortMonthLabel } from "./format";

/** One teacher on the overview: who, what they teach, next class, this month, trend. */
const TeacherOverviewCard = ({
  teacher,
  month,
  months,
}: {
  teacher: TeacherOverviewRow;
  month: string;
  months: string[];
}) => {
  const archived = Boolean(teacher.archivedAt);
  const { stats } = teacher;
  const maxTrend = Math.max(1, ...teacher.trend);
  const trendLabel = months
    .map((m, i) => `${shortMonthLabel(m)} ${teacher.trend[i] ?? 0} 堂`)
    .join("、");

  return (
    <Link
      href={`/teachers/${teacher.id}?month=${month}`}
      className="rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col gap-4 hover:border-neutral-300 transition-colors"
    >
      <div className="flex items-center gap-3">
        <TeacherAvatar name={teacher.name} color={teacher.color} muted={archived} />
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <span className="text-lg font-semibold truncate">{teacher.name}</span>
          {teacher.danceStyles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {teacher.danceStyles.map((style) => (
                <span
                  key={style.id}
                  className={`text-xs px-2 py-0.5 rounded-full ${danceStyleMeta(style).badge}`}
                >
                  {style.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <StatusTag tone={!archived && teacher.activeLessonCount > 0 ? "positive" : "neutral"}>
          {archived
            ? "已封存"
            : teacher.activeLessonCount > 0
              ? `進行中 ${teacher.activeLessonCount} 堂課`
              : "沒有進行中的課"}
        </StatusTag>
      </div>

      {!archived && (
        <div className="rounded-xl bg-neutral-50 px-3.5 py-2.5 flex flex-col gap-0.5">
          <span className="text-xs text-neutral-500">下一堂</span>
          {teacher.nextPeriod ? (
            <span className="text-sm font-medium truncate">
              {periodLabel(teacher.nextPeriod.startTime)} · {teacher.nextPeriod.lessonName}
            </span>
          ) : (
            <span className="text-sm text-neutral-500">目前沒有排課</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "本月堂數", value: stats.sessions },
          { label: "出席人次", value: stats.attendance },
          { label: "平均每堂", value: stats.avgAttendance ?? "–" },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <span className="text-xl font-semibold tabular-nums">{item.value}</span>
            <span className="text-xs text-neutral-500">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <div role="img" aria-label={`近 6 個月堂數：${trendLabel}`} className="flex items-end gap-1.5 h-10">
          {teacher.trend.map((count, i) => (
            <span
              key={months[i]}
              className={`flex-1 rounded-sm ${
                i === teacher.trend.length - 1 ? danceStyleClasses(teacher.color).bg : "bg-neutral-200"
              }`}
              style={{ height: `${Math.max(3, Math.round((count / maxTrend) * 40))}px` }}
            />
          ))}
        </div>
        <span className="text-xs text-neutral-500">
          近 6 個月堂數（{shortMonthLabel(months[0])} → {shortMonthLabel(months[months.length - 1])}）
        </span>
      </div>
    </Link>
  );
};

export default TeacherOverviewCard;
