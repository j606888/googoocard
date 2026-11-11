import { addDays } from "date-fns";
import type { LessonSummary } from "@/store/slices/lessons";
import { setLessonCloneSource } from "@/lib/lessonDraftStorage";

/**
 * 「開新一期」：把這一期的設定存成新增課程的草稿來源（老師、課卡、舞種、課種、分部…），
 * 第一堂預設排在上一期最後一堂的下一週。呼叫端接著導到 `/lessons/new`。
 */
export const stashLessonClone = (lesson: LessonSummary) => {
  const initialPeriod =
    lesson.lastPeriodStart && lesson.lastPeriodEnd
      ? {
          startTime: addDays(new Date(lesson.lastPeriodStart), 7).toISOString(),
          endTime: addDays(new Date(lesson.lastPeriodEnd), 7).toISOString(),
        }
      : undefined;
  setLessonCloneSource({
    lessonName: lesson.name,
    teacherIds: lesson.teachers.map((t) => t.id),
    assistantIds: (lesson.assistants ?? []).map((t) => t.id),
    cardIds: lesson.cardIds,
    danceStyleId: lesson.danceStyleId,
    level: lesson.level,
    kind: lesson.kind,
    sessionsPerAttendance: lesson.sessionsPerAttendance,
    dropInPrice: lesson.dropInPrice,
    dropInOptions: lesson.dropInOptions ?? null,
    groupId: lesson.groupId,
    locationId: lesson.location?.id ?? null,
    initialPeriod,
  });
};
