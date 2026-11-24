"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { differenceInCalendarDays } from "date-fns";
import { BookOpenText, ChevronDown, Copy, PencilLine, Plus, Trash } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import Drawer from "@/components/Drawer";
import Field from "@/components/Field";
import {
  useDeleteLessonGroupMutation,
  useRenameLessonGroupMutation,
} from "@/store/slices/lessonGroups";
import { Button } from "@/components/ui/button";
import DanceStyleDot from "@/components/DanceStyleDot";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import type { LessonSummary } from "@/store/slices/lessons";
import { needsNextPeriod } from "./lessonGrouping";
import { stashLessonClone } from "./lessonClone";
import NextPeriodDrawer from "./NextPeriodDrawer";
import {
  termProgress,
  termSummary,
  UNCLASSIFIED_KEY,
  type LessonSeries,
  type LocationSection,
  type SeriesTerm,
} from "./lessonSeries";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 桌面的欄位：課種＋老師｜舞種·這一期｜幾位學生｜下一堂｜動作。不放表頭——每一格都寫成
 * 一句話（「Bachata · 第 7 期，上了 0 / 5 堂」「5 位學生」「下一堂 …」）。手機收成名稱下面兩行。
 */
const COLS =
  "lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_88px_minmax(0,1.3fr)_128px] lg:gap-4";

const day = (iso: string, now: Date) => {
  const date = new Date(iso);
  return format(date, date.getFullYear() === now.getFullYear() ? "MM/dd" : "yyyy/MM/dd");
};

const nextLabel = (lesson: LessonSummary, now: Date) => {
  if (lesson.nextSessionDate) {
    const next = new Date(lesson.nextSessionDate);
    return `${format(next, "M/d")}（${WEEKDAYS[next.getDay()]}）${format(next, "HH:mm")}`;
  }
  if (lesson.status === "finished") {
    return lesson.lastPeriodEnd ? `${day(lesson.lastPeriodEnd, now)} 結束` : "已結束";
  }
  return "還沒排";
};

const rangeLabel = (lesson: LessonSummary, now: Date) =>
  lesson.firstPeriodStart && lesson.lastPeriodEnd
    ? `${day(lesson.firstPeriodStart, now)} – ${day(lesson.lastPeriodEnd, now)}`
    : "還沒排時段";

const peopleLabel = (lesson: LessonSummary) => {
  const teachers = lesson.teachers.map((t) => t.name).join("、");
  const assistants = (lesson.assistants ?? []).map((t) => t.name).join("、");
  return [teachers, assistants && `小幫手 ${assistants}`].filter(Boolean).join(" · ");
};

/** 「Bachata · 第 7 期，上了 0 / 5 堂」：舞種名跟這一期放一起，分部已經是區塊標題。 */
const styleTermLabel = (lesson: LessonSummary | null, series: LessonSeries) =>
  [lesson ? danceStyleMeta(lesson.danceStyle).label : null, termSummary(series)].filter(Boolean).join(" · ");

const TermRow = ({ term, series, now }: { term: SeriesTerm; series: LessonSeries; now: Date }) => {
  const { lesson, number } = term;
  const running = lesson.status === "inProgress";
  const title = number !== null ? `第 ${number} 期` : lesson.name;
  return (
    <li>
      <Link
        href={`/lessons/${lesson.id}`}
        className={`flex min-h-12 items-center gap-3 border-t border-line py-2 pl-5 pr-2 text-[13px] text-ink-2 hover:bg-primary-50 lg:pl-0 ${COLS}`}
      >
        <span className="min-w-0 flex-1 lg:pl-5">
          <span className="font-semibold text-ink">{title}</span>
          {number !== null && lesson.name !== series.name && (
            <span className="ml-2 text-neutral-600">{lesson.name}</span>
          )}
          <span className="block truncate text-xs text-neutral-600 lg:hidden">
            {rangeLabel(lesson, now)} · {termProgress(lesson)}
          </span>
        </span>
        <span className="hidden truncate tabular-nums lg:block">
          {rangeLabel(lesson, now)} · {termProgress(lesson)}
        </span>
        <span className="hidden tabular-nums lg:block">{lesson.studentCount} 位學生</span>
        <span className={`shrink-0 font-medium ${running ? "text-primary-700" : "text-neutral-600"}`}>
          {running ? "進行中" : "已結束"}
        </span>
        <span aria-hidden="true" className="hidden lg:block" />
      </Link>
    </li>
  );
};

