import Link from "next/link";
import { AlertCircle, CalendarDays, ChevronRight, Clock, CreditCard, Info, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import EmptyState from "@/components/EmptyState";
import KiwiLogo from "@/components/KiwiLogo";
import LocationBadge from "@/components/LocationBadge";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import SessionDots from "@/features/students/StudentDetail/CardsSection/SessionDots";
import { isLowRemaining } from "@/features/students/StudentDetail/CardsSection/cardStatus";
import {
  dateFmt,
  type LessonCardStatus,
  type MyCardSummary,
  type NextLesson,
  type TodayResponse,
  type UpcomingPeriod,
} from "@/features/checkin/types";
import { formatCardSerial } from "@/lib/cardSerial";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { dateKeyOf, dayLabel, daysBetween, shortDay, taipeiTime, weekdayOf } from "./scheduleDates";

const timeRange = (p: { startTime: string; endTime: string }) =>
  `${taipeiTime(p.startTime)} – ${taipeiTime(p.endTime)}`;

const relativeDay = (days: number) =>
  days <= 0 ? "今天" : days === 1 ? "明天" : days === 2 ? "後天" : `${days} 天後`;

/** The card the lesson would use on its own — the engine's pick, or the only one. */
const pickedCard = (status: LessonCardStatus) =>
  status.usable.find((c) => c.studentCardId === status.autoPickId) ??
  (status.usable.length === 1 ? status.usable[0] : null);

/**
 * 「上課簽到」on a day with no class (設計稿 A–C). Not a bare empty state: the
 * student's next lesson and which card it will use, the classroom's next few,
 * and their cards — opening the page always tells them something.
 */
export default function NoClassToday({ data }: { data: TodayResponse }) {
  const monthCount = data.monthAttendance ?? 0;
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6 bg-neutral-50 px-4 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-100">
          <KiwiLogo className="w-[30px] text-primary-500" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[17px] font-bold text-neutral-900">今天沒有課</h2>
          <p className="text-[13px] text-neutral-500">
            {dateFmt.format(new Date())}
            {monthCount > 0 && ` · 這個月上了 ${monthCount} 堂`}
          </p>
        </div>
      </div>

      <NextLessonCard lesson={data.nextLesson} />
      {data.upcoming.length > 0 && <Upcoming periods={data.upcoming} />}
      {data.myCards && <MyCards cards={data.myCards} />}
    </div>
  );
}

function SectionHeader({ id, title, href, link }: { id: string; title: string; href?: string; link?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 id={id} className="text-base font-bold text-neutral-900">
        {title}
      </h3>
      {href && (
        <Link href={href} className="-my-3 flex items-center gap-0.5 py-3 text-[13px] font-semibold text-primary-700">
          {link}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function NextLessonCard({ lesson }: { lesson: NextLesson | null }) {
  if (!lesson) {
    return (
      <EmptyState
        kind="inline"
        icon={<CalendarDays />}
        title="還沒排下一堂課"
        description="老師排好之後會出現在這裡"
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/liff/schedule">課表</Link>
          </Button>
        }
      />
    );
  }

  const dateKey = dateKeyOf(lesson.startTime);
  const [, month, day] = dateKey.split("-").map(Number);
  const style = danceStyleMeta(lesson.danceStyle);
  const card = lesson.cardStatus ? pickedCard(lesson.cardStatus) : null;

  return (
    <section aria-labelledby="next-lesson" className="flex flex-col gap-3">
      <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white">
        <div className="flex flex-col gap-3.5 px-5 pb-4 pt-[18px]">
          <div className="flex items-center justify-between">
            <h3 id="next-lesson" className="text-[13px] font-semibold text-primary-900">
              {lesson.mine ? "你的下一堂" : "下一堂課"}
            </h3>
            <StatusTag tone="positive">{relativeDay(daysBetween(dateKeyOf(new Date()), dateKey))}</StatusTag>
          </div>
          <div className="flex items-center gap-4">
            <div
              aria-hidden
              className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-neutral-200"
            >
              <span className="self-stretch bg-primary-900 py-1 text-center text-xs font-semibold text-white">
                {month}月
              </span>
              <span className="pt-2 text-[28px] font-extrabold leading-none tabular-nums text-neutral-900">{day}</span>
              <span className="pb-2 pt-1 text-xs text-neutral-500">週{weekdayOf(dateKey)}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="sr-only">{dayLabel(dateKey)}</span>
              <p className="truncate text-lg font-bold text-neutral-900">{lesson.lessonName}</p>
              <p className="text-[15px] font-semibold tabular-nums text-neutral-700">{timeRange(lesson)}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", style.badge)}>{style.label}</span>
                <LocationBadge location={lesson.location} />
              </div>
            </div>
          </div>
        </div>
        {lesson.cardStatus && (
          <>
            <div aria-hidden className="mx-3.5 border-t-[1.5px] border-dashed border-neutral-200" />
            <CardLine status={lesson.cardStatus} />
          </>
        )}
      </div>

      {card?.remainingSessions === 1 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning-300 bg-warning-50 p-4 text-warning-950">
          <div className="flex gap-2.5">
            <AlertCircle className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-[15px] font-semibold">上完這堂，這張卡就用完了</p>
              <p className="text-[13px] leading-relaxed">可以先買好下一張，下課再付給小幫手。</p>
            </div>
          </div>
          <Button asChild variant="secondary" className="self-start">
            <Link href="/liff/plans">
              看課卡方案
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      )}

      <p className="flex items-center gap-1.5 px-1 text-[13px] text-neutral-500">
        <Clock className="size-3.5 shrink-0" aria-hidden />
        上課當天打開這頁就能簽到
      </p>
    </section>
  );
}

/** Under the next lesson: which card it will charge, or how they'll pay for it. */
function CardLine({ status }: { status: LessonCardStatus }) {
  const card = pickedCard(status);
  let tone: "primary" | "danger" | "warning" | "neutral";
  let content: ReactNode;

  if (card) {
    const low = isLowRemaining(card);
    tone = low ? "danger" : "primary";
    content = (
      <p className="text-sm text-neutral-600">
        會用 <strong className="font-semibold text-neutral-900">{card.name}</strong>，
        {low ? (
          <strong className="font-semibold text-danger-700">只剩 {card.remainingSessions} 堂</strong>
        ) : (
          `目前剩 ${card.remainingSessions} 堂`
        )}
      </p>
    );
  } else if (status.usable.length > 1) {
    tone = "primary";
    content = <p className="text-sm text-neutral-600">你有 {status.usable.length} 張卡能用，簽到時再選</p>;
  } else if (status.buyable.length > 0) {
    tone = "warning";
    content = (
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-neutral-900">還沒有能用的課卡</p>
        <p className="text-[13px] text-neutral-500">簽到時可以現場買一張，下課再付</p>
      </div>
    );
  } else {
    tone = "neutral";
    content = <p className="text-sm text-neutral-600">這堂課沒有你能用的課卡，請找小幫手</p>;
  }

  const Icon = tone === "neutral" ? Info : CreditCard;
  return (
    <div className="flex items-center gap-2.5 px-5 pb-3.5 pt-3">
      <span
        aria-hidden
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          tone === "primary" && "bg-primary-50 text-primary-700",
          tone === "danger" && "bg-danger-50 text-danger-700",
          tone === "warning" && "bg-warning-100 text-warning-950",
          tone === "neutral" && "bg-neutral-100 text-neutral-600"
        )}
      >
        <Icon className="size-4" />
      </span>
      {content}
    </div>
  );
}

