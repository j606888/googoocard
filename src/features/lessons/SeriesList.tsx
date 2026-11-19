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
import DanceStyleTile from "@/components/DanceStyleTile";
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

/** 桌面的欄位：課種｜舞種·分部｜這一期｜學生｜下一堂｜動作。手機是一張卡：色塊＋名稱＋兩行摘要。 */
const COLS =
  "lg:grid lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_56px_minmax(0,1.2fr)_128px] lg:gap-3";

/** 進度條最多畫幾格；堂數更多的課只寫數字。 */
const MAX_SEGMENTS = 12;

/** 固定堂數的課：上過的填滿、下一堂用珊瑚橘、還沒到的留灰。 */
const ProgressSegments = ({ lesson }: { lesson: LessonSummary }) => {
  if (lesson.kind !== "fixed" || lesson.totalPeriods < 2 || lesson.totalPeriods > MAX_SEGMENTS) return null;
  return (
    <span aria-hidden="true" className="flex shrink-0 gap-1">
      {Array.from({ length: lesson.totalPeriods }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-full ${
            i < lesson.attendedCount
              ? "bg-primary-800"
              : i === lesson.attendedCount && lesson.nextSessionDate
                ? "bg-accent-500"
                : "bg-neutral-200"
          }`}
        />
      ))}
    </span>
  );
};

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

const styleLabel = (lesson: LessonSummary) =>
  [danceStyleMeta(lesson.danceStyle).label, lesson.location?.name].filter(Boolean).join(" · ");

const TermRow = ({ term, series, now }: { term: SeriesTerm; series: LessonSeries; now: Date }) => {
  const { lesson, number } = term;
  const running = lesson.status === "inProgress";
  const title = number !== null ? `第 ${number} 期` : lesson.name;
  return (
    <li>
      <Link
        href={`/lessons/${lesson.id}`}
        className={`flex min-h-12 items-center gap-3 border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-[13px] text-neutral-700 hover:bg-neutral-100 ${COLS}`}
      >
        <span className="min-w-0 flex-1 lg:pl-12">
          <span className="font-semibold text-neutral-900">{title}</span>
          {number !== null && lesson.name !== series.name && (
            <span className="ml-2 text-neutral-600">{lesson.name}</span>
          )}
          <span className="block truncate text-xs text-neutral-600 lg:hidden">
            {rangeLabel(lesson, now)} · {termProgress(lesson)}
          </span>
        </span>
        <span className="hidden truncate tabular-nums lg:block">{rangeLabel(lesson, now)}</span>
        <span className="hidden truncate lg:block">{termProgress(lesson)}</span>
        <span className="hidden tabular-nums lg:block">{lesson.studentCount}</span>
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
  const termTitle =
    series.active.length === 1 && lead
      ? lead.kind === "ongoing"
        ? "持續開課"
        : series.lead?.number != null
          ? `第 ${series.lead.number} 期`
          : null
      : null;

  const cells = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <DanceStyleTile
          style={lead?.danceStyle}
          name={series.name}
          className={`lg:size-9 lg:rounded-lg lg:text-xs ${lead ? "" : "bg-neutral-200"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-bold text-neutral-900 lg:text-[15px] lg:font-semibold">
              {series.name}
              {lead && running && (
                <span className="ml-2 hidden text-[13px] font-normal text-neutral-600 lg:inline">
                  {peopleLabel(lead)}
                </span>
              )}
            </span>
          </span>
          {/* 手機的兩行摘要：在哪、誰教、下一堂；這一期上到哪。 */}
          <span className="block truncate text-[13px] text-neutral-600 lg:hidden">
            {nextToday && (
              <span className="mr-1.5 rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-bold text-accent-900">
                今天 {format(new Date(lead!.nextSessionDate!), "HH:mm")}
              </span>
            )}
            {running && lead
              ? // 下一堂排最前面：這一行會截字，被截掉的應該是老師名字而不是時間。
                [!nextToday && next && `下一堂 ${next}`, lead.location?.name, peopleLabel(lead)]
                  .filter(Boolean)
                  .join(" · ")
              : [termSummary(series), next].filter(Boolean).join(" · ")}
          </span>
          {running && lead && (
            <span className="mt-1.5 flex items-center gap-2 text-xs text-neutral-600 lg:hidden">
              {termTitle ? (
                <>
                  <span className="shrink-0 font-bold text-primary-900">{termTitle}</span>
                  <ProgressSegments lesson={lead} />
                  <span className="truncate">
                    {lead.kind === "ongoing"
                      ? `已上 ${lead.attendedCount} 堂`
                      : `已上 ${lead.attendedCount} / ${lead.totalPeriods} 堂`}
                  </span>
                </>
              ) : (
                <span className="truncate">{termSummary(series)}</span>
              )}
            </span>
          )}
        </span>
      </span>
      <span className="hidden truncate text-[13px] text-neutral-700 lg:block">
        {lead ? styleLabel(lead) : ""}
      </span>
      <span className="hidden truncate text-[13px] text-neutral-700 lg:block">{termSummary(series)}</span>
      <span className="hidden text-sm tabular-nums lg:block">{running ? students : ""}</span>
      <span className="hidden truncate text-[13px] tabular-nums text-neutral-700 lg:block">{next}</span>
      {/* 列尾動作疊在這一格上面（見下方）；手機只留展開鈕的位置。 */}
      <span aria-hidden="true" className={`shrink-0 lg:w-[128px] max-lg:w-8`} />
    </>
  );

  const rowClass = `flex min-h-14 w-full cursor-pointer items-center gap-3 p-3 text-left hover:bg-neutral-50 lg:px-4 lg:py-2 ${COLS}`;
  const schedule = lead && series.active.length === 1 && needsNextPeriod(lead);

  return (
    <li className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white lg:overflow-visible lg:rounded-none lg:border-0 lg:border-t lg:first:border-t-0">
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
      <div className="absolute top-2.5 right-2 flex h-9 items-center gap-1 lg:right-3">
        {schedule ? (
          <Button
            variant="secondary"
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
            <div className="flex flex-wrap items-center gap-1 border-t border-neutral-100 bg-neutral-50 px-4 py-1.5 lg:pl-16">
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
      <div className="flex flex-col gap-5">
        {sections.map((section) => (
          <section key={section.location?.id ?? "none"} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-neutral-800">
              {section.location?.name ?? "未設分部"}
              <span className="ml-2 font-normal text-neutral-600">{section.series.length} 個課種開課中</span>
            </h3>
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
    <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-neutral-200 lg:bg-white">
      <div
        className={`hidden h-10 items-center bg-neutral-50 px-4 text-xs font-medium text-neutral-600 ${COLS}`}
      >
        <span>課種</span>
        <span>舞種 · 分部</span>
        <span>這一期</span>
        <span>學生</span>
        <span>下一堂</span>
        <span />
      </div>
      <ul className="flex flex-col gap-2.5 lg:block">
        {series.map((item) => (
          <SeriesRow key={item.key} series={item} now={now} onSchedule={onSchedule} />
        ))}
      </ul>
    </div>
  );
};

export default SeriesList;
