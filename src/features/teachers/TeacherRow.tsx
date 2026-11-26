import Link from "next/link";
import { ChevronRight } from "lucide-react";
import DanceStyleDot from "@/components/DanceStyleDot";
import { Button } from "@/components/ui/button";
import type { OverviewLesson, TeacherOverviewRow } from "@/store/slices/teachers";
import TeacherAvatar from "./TeacherAvatar";
import { capLessons, lessonMeta } from "./teacherLessons";

/**
 * 一列的欄位。手機：頭像｜內容（名字、課、帳號往下疊）｜›。
 * 電腦：頭像｜名字｜教的課｜帳號｜›，同一棵樹只換格線（docs/ui-responsive.md L1）。
 */
const ROW_GRID =
  "grid grid-cols-[36px_minmax(0,1fr)_16px] gap-x-3 lg:grid-cols-[36px_200px_minmax(0,1fr)_132px_16px] lg:gap-x-5";

/**
 * 老師列表的一列：這個人是誰、教哪些課（不用展開就看得到）、有沒有帳號。
 * 整列點下去進細節頁；「邀請」是列上唯一另外的動作。
 */
const TeacherRow = ({
  teacher,
  showLocation,
  isMe,
  onInvite,
}: {
  teacher: TeacherOverviewRow;
  /** 教室有兩個以上分部時，每堂課後面才寫分部。 */
  showLocation: boolean;
  isMe: boolean;
  /** 管理員才有：邀請沒帳號的老師加入。 */
  onInvite?: () => void;
}) => {
  const archived = Boolean(teacher.archivedAt);
  const { activeLessons, assistedLessons, nextPeriod } = teacher;
  const hasAccount = teacher.userId !== null;
  const meta = [
    teacher.locations.map((location) => location.name).join("、"),
    teacher.kind === "ASSISTANT" ? "小幫手" : teacher.kind === "BOTH" ? "也當小幫手" : null,
    archived ? "已封存" : null,
  ].filter(Boolean);

  return (
    <li>
      {/* 細線留在 li 上；滑過去的淡綠底往左右各多出 12px。 */}
      <div className={`relative -mx-3 items-start rounded-xl px-3 py-3 hover:bg-primary-50 ${ROW_GRID}`}>
        <TeacherAvatar name={teacher.name} color={teacher.color} size="sm" muted={archived} />

        <div className="flex min-h-9 min-w-0 flex-col justify-center">
          <Link
            href={`/teachers/${teacher.id}`}
            className="truncate text-[15px] font-medium text-ink outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-primary-300"
          >
            {teacher.name}
          </Link>
          {(meta.length > 0 || nextPeriod?.ongoing) && (
            <p className="truncate text-[13px] text-ink-3">
              {nextPeriod?.ongoing && (
                <span className="font-semibold text-primary-800">上課中{meta.length > 0 && " · "}</span>
              )}
              {meta.join(" · ")}
            </p>
          )}
        </div>

        <div className="col-start-2 mt-2 flex min-w-0 flex-col gap-0.5 lg:col-start-3 lg:row-start-1 lg:mt-0 lg:py-1.5">
          {activeLessons.length === 0 && assistedLessons.length === 0 ? (
            <p className="text-[13px] leading-6 text-ink-3">目前沒有排課</p>
          ) : (
            <>
              {activeLessons.length > 0 && (
                <LessonLines label={`${teacher.name} 教的課`} lessons={activeLessons} showLocation={showLocation} />
              )}
              {assistedLessons.length > 0 && (
                <>
                  <p
                    aria-hidden="true"
                    className={`text-[13px] font-semibold text-ink-2 ${activeLessons.length > 0 ? "mt-1.5" : ""}`}
                  >
                    協助
                  </p>
                  <LessonLines
                    label={`${teacher.name} 協助的課`}
                    lessons={assistedLessons}
                    showLocation={showLocation}
                  />
                </>
              )}
            </>
          )}
        </div>

        <div className="col-start-2 mt-1 flex min-h-9 items-center gap-1 text-[13px] lg:col-start-4 lg:row-start-1 lg:mt-0">
          <span className="text-ink-3">{hasAccount ? (isMe ? "已加入（你）" : "已加入") : "還沒邀請"}</span>
          {!hasAccount && onInvite && !archived && (
            <Button
              variant="text"
              size="sm"
              className="relative z-10 min-h-11 lg:min-h-9"
              aria-label={`邀請 ${teacher.name} 加入`}
              onClick={onInvite}
            >
              邀請
            </Button>
          )}
        </div>

        <ChevronRight
          aria-hidden="true"
          className="col-start-3 row-start-1 mt-2.5 size-4 text-ink-3 lg:col-start-5"
        />
      </div>
    </li>
  );
};

/** 一組課：一行一堂——舞種圓點、課名、「週四 20:30 · 台南」。超過三堂收成「還有 N 門」。 */
const LessonLines = ({
  label,
  lessons,
  showLocation,
}: {
  label: string;
  lessons: OverviewLesson[];
  showLocation: boolean;
}) => {
  const { shown, more } = capLessons(lessons);
  return (
    <ul aria-label={label} className="flex min-w-0 flex-col">
      {shown.map((lesson) => (
        <li key={lesson.id} className="flex min-w-0 items-center gap-2 leading-6">
          <DanceStyleDot style={lesson.danceStyle} />
          <span className="truncate text-sm text-ink">{lesson.name}</span>
          <span className="shrink-0 text-[13px] tabular-nums text-ink-3">{lessonMeta(lesson, showLocation)}</span>
        </li>
      ))}
      {more > 0 && <li className="pl-4 text-[13px] leading-6 text-ink-3">還有 {more} 門</li>}
    </ul>
  );
};

export default TeacherRow;
