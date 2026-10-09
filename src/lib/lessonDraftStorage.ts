import { DraftLesson } from "@/store/slices/lessons";

const STORAGE_KEY = "lesson-draft";
const CLONE_KEY = "lesson-clone-source";

// Drafts and clone sources saved before dance styles became classroom data
// carry a `danceType` enum value and no `danceStyleId`. There is no way to map
// that back to a style here, so such an entry is dropped.
const isLegacy = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  "danceType" in value &&
  !("danceStyleId" in value);

export const getLessonDraft = (): DraftLesson | null => {
  const draft = localStorage.getItem(STORAGE_KEY);
  if (!draft) return null;

  const parsed = JSON.parse(draft);
  if (isLegacy(parsed)) {
    clearLessonDraft();
    return null;
  }
  return parsed;
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
  danceStyleId: number | null;
  level?: number;
  groupId?: number | null;
  initialPeriod?: { startTime: string; endTime: string };
}

export const setLessonCloneSource = (source: LessonCloneSource) => {
  localStorage.setItem(CLONE_KEY, JSON.stringify(source));
};

export const getLessonCloneSource = (): LessonCloneSource | null => {
  const source = localStorage.getItem(CLONE_KEY);
  if (!source) return null;
  const parsed = JSON.parse(source);
  if (isLegacy(parsed)) {
    clearLessonCloneSource();
    return null;
  }
  return parsed;
};

export const clearLessonCloneSource = () => {
  localStorage.removeItem(CLONE_KEY);
};