import Link from "next/link";
import { format } from "date-fns";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import DanceStyleDot from "@/components/DanceStyleDot";
import KiwiMascot from "@/components/KiwiMascot";
import type { AgendaRow } from "../lessons/useLessonAgenda";
import { heroBadge, prepParts, termProgressLabel } from "./today";

/**
 * 今天頁的主角：下一堂（或上課中還沒點名的那一堂）。不包卡片——時間放大當主角，
 * 整頁唯一的實心按鈕是「開始點名」（去框線改版，~/.claude/plans/quiet-redesign.md §3.1）。
 */
const NextLessonHero = ({
  row,
  now,
  isToday,
}: {
  row: AgendaRow | null;
  now: Date;
  /** 只有今天的課才給點名——別天的課只帶去課程頁，免得點錯日期。 */
  isToday: boolean;
}) => {
  if (!row) {
    return (
      <section className="flex items-center gap-4 border-b border-line pb-8 pt-2">
        <KiwiMascot pose="sleep" className="w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-ink">接下來沒有排課</p>
          <p className="text-[13px] text-ink-3">7 天內沒有要上的課。</p>
        </div>
        <Button asChild variant="text" size="sm">
          <Link href="/lessons">看課程</Link>
        </Button>
      </section>
    );
  }

  const { period } = row;
  const { lesson } = period;
  const taken = Boolean(period.attendanceTakenAt);
  const lessonHref = `/lessons/${lesson.id}`;
  const people = lesson.teachers.map((t) => t.name).join("、");
  // 這堂的準備：整期、預計會來、體驗、已簽到——進點名頁之前就知道會來多少人。
  const headcount = prepParts(period).join(" · ");

  return (
    <section
      aria-label="下一堂課"
      className="grid gap-5 border-b border-line pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-6 lg:pb-9"
    >
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-primary-800">{heroBadge(row, now)}</p>
        <p className="mt-2.5 text-[52px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink lg:text-[56px]">
          {format(new Date(period.startTime), "HH:mm")}
          <span className="ml-1.5 text-[22px] font-medium tracking-normal text-ink-3 lg:text-2xl">
            – {format(new Date(period.endTime), "HH:mm")}
          </span>
        </p>
        <Link
          href={lessonHref}
          className="mt-3.5 flex items-center gap-2.5 text-[21px] font-semibold text-ink hover:text-primary-900 lg:text-[22px]"
        >
          <DanceStyleDot style={lesson.danceStyle} />
          <span className="truncate">{lesson.name}</span>
        </Link>
        <p className="mt-1 text-sm text-ink-2">
          {[termProgressLabel(period), lesson.location?.name].filter(Boolean).join(" · ")}
          {people && (
            <>
              <br className="lg:hidden" />
              <span className="hidden lg:inline"> · </span>
              老師 {people}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 lg:items-end">
        <p className="text-[13px] text-ink-2">{headcount}</p>
        {taken ? (
          <Button asChild variant="text" size="md" className="-ml-2 self-start lg:ml-0 lg:self-end">
            <Link href={`${lessonHref}/periods/${period.id}/check-success`}>已點名 · 看結果</Link>
          </Button>
        ) : isToday ? (
          <Button asChild size="lg" className="w-full text-base lg:w-auto lg:px-7">
            <Link href={`${lessonHref}/periods/${period.id}/check`}>
              <Check className="size-5" strokeWidth={2.6} />
              開始點名
            </Link>
          </Button>
        ) : (
          <Button asChild variant="text" size="md" className="-ml-2 self-start lg:ml-0 lg:self-end">
            <Link href={lessonHref}>看這門課</Link>
          </Button>
        )}
      </div>
    </section>
  );
};

export default NextLessonHero;
