"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, ChevronDown, ChevronLeft, Ellipsis, Plus } from "lucide-react";
import DanceStyleDot from "@/components/DanceStyleDot";
import Menu from "@/components/Menu";
import StatusTag from "@/components/StatusTag";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { formatMoney } from "@/lib/money";
import { lessonPeopleLabel } from "@/lib/teachers";
import type { Lesson } from "@/store/slices/lessons";
import { stashLessonClone } from "../lessonClone";
import { weeklyScheduleLabel } from "../lessonSchedule";
import type { useTermPage } from "./useTermPage";

const ICON_BUTTON =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-primary-50";
const MENU_ITEM =
  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-100";

/**
 * 手機的「這一期」頁首（去框線改版：白底、不再是深綠色塊）：回課程、切換期、編輯，
 * 這門課是誰教在哪上，下面一行灰字是這一期到目前為止的樣子。開新一期、課種頁收在 ⋯。
 */
const TermHeader = ({
  lesson,
  term,
  onOpenSettings,
}: {
  lesson: Lesson;
  term: ReturnType<typeof useTermPage>;
  onOpenSettings: () => void;
}) => {
  const router = useRouter();
  const switcherRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [switching, setSwitching] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const running = lesson.status !== "finished";
  const subtitle = [
    weeklyScheduleLabel(lesson.periods ?? []),
    lessonPeopleLabel(lesson.teachers, lesson.assistants),
  ]
    .filter(Boolean)
    .join(" · ");

  const openNewTerm = () => {
    if (!term.summary) return;
    stashLessonClone(term.summary);
    router.push("/lessons/new");
  };

  return (
    <header className="px-5 pt-1">
      <div className="-mx-2 flex h-12 items-center gap-1">
        <Link
          href="/lessons"
          className="flex h-11 shrink-0 items-center gap-0.5 rounded-lg px-2 text-[15px] font-semibold text-primary-800 hover:bg-primary-50"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          課程
        </Link>
        <span className="flex-1" />
        {term.termNumber !== null && (
          <button
            ref={switcherRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={switching}
            onClick={() => setSwitching(!switching)}
            className="flex h-11 min-w-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-medium text-ink-2 hover:bg-primary-50"
          >
            <span className="truncate">第 {term.termNumber} 期</span>
            <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${switching ? "rotate-180" : ""}`} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-11 shrink-0 cursor-pointer items-center rounded-lg px-2 text-[15px] font-semibold text-primary-800 hover:bg-primary-50"
        >
          編輯
        </button>
        <button
          ref={moreRef}
          type="button"
          aria-label="更多：開新一期、課種頁"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(!moreOpen)}
          className={ICON_BUTTON}
        >
          <Ellipsis className="size-5" />
        </button>
      </div>

      <h1 className="mt-1 flex items-center gap-2.5 text-[28px] font-semibold leading-9 tracking-[-0.01em] text-ink">
        <span className="min-w-0 break-words">{lesson.name}</span>
        <StatusTag tone={running ? "positive" : "neutral"}>{running ? "進行中" : "已結束"}</StatusTag>
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        <DanceStyleDot style={lesson.danceStyle} className="mr-1.5 align-middle" />
        {[danceStyleMeta(lesson.danceStyle).label, lesson.kind === "ongoing" ? "持續開課" : "固定期數", lesson.location?.name]
          .filter(Boolean)
          .join(" · ")}
        {subtitle && (
          <>
            <br />
            {subtitle}
          </>
        )}
      </p>

      {/* 三格統計收成一行灰字（去框線改版：不放統計列）。 */}
      {term.overview && (
        <p className="mt-2.5 text-[13px] text-ink-2">
          {term.termNumber !== null && `第 ${term.termNumber} 期 · `}
          已上 <b className="font-semibold text-ink">{term.overview.sessions}</b> 堂 · 平均{" "}
          <b className="font-semibold text-ink">{term.overview.average}</b> ·{" "}
          {term.termNumber !== null ? "這期收入" : "累計收入"}{" "}
          <b className="font-semibold text-ink">
            {term.totalRevenue === undefined ? "…" : `$${formatMoney(term.totalRevenue)}`}
          </b>
        </p>
      )}

      <Menu
        open={switching}
        anchorEl={switcherRef.current}
        onClose={() => setSwitching(false)}
        className="z-50 max-h-[60vh] w-64 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)]"
      >
        {term.terms.map((item) => (
          <Link
            key={item.lessonId}
            href={`/lessons/${item.lessonId}`}
            aria-current={item.lessonId === lesson.id ? "page" : undefined}
            onClick={() => setSwitching(false)}
            className={`${MENU_ITEM} justify-between py-1.5 ${item.lessonId === lesson.id ? "bg-primary-50" : ""}`}
          >
            <span className="min-w-0">
              <span className="block font-semibold text-neutral-900">第 {item.number} 期</span>
              <span className="block truncate text-xs tabular-nums text-neutral-600">{item.range}</span>
            </span>
            <span className={`shrink-0 text-xs font-medium ${item.running ? "text-primary-900" : "text-neutral-600"}`}>
              {item.running ? "進行中" : "已結束"}
            </span>
          </Link>
        ))}
      </Menu>

      <Menu
        open={moreOpen}
        anchorEl={moreRef.current}
        onClose={() => setMoreOpen(false)}
        placement="bottom-end"
        className="z-50 w-52 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)]"
      >
        {term.summary && (
          <button type="button" className={MENU_ITEM} onClick={openNewTerm}>
            <Plus className="size-4" />
            開新一期
          </button>
        )}
        {lesson.group && (
          <Link href={`/lessons/groups/${lesson.group.id}`} className={MENU_ITEM}>
            <BookOpenText className="size-4" />
            課種頁
          </Link>
        )}
      </Menu>
    </header>
  );
};

export default TermHeader;
