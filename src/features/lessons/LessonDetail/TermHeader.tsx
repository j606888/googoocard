"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpenText, ChevronDown, Ellipsis, Plus, Settings } from "lucide-react";
import DanceStyleBar from "@/components/DanceStyleBar";
import Menu from "@/components/Menu";
import StatTile from "@/components/StatTile";
import TodoBell from "@/features/TodoBell";
import { formatMoney } from "@/lib/money";
import { lessonPeopleLabel } from "@/lib/teachers";
import type { Lesson } from "@/store/slices/lessons";
import { stashLessonClone } from "../lessonClone";
import { weeklyScheduleLabel } from "../lessonSchedule";
import type { useTermPage } from "./useTermPage";

const ICON_BUTTON =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-white/15 text-white hover:bg-white/25";
const MENU_ITEM =
  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-100";

/**
 * 手機的「這一期」頁首：回課程、切換期（看舊的期就在這裡）、這門課是誰教在哪上，
 * 下面三格是這一期到目前為止的樣子。課種動作與課程設定收在 ⋯。
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
    lesson.location?.name,
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
    <header className="rounded-b-[28px] bg-primary-900 px-4 pt-2 pb-5 text-white">
      <div className="flex items-center gap-2">
        <Link href="/lessons" aria-label="回課程" className={ICON_BUTTON}>
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 justify-center">
          {term.termNumber !== null ? (
            <button
              ref={switcherRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={switching}
              onClick={() => setSwitching(!switching)}
              className="flex h-11 min-w-0 cursor-pointer items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-primary-900"
            >
              <span className="truncate">
                第 {term.termNumber} 期 · {running ? "進行中" : "已結束"}
              </span>
              <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${switching ? "rotate-180" : ""}`} />
            </button>
          ) : (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              {running ? "進行中" : "已結束"}
            </span>
          )}
        </div>
        <TodoBell className="" tone="onPrimary" />
        <button
          ref={moreRef}
          type="button"
          aria-label="更多：課程設定、開新一期"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(!moreOpen)}
          className={ICON_BUTTON}
        >
          <Ellipsis className="size-5" />
        </button>
      </div>

      <div className="mt-3.5 flex items-center gap-3">
        <DanceStyleBar style={lesson.danceStyle} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold leading-8">{lesson.name}</h1>
          {subtitle && <p className="truncate text-[13px] font-medium text-primary-100">{subtitle}</p>}
        </div>
      </div>

      {term.overview && (
        <dl className="mt-3.5 grid grid-cols-3 gap-2">
          <StatTile tone="onPrimary" value={term.overview.sessions} label="已上堂數" />
          <StatTile tone="onPrimary" value={term.overview.average} label="平均出席" />
          <StatTile
            tone="onPrimary"
            value={term.totalRevenue === undefined ? "…" : `$${formatMoney(term.totalRevenue)}`}
            label={term.termNumber !== null ? "這期收入" : "累計收入"}
          />
        </dl>
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
        <button
          type="button"
          className={MENU_ITEM}
          onClick={() => {
            setMoreOpen(false);
            onOpenSettings();
          }}
        >
          <Settings className="size-4" />
          課程設定
        </button>
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
