import type { LessonSummary } from "@/store/slices/lessons";

/**
 * 課種 → 期。一個 `LessonGroup` 就是一個課種（Bachata Level 1），底下每門課是一期；
 * 「第幾期」不存，照同課種裡各期的開始日排出來。全部是純函式，狀態在 `useLessonsList`。
 *
 * 還沒歸到課種的課：進行中的各自成一列（看起來就是只有一期的課種），
 * 已結束的集中到「未分類」。
 */

export const UNCLASSIFIED_KEY = "unclassified";

export interface SeriesTerm {
  lesson: LessonSummary;
  /** 第幾期；沒歸課種的課是 null。 */
  number: number | null;
}

export interface LessonSeries {
  key: string;
  /** null = 沒歸課種的單一門課，或「未分類」。 */
  groupId: number | null;
  name: string;
  /** 新的在前。 */
  terms: SeriesTerm[];
  /** 進行中的期，下一堂近的在前。 */
  active: SeriesTerm[];
  /** 這一列代表的那一期：進行中裡下一堂最近的，沒有就是最新一期。 */
  lead: SeriesTerm | null;
}

const startOf = (lesson: LessonSummary) =>
  lesson.firstPeriodStart ? new Date(lesson.firstPeriodStart).getTime() : Infinity;

const nextOf = (lesson: LessonSummary) =>
  lesson.nextSessionDate ? new Date(lesson.nextSessionDate).getTime() : Infinity;

const isActive = (lesson: LessonSummary) => lesson.status === "inProgress";

const makeSeries = (
  key: string,
  groupId: number | null,
  name: string,
  terms: SeriesTerm[]
): LessonSeries => {
  const active = terms
    .filter((term) => isActive(term.lesson))
    .sort((a, b) => nextOf(a.lesson) - nextOf(b.lesson) || a.lesson.id - b.lesson.id);
  return { key, groupId, name, terms, active, lead: active[0] ?? terms[0] ?? null };
};

export const buildSeries = (
  lessons: LessonSummary[],
  groups: { id: number; name: string }[]
): LessonSeries[] => {
  const byGroup = new Map<number, LessonSummary[]>();
  const loose: LessonSummary[] = [];
  for (const lesson of lessons) {
    if (lesson.groupId === null) loose.push(lesson);
    else byGroup.set(lesson.groupId, [...(byGroup.get(lesson.groupId) ?? []), lesson]);
  }

  const series = groups.map((group) => {
    const ordered = [...(byGroup.get(group.id) ?? [])].sort(
      (a, b) => startOf(a) - startOf(b) || a.id - b.id
    );
    const terms = ordered.map((lesson, index) => ({ lesson, number: index + 1 })).reverse();
    return makeSeries(`group-${group.id}`, group.id, group.name, terms);
  });

  for (const lesson of loose.filter(isActive)) {
    series.push(makeSeries(`lesson-${lesson.id}`, null, lesson.name, [{ lesson, number: null }]));
  }

  const finishedLoose = loose
    .filter((lesson) => !isActive(lesson))
    .sort((a, b) => startOf(b) - startOf(a) || b.id - a.id);
  if (finishedLoose.length > 0) {
    series.push(
      makeSeries(
        UNCLASSIFIED_KEY,
        null,
        "未分類",
        finishedLoose.map((lesson) => ({ lesson, number: null }))
      )
    );
  }
  return series;
};

export interface SeriesFilter {
  search: string;
  danceStyleId: number | null;
  locationId: number | null;
  /** 只看這位老師教的或當小幫手的課；null = 不篩。 */
  teacherId: number | null;
}

export const isMyLesson = (
  lesson: { teachers: { id: number }[]; assistants?: { id: number }[] },
  teacherId: number
) =>
  lesson.teachers.some((t) => t.id === teacherId) ||
  (lesson.assistants ?? []).some((t) => t.id === teacherId);

const lessonMatches = (lesson: LessonSummary, filter: SeriesFilter, q: string) =>
  (filter.danceStyleId === null || lesson.danceStyleId === filter.danceStyleId) &&
  (filter.locationId === null || lesson.location?.id === filter.locationId) &&
  (filter.teacherId === null || isMyLesson(lesson, filter.teacherId)) &&
  (!q ||
    lesson.name.toLowerCase().includes(q) ||
    lesson.teachers.some((t) => t.name.toLowerCase().includes(q)) ||
    (lesson.assistants ?? []).some((t) => t.name.toLowerCase().includes(q)));

/**
 * 開課中的課種看「進行中的期」符不符合，沒在開的看全部的期——
 * 不然「我的課」會把我兩年前教過、現在別人在教的課種也算進來。
 * 搜尋另外也比對課種名稱。
 */
export const filterSeries = (series: LessonSeries[], filter: SeriesFilter): LessonSeries[] => {
  const q = filter.search.trim().toLowerCase();
  const unfiltered =
    !q && filter.danceStyleId === null && filter.locationId === null && filter.teacherId === null;
  if (unfiltered) return series;
  return series.filter((s) => {
    const pool = s.active.length > 0 ? s.active : s.terms;
    const nameHit = Boolean(q) && s.name.toLowerCase().includes(q);
    return pool.some((term) => lessonMatches(term.lesson, filter, nameHit ? "" : q));
  });
};

/** 「開課中」照下一堂排；「沒在開」照最後一期新的在前；未分類墊底。 */
export const splitSeries = (series: LessonSeries[]) => {
  const active = series
    .filter((s) => s.active.length > 0)
    .sort(
      (a, b) =>
        nextOf(a.lead!.lesson) - nextOf(b.lead!.lesson) || a.name.localeCompare(b.name, "zh-Hant")
    );
  const lastEnd = (s: LessonSeries) => {
    const end = s.terms[0]?.lesson.lastPeriodEnd;
    return end ? new Date(end).getTime() : 0;
  };
  const inactive = series
    .filter((s) => s.active.length === 0)
    .sort((a, b) => {
      if (a.key === UNCLASSIFIED_KEY) return 1;
      if (b.key === UNCLASSIFIED_KEY) return -1;
      return lastEnd(b) - lastEnd(a) || a.name.localeCompare(b.name, "zh-Hant");
    });
  return { active, inactive };
};

/** 一期的進度：「3 / 5 堂」「持續開課 · 已上 5 堂」。 */
export const termProgress = (lesson: LessonSummary): string =>
  lesson.kind === "ongoing"
    ? `持續開課 · 已上 ${lesson.attendedCount} 堂`
    : `${lesson.attendedCount} / ${lesson.totalPeriods} 堂`;

/** 課種那一列的摘要：「第 2 期 · 3 / 5 堂」「2 期進行中」「共 3 期」。 */
export const termSummary = (series: LessonSeries): string => {
  if (series.active.length > 1) return `${series.active.length} 期進行中`;
  const term = series.lead;
  if (!term) return "還沒開過";
  if (series.active.length === 0) return `共 ${series.terms.length} 期`;
  const progress = termProgress(term.lesson);
  return term.number !== null && term.lesson.kind !== "ongoing"
    ? `第 ${term.number} 期 · ${progress}`
    : progress;
};
