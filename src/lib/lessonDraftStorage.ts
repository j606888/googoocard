import { DraftLesson } from "@/store/slices/lessons";
import { DanceType } from "@prisma/client";

const STORAGE_KEY = "lesson-draft";
const CLONE_KEY = "lesson-clone-source";

export const getLessonDraft = (): DraftLesson | null => {
  const draft = localStorage.getItem(STORAGE_KEY);
  if (!draft) return null;

  return JSON.parse(draft);
};

export const updateLessonDraft = (draft: Partial<DraftLesson>) => {
  const existingDraft = getLessonDraft();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...existingDraft, ...draft })
  );
};

export const clearLessonDraft = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export interface LessonCloneSource {
  lessonName: string;
  teacherIds: number[];
  cardIds: number[];
  danceType: DanceType;
  groupId?: number | null;
  initialPeriod?: { startTime: string; endTime: string };
}

export const setLessonCloneSource = (source: LessonCloneSource) => {
  localStorage.setItem(CLONE_KEY, JSON.stringify(source));
};

export const getLessonCloneSource = (): LessonCloneSource | null => {
  const source = localStorage.getItem(CLONE_KEY);
  if (!source) return null;
  return JSON.parse(source);
};

export const clearLessonCloneSource = () => {
  localStorage.removeItem(CLONE_KEY);
};