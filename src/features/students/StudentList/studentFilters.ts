import { DanceType } from "@prisma/client";
import { Student } from "@/store/slices/students";

export interface StudentFilters {
  tags: string[]; // tag name，例 ["Needs Renewal", "未繳費"]
  qualifications: DanceType[];
  lessonIds: number[];
  inActiveLesson: boolean;
}

export const EMPTY_FILTERS: StudentFilters = {
  tags: [],
  qualifications: [],
  lessonIds: [],
  inActiveLesson: false,
};

const NEEDS_RENEWAL_TAG = "Needs Renewal";

const storageKey = (classroomId: number) => `student-filters:${classroomId}`;

export const loadStudentFilters = (classroomId: number): StudentFilters => {
  try {
    const raw = localStorage.getItem(storageKey(classroomId));
    if (!raw) return EMPTY_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      qualifications: Array.isArray(parsed.qualifications) ? parsed.qualifications : [],
      lessonIds: Array.isArray(parsed.lessonIds) ? parsed.lessonIds : [],
      inActiveLesson: Boolean(parsed.inActiveLesson),
    };
  } catch {
    return EMPTY_FILTERS;
  }
};

export const saveStudentFilters = (classroomId: number, filters: StudentFilters) => {
  try {
    localStorage.setItem(storageKey(classroomId), JSON.stringify(filters));
  } catch {
    // ignore quota / serialization errors
  }
};

export const countActiveFilters = (f: StudentFilters): number =>
  f.tags.length + f.qualifications.length + f.lessonIds.length + (f.inActiveLesson ? 1 : 0);

export const applyStudentFilters = (
  students: Student[],
  f: StudentFilters
): Student[] =>
  students.filter((s) => {
    // 同類別內 OR，不同類別之間 AND
    if (f.tags.length > 0 && !s.tags?.some((t) => f.tags.includes(t.name))) return false;
    if (
      f.qualifications.length > 0 &&
      !f.qualifications.some((q) => s.danceQualifications?.includes(q))
    )
      return false;
    if (f.lessonIds.length > 0 && !f.lessonIds.some((id) => s.activeLessonIds.includes(id)))
      return false;
    if (f.inActiveLesson && !s.isInActiveLesson) return false;
    return true;
  });

export const tagLabel = (name: string): string =>
  name === NEEDS_RENEWAL_TAG ? "需續約" : name;

export type StudentSort = "name" | "number";

const sortStorageKey = (classroomId: number) => `student-sort:${classroomId}`;

export const loadStudentSort = (classroomId: number): StudentSort => {
  try {
    const raw = localStorage.getItem(sortStorageKey(classroomId));
    return raw === "number" ? "number" : "name";
  } catch {
    return "name";
  }
};

export const saveStudentSort = (classroomId: number, sort: StudentSort) => {
  try {
    localStorage.setItem(sortStorageKey(classroomId), sort);
  } catch {
    // ignore quota / serialization errors
  }
};
