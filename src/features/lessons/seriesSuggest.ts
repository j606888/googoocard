import type { LessonSummary } from "@/store/slices/lessons";

/**
 * 「整理課種」的建議（純函式）：把課名去掉期別、月份、括號裡的註記之後一樣的課
 * 歸成同一個課種。只是建議——名稱和要不要套用都由老師在畫面上決定。
 */

export interface SeriesSuggestion {
  /** 正規化後的課名，同一個建議的 key。 */
  key: string;
  /** 建議的課種名稱（可改）。 */
  name: string;
  /** 新的在前。 */
  lessons: LessonSummary[];
}

/**
 * 「Bachata training [KH]」「Bachata training 第 3 期」「10月份 Bachata training」
 * → 「bachata training」。括號（半形／全形／方括號）連同內容一起拿掉。
 */
export const seriesNameKey = (name: string): string =>
  name
    .replace(/[\[［(（【][^\]］)）】]*[\]］)）】]/g, " ")
    .replace(/第\s*[0-9一二三四五六七八九十]+\s*期/g, " ")
    .replace(/(20\d{2}\s*年?)?\s*\d{1,2}\s*月份?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** 顯示用：同樣的清理，但保留大小寫。清到空的就用原名。 */
const displayName = (name: string): string => {
  const cleaned = name
    .replace(/[\[［(（【][^\]］)）】]*[\]］)）】]/g, " ")
    .replace(/第\s*[0-9一二三四五六七八九十]+\s*期/g, " ")
    .replace(/(20\d{2}\s*年?)?\s*\d{1,2}\s*月份?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name.trim();
};

const startOf = (lesson: LessonSummary) =>
  lesson.firstPeriodStart ? new Date(lesson.firstPeriodStart).getTime() : 0;

/**
 * 每一組建議裡至少要有一門課「現在不在那個名字的課種裡」才會列出來——
 * 已經整理好的不再打擾。名稱取那一組最新一門課清理後的課名。
 */
export const suggestSeries = (
  lessons: LessonSummary[],
  groups: { id: number; name: string }[]
): SeriesSuggestion[] => {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const clusters = new Map<string, LessonSummary[]>();
  for (const lesson of lessons) {
    const key = seriesNameKey(lesson.name) || lesson.name.trim().toLowerCase();
    clusters.set(key, [...(clusters.get(key) ?? []), lesson]);
  }

  const suggestions: SeriesSuggestion[] = [];
  for (const [key, members] of clusters) {
    const sorted = [...members].sort((a, b) => startOf(b) - startOf(a) || b.id - a.id);
    const name = displayName(sorted[0].name);
    const settled = sorted.every(
      (lesson) =>
        lesson.groupId !== null && seriesNameKey(groupName.get(lesson.groupId) ?? "") === key
    );
    if (!settled) suggestions.push({ key, name, lessons: sorted });
  }
  // 期數多的排前面：最值得先整理。
  return suggestions.sort(
    (a, b) => b.lessons.length - a.lessons.length || a.name.localeCompare(b.name, "zh-Hant")
  );
};
