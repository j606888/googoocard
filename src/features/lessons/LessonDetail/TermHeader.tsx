"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, ChevronDown, ChevronLeft, Ellipsis, Plus } from "lucide-react";
import Menu from "@/components/Menu";
import type { Lesson } from "@/store/slices/lessons";
import { stashLessonClone } from "../lessonClone";
import { LessonInfoTip, LessonStatusText } from "./LessonDetailHeader";
import type { useTermPage } from "./useTermPage";

const ICON_BUTTON =
  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-primary-50";
const MENU_ITEM =
  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-100";

/**
 * 手機的「這一期」頁首（去框線改版：白底）：回課程、切換期、⋯（開新一期、課種頁），下面只有課名＋狀態，
 * 分頁列緊接著。誰教、在哪、幾點收在課名旁的 ⓘ 和「設定」分頁；這一期上到哪、收多少在「時段」分頁標題下。
 * 編輯＝「設定」分頁，頁首不再放一顆。
 */
const TermHeader = ({
  lesson,
  term,
}: {
  lesson: Lesson;
  term: ReturnType<typeof useTermPage>;
}) => {
  const router = useRouter();
  const switcherRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [switching, setSwitching] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const running = lesson.status !== "finished";

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

      <h1 className="mt-1 flex items-center gap-1.5 text-[28px] font-semibold leading-9 tracking-[-0.01em] text-ink">
        <span className="min-w-0 break-words">{lesson.name}</span>
        <LessonInfoTip lesson={lesson} />
        <LessonStatusText finished={!running} />
      </h1>

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
