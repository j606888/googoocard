import Link from "next/link";
import { format } from "date-fns";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import DanceStyleTile from "@/components/DanceStyleTile";
import KiwiLogo from "@/components/KiwiLogo";
import type { AgendaRow } from "../lessons/useLessonAgenda";
import { heroBadge, termProgressLabel } from "./today";

const CARD = "rounded-3xl bg-white p-4 shadow-[0_10px_28px_rgba(20,35,29,0.12)]";

/** 今天頁的主角：下一堂（或上課中還沒點名的那一堂），一顆大的「開始點名」。 */
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
      <section className={`${CARD} flex items-center gap-4`}>
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-100">
          <KiwiLogo className="w-8 text-accent-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-neutral-900">接下來沒有排課</p>
          <p className="text-[13px] text-neutral-600">7 天內沒有要上的課。</p>
        </div>
        <Button asChild variant="secondary" size="sm">
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
  const arrived = period.attendeeIds.length;
  const headcount =
    period.selfCheckInCount > 0
      ? `已有 ${period.selfCheckInCount} 人自助簽到`
      : arrived > 0
        ? `已簽到 ${arrived} 人`
        : `名冊 ${lesson.studentCount} 人`;

  return (
    <section aria-label="下一堂課" className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-bold text-accent-900">
          {heroBadge(row, now)}
        </span>
        <span className="truncate text-xs text-neutral-600">{termProgressLabel(period)}</span>
      </div>

      <Link href={lessonHref} className="mt-3 flex items-center gap-3">
        <DanceStyleTile style={lesson.danceStyle} name={lesson.name} size="lg" />
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold text-neutral-900">{lesson.name}</span>
          <span className="block truncate text-sm font-medium tabular-nums text-neutral-700">
            {format(new Date(period.startTime), "HH:mm")}–{format(new Date(period.endTime), "HH:mm")}
            {people && ` · ${people}`}
          </span>
        </span>
      </Link>

      <p className="mt-3 text-[13px] text-neutral-600">
        {[lesson.location?.name, headcount].filter(Boolean).join(" · ")}
      </p>

      {taken ? (
        <Button asChild variant="secondary" size="lg" className="mt-3.5 w-full">
          <Link href={`${lessonHref}/periods/${period.id}/check-success`}>已點名 · 看結果</Link>
        </Button>
      ) : isToday ? (
        <Button asChild size="lg" className="mt-3.5 w-full text-[17px]">
          <Link href={`${lessonHref}/periods/${period.id}/check`}>
            <Check className="size-5" strokeWidth={2.6} />
            開始點名
          </Link>
        </Button>
      ) : (
        <Button asChild variant="secondary" size="lg" className="mt-3.5 w-full">
          <Link href={lessonHref}>看這門課</Link>
        </Button>
      )}
    </section>
  );
};

export default NextLessonHero;