const SeriesRow = ({
  series,
  now,
  onSchedule,
}: {
  series: LessonSeries;
  now: Date;
  onSchedule: (lesson: LessonSummary) => void;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const lead = series.lead?.lesson ?? null;
  // 沒歸課種的單一門課沒有「各期」可展開，整列直接進那門課。
  const isSingle = series.groupId === null && series.key !== UNCLASSIFIED_KEY;
  const students = series.active.reduce((sum, term) => sum + term.lesson.studentCount, 0);
  const panelId = `series-${series.key}`;
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newName, setNewName] = useState(series.name);
  const [renameGroup, { isLoading: isRenaming }] = useRenameLessonGroupMutation();
  const [deleteGroup, { isLoading: isDeleting }] = useDeleteLessonGroupMutation();

  const handleRename = async () => {
    const name = newName.trim();
    if (!name || series.groupId === null) return;
    try {
      await renameGroup({ id: series.groupId, name }).unwrap();
      setRenaming(false);
    } catch {
      toast.error("改名失敗，可能已經有同名的課種");
    }
  };
  const handleDelete = async () => {
    if (series.groupId === null) return;
    await deleteGroup(series.groupId);
    setDeleting(false);
  };

  const openNewTerm = () => {
    const source = series.terms[0]?.lesson;
    if (source) {
      stashLessonClone(source);
      router.push("/lessons/new");
    } else {
      router.push(`/lessons/new?groupId=${series.groupId}`);
    }
  };

  // 只有一期在開的課種，整列直接進那一期——不用先展開再選期。
  const direct = isSingle ? lead : series.active.length === 1 ? series.active[0].lesson : null;
  const running = series.active.length > 0;
  const nextToday =
    lead?.nextSessionDate && running && series.key !== UNCLASSIFIED_KEY
      ? differenceInCalendarDays(new Date(lead.nextSessionDate), now) === 0
      : false;
  const next = lead && series.key !== UNCLASSIFIED_KEY ? nextLabel(lead, now) : "";
  const people = lead && running ? peopleLabel(lead) : "";
  const cells = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <DanceStyleDot style={lead?.danceStyle} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-ink lg:text-[15px]">
            {series.name}
            {people && <span className="ml-2 hidden text-[13px] font-normal text-ink-3 lg:inline">老師 {people}</span>}
          </span>
          {/* 手機的兩行摘要：舞種·這一期·幾位學生；下一堂·老師。 */}
          <span className="block truncate text-[13px] text-ink-2 lg:hidden">
            {[styleTermLabel(lead, series), running && `${students} 位學生`].filter(Boolean).join(" · ")}
          </span>
          {(next || people) && (
            <span className="block truncate text-[13px] text-ink-2 lg:hidden">
              {next && (
                <span className={nextToday ? "font-semibold text-primary-800" : ""}>
                  {nextToday
                    ? `今天 ${format(new Date(lead!.nextSessionDate!), "HH:mm")}`
                    : next === "還沒排"
                      ? "還沒排下一堂"
                      : running
                        ? `下一堂 ${next}`
                        : next}
                </span>
              )}
              {next && people && " · "}
              {people && `老師 ${people}`}
            </span>
          )}
        </span>
      </span>
      <span className="hidden truncate text-[13px] text-ink-2 lg:block">{styleTermLabel(lead, series)}</span>
      <span className="hidden text-[13px] tabular-nums text-ink-2 lg:block">{running ? `${students} 位學生` : ""}</span>
      <span
        className={`hidden truncate text-[13px] tabular-nums lg:block ${
          nextToday ? "font-semibold text-primary-800" : "text-ink-2"
        }`}
      >
        {next && (running ? (next === "還沒排" ? "還沒排下一堂" : `下一堂 ${next}`) : next)}
      </span>
      {/* 列尾動作疊在這一格上面（見下方）；手機只留展開鈕的位置。 */}
      <span aria-hidden="true" className={`shrink-0 lg:w-[128px] max-lg:w-8`} />
    </>
  );

  const rowClass = `flex min-h-16 w-full cursor-pointer items-center gap-3 py-3 text-left hover:bg-primary-50 lg:min-h-13 lg:py-2.5 ${COLS}`;
  const schedule = lead && series.active.length === 1 && needsNextPeriod(lead);

  return (
    <li className="relative border-t border-line first:border-t-0">
      {direct ? (
        <Link href={`/lessons/${direct.id}`} className={rowClass}>
          {cells}
        </Link>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className={rowClass}
        >
          {cells}
        </button>
      )}

      {/* 動作疊在列尾：放在列的連結／按鈕裡面會變成互動元素包互動元素。 */}
      <div className="absolute top-3 right-0 flex h-9 items-center gap-1 lg:top-2.5">
        {schedule ? (
          <Button
            variant="text"
            size="sm"
            className="gap-1 max-lg:hidden"
            onClick={() => onSchedule(lead)}
          >
            <Plus className="size-4" />
            下一堂
          </Button>
        ) : (
          isSingle &&
          lead && (
            <Button
              variant="ghost"
              size="iconSm"
              className="text-neutral-600"
              aria-label={`複製「${lead.name}」開新一期`}
              title="開新一期"
              onClick={openNewTerm}
            >
              <Copy className="size-4" />
            </Button>
          )
        )}
        {!isSingle && (
          <Button
            variant="ghost"
            size="iconSm"
            className="text-neutral-600"
            aria-label={`${open ? "收起" : "展開"}「${series.name}」的各期與動作`}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        )}
      </div>

      {!isSingle && open && (
        <div id={panelId}>
          <ul>
            {series.terms.map((term) => (
              <TermRow key={term.lesson.id} term={term} series={series} now={now} />
            ))}
          </ul>
          {series.groupId !== null && (
            <div className="flex flex-wrap items-center gap-1 border-t border-line py-1.5 pl-3 lg:pl-3">
              <Button variant="ghost" size="sm" className="gap-1 text-primary-700" asChild>
                <Link href={`/lessons/groups/${series.groupId}`}>
                  <BookOpenText className="size-4" />
                  課種頁
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-primary-700" onClick={openNewTerm}>
                <Plus className="size-4" />
                開新一期
              </Button>
              {schedule && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-primary-700 lg:hidden"
                  onClick={() => onSchedule(lead)}
                >
                  <Plus className="size-4" />
                  排下一堂
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-neutral-600"
                onClick={() => {
                  setNewName(series.name);
                  setRenaming(true);
                }}
              >
                <PencilLine className="size-4" />
                改名
              </Button>
              {series.terms.length === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-danger-700"
                  onClick={() => setDeleting(true)}
                >
                  <Trash className="size-4" />
                  刪除
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {renaming && (
        <Drawer
          title="課種改名"
          open
          onClose={() => setRenaming(false)}
          onSubmit={handleRename}
          isLoading={isRenaming}
          disabled={!newName.trim()}
          submitText="儲存"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
          >
            <Field label="名稱" className="mb-4" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </form>
        </Drawer>
      )}
      <ConfirmDialog
        open={deleting}
        title={`刪除「${series.name}」？`}
        message="這個課種底下沒有任何課，刪掉不影響其他資料。"
        confirmLabel="刪除"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(false)}
      />
    </li>
  );
};

/**
 * 「所有課程」：一個課種一列（手機是一張卡）。只有一期在開的課種，點了直接進那一期；
 * 其他期與課種的動作（課種頁、開新一期、改名）收在列尾的展開鈕裡。
 * 手機與桌面同一棵樹——手機把後面幾欄收成名稱下面的兩行摘要。
 */
const SeriesList = ({
  series,
  now,
  sections,
}: {
  series: LessonSeries[];
  now: Date;
  /** 「開課中」依分部分區（`sectionByLocation`）；不傳就是一整張表。 */
  sections?: LocationSection[];
}) => {
  const [scheduling, setScheduling] = useState<LessonSummary | null>(null);
  if (sections) {
    return (
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section.location?.id ?? "none"} className="flex flex-col">
            <h3 className="text-[13px] font-semibold text-ink-2">{section.location?.name ?? "未設分部"}</h3>
            <SeriesTable series={section.series} now={now} onSchedule={setScheduling} />
          </section>
        ))}
        {scheduling && <NextPeriodDrawer lesson={scheduling} onClose={() => setScheduling(null)} />}
      </div>
    );
  }
  return (
    <>
      <SeriesTable series={series} now={now} onSchedule={setScheduling} />
      {scheduling && <NextPeriodDrawer lesson={scheduling} onClose={() => setScheduling(null)} />}
    </>
  );
};

const SeriesTable = ({
  series,
  now,
  onSchedule,
}: {
  series: LessonSeries[];
  now: Date;
  onSchedule: (lesson: LessonSummary) => void;
}) => {
  return (
    <div>
      <ul>
        {series.map((item) => (
          <SeriesRow key={item.key} series={item} now={now} onSchedule={onSchedule} />
        ))}
      </ul>
    </div>
  );
};

export default SeriesList;
