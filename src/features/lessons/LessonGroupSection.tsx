"use client";

import Link from "next/link";
import { ChevronDown, Folder, Plus } from "lucide-react";
import { LessonSection, UNGROUPED_ID } from "./lessonGrouping";
import LessonTable from "./LessonTable";

/**
 * 一個群組：標題列 + 直接展開的課程列表（不用再點進群組頁）。
 * 標題列可以收合，收合狀態由 `useLessonsList` 記住。
 */
const LessonGroupSection = ({
  section,
  collapsed,
  onToggle,
}: {
  section: LessonSection;
  collapsed: boolean;
  onToggle: () => void;
}) => {
  const isUngrouped = section.id === UNGROUPED_ID;
  const contentId = `lesson-group-${section.id}`;
  const count = section.lessons.length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 lg:gap-2.5 min-h-11">
        <button
          onClick={onToggle}
          disabled={count === 0}
          aria-expanded={count > 0 && !collapsed}
          aria-controls={contentId}
          className="flex items-center gap-2 lg:gap-2.5 min-w-0 py-1.5 pr-2 -ml-1 pl-1 rounded-lg hover:bg-neutral-100 disabled:hover:bg-transparent disabled:cursor-default transition-colors cursor-pointer"
        >
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-neutral-400 transition-transform ${
              collapsed || count === 0 ? "-rotate-90" : ""
            } ${count === 0 ? "invisible" : ""}`}
          />
          <span
            className={`w-7 h-7 shrink-0 rounded-[9px] flex items-center justify-center ${
              isUngrouped ? "bg-neutral-200 text-neutral-500" : "bg-neutral-800 text-white"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
          </span>
          <h3
            className={`text-[15px] font-bold truncate ${isUngrouped ? "text-neutral-600" : "text-neutral-900"}`}
          >
            {section.name}
          </h3>
          <span className="text-xs text-neutral-500 shrink-0">
            {count === 0
              ? "目前沒有進行中的課"
              : `${count} 門課${section.studentCount > 0 ? ` · ${section.studentCount} 位學生` : ""}`}
          </span>
        </button>
        {!isUngrouped && (
          <Link
            href={`/lessons/new?groupId=${section.id}`}
            className="ml-auto flex items-center gap-1 shrink-0 text-sm font-semibold text-primary-700 hover:bg-primary-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="max-lg:sr-only">在這組開課</span>
          </Link>
        )}
      </div>

      {/* 空的群組只留標題列（「在這組開課」還在），不再佔一整塊虛線框。 */}
      {!collapsed && count > 0 && (
        <div id={contentId}>
          <LessonTable lessons={section.lessons} />
        </div>
      )}
    </section>
  );
};

export default LessonGroupSection;