function Upcoming({ periods }: { periods: UpcomingPeriod[] }) {
  return (
    <section aria-labelledby="upcoming" className="flex flex-col gap-2.5">
      <SectionHeader id="upcoming" title="接下來" href="/liff/schedule" link="完整課表" />
      <ul className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
        {periods.map((p) => {
          const key = dateKeyOf(p.startTime);
          return (
            <li key={p.periodId} className="flex items-center gap-3.5 px-4 py-3">
              <div className="flex w-11 shrink-0 flex-col items-center gap-0.5">
                <span className="text-[15px] font-bold tabular-nums text-neutral-900">{shortDay(key)}</span>
                <span className="text-xs text-neutral-500">週{weekdayOf(key)}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 font-semibold text-neutral-900">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", danceStyleMeta(p.danceStyle).dot)} />
                  <span className="truncate">{p.lessonName}</span>
                </span>
                <span className="text-[13px] tabular-nums text-neutral-500">
                  {timeRange(p)}
                  {p.location && ` · ${p.location.name}`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MyCards({ cards }: { cards: MyCardSummary[] }) {
  return (
    <section aria-labelledby="my-cards" className="flex flex-col gap-2.5">
      <SectionHeader
        id="my-cards"
        title="我的課卡"
        href={cards.length > 0 ? "/liff/cards" : undefined}
        link="全部課卡"
      />
      {cards.length === 0 ? (
        <EmptyState
          kind="inline"
          icon={<Ticket />}
          title="目前沒有能用的課卡"
          description="上課時可以現場買，也可以先買好"
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/liff/plans">課卡方案</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

/** A compact 票根: name, serial, last used, flags, and the big remaining count. */
function CardRow({ card }: { card: MyCardSummary }) {
  const low = card.remainingSessions > 0 && isLowRemaining(card);
  return (
    <Link
      href="/liff/cards"
      className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 active:bg-neutral-50"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1">
          <span className="truncate text-[15px] font-bold text-neutral-900">{card.name}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] tabular-nums text-neutral-500">
            {formatCardSerial(card.serialNumber)} ·{" "}
            {card.lastUsedAt ? `上次 ${shortDay(dateKeyOf(card.lastUsedAt))}` : "還沒用過"}
            {low && <StatusTag tone="danger">快用完</StatusTag>}
            {card.unpaidAmount !== null && <StatusTag tone="warning">未付 ${formatMoney(card.unpaidAmount)}</StatusTag>}
          </span>
        </div>
        <SessionDots
          total={card.totalSessions}
          remaining={card.remainingSessions}
          low={low}
          size={card.totalSessions > 8 ? "sm" : "md"}
        />
      </div>
      <div className="flex shrink-0 items-baseline gap-1 leading-none tabular-nums">
        <span className={cn("text-[32px] font-extrabold tracking-tight", low ? "text-danger-700" : "text-neutral-900")}>
          {card.remainingSessions}
        </span>
        <span className="text-sm font-medium text-neutral-600">/ {card.totalSessions} 堂</span>
      </div>
      <ChevronRight className="size-4 shrink-0 text-neutral-500" aria-hidden />
    </Link>
  );
}
