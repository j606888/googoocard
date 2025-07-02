import { DraftLesson } from "@/store/slices/lessons";

const STORAGE_KEY = "lesson-draft";

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