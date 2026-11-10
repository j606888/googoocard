import Link from "next/link";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import type { TeacherOverviewRow } from "@/store/slices/teachers";
import StatusTag from "@/components/StatusTag";
import TeacherAvatar from "./TeacherAvatar";
import { periodLabel } from "./format";

/** How many lessons a card lists before 「還有 N 堂」. */
const LESSON_LIMIT = 3;

/** One teacher on the overview: who, which branches, what's next, which lessons. */
const TeacherOverviewCard = ({ teacher }: { teacher: TeacherOverviewRow }) => {
  const archived = Boolean(teacher.archivedAt);
  const { nextPeriod, activeLessons, assistedLessons } = teacher;
  const shownAssisted = assistedLessons.slice(0, LESSON_LIMIT);
  const moreAssisted = assistedLessons.length - shownAssisted.length;
  const shownLessons = activeLessons.slice(0, LESSON_LIMIT);
  const moreLessons = activeLessons.length - shownLessons.length;

  return (
    // The name is the card's link (stretched over it); lessons link on top of it.
    <div className="relative rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col gap-4 hover:border-neutral-300 transition-colors">
      <div className="flex items-center gap-3">
        <TeacherAvatar name={teacher.name} color={teacher.color} icon={teacher.icon} muted={archived} />
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <Link
            href={`/teachers/${teacher.id}`}
            className="text-lg font-semibold truncate after:absolute after:inset-0 after:rounded-2xl"
          >
            {teacher.name}
          </Link>
          {teacher.locations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {teacher.locations.map((location) => (
                <span
                  key={location.id}
                  className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700"
                >
                  {location.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {archived && <StatusTag tone="neutral">已封存</StatusTag>}
      </div>

      {!archived && (
        <>
          <div
            className={`rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5 ${
              nextPeriod?.ongoing ? "bg-primary-50" : "bg-neutral-50"
            }`}
          >
            <span
              className={`text-xs ${
                nextPeriod?.ongoing ? "font-semibold text-primary-700" : "text-neutral-500"
              }`}
            >
              {nextPeriod?.ongoing ? "上課中" : "下一堂"}
            </span>
            {nextPeriod ? (
              <span className="text-sm font-medium truncate">
                {periodLabel(nextPeriod.startTime)} · {nextPeriod.lessonName}
              </span>
            ) : (
              <span className="text-sm text-neutral-500">目前沒有排課</span>
            )}
          </div>

          {activeLessons.length === 0 ? (
            assistedLessons.length === 0 && <p className="text-sm text-neutral-500">沒有進行中的課</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {shownLessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    href={`/lessons/${lesson.id}`}
                    className="relative -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${danceStyleMeta(lesson.danceStyle).dot}`}
                    />
                    <span className="truncate">{lesson.name}</span>
                  </Link>
                </li>
              ))}
              {moreLessons > 0 && (
                <li className="px-0 pt-1 text-xs text-neutral-500">還有 {moreLessons} 堂</li>
              )}
            </ul>
          )}

          {assistedLessons.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-neutral-500">協助</span>
              <ul className="flex flex-col gap-0.5">
                {shownAssisted.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/lessons/${lesson.id}`}
                      className="relative -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <span
                        className={`size-2 shrink-0 rounded-full ${danceStyleMeta(lesson.danceStyle).dot}`}
                      />
                      <span className="truncate">{lesson.name}</span>
                    </Link>
                  </li>
                ))}
                {moreAssisted > 0 && (
                  <li className="px-0 pt-1 text-xs text-neutral-500">還有 {moreAssisted} 堂</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeacherOverviewCard;
