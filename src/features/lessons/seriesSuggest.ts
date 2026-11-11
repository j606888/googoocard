import type { LessonSummary } from "@/store/slices/lessons";

/**
 * 翻新精靈（`/lessons/organize`）的純函式：把舊課程排成「課種 → 期」的初稿、
 * 從課名猜分部。只是初稿——名稱、歸類、分部都由老師在精靈裡決定。
 */

type Named = { id: number; name: string };

const BRACKETS = /[\[［(（【]([^\]］)）】]*)[\]］)）】]/g;
const TERM = /第\s*[0-9一二三四五六七八九十]+\s*期/g;
const MONTH = /(20\d{2}\s*年?)?\s*\d{1,2}\s*月份?/g;
/** 課表排序用的編號：「1. Bachata 進階」「2、Bachata Lv1」。 */
const LEADING_NUMBER = /^\s*\d{1,2}\s*[.．、)）]\s*/;

const clean = (name: string) =>
  name
    .replace(LEADING_NUMBER, " ")
    .replace(BRACKETS, " ")
    .replace(TERM, " ")
    .replace(MONTH, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * 「Bachata training [KH]」「Bachata training 第 3 期」「10月份 Bachata training」
 * 「1. Bachata training」→「bachata training」。括號（半形／全形／方括號）連同內容一起拿掉。
 */
export const seriesNameKey = (name: string): string => clean(name).toLowerCase();

/** 顯示用：同樣的清理，但保留大小寫。清到空的就用原名。 */
export const seriesDisplayName = (name: string): string => clean(name) || name.trim();

/** 課名括號裡常見的分部代號 → 分部名稱。 */
const LOCATION_ALIASES: Record<string, string[]> = {
  kh: ["高雄"],
  khh: ["高雄"],
  tn: ["台南", "臺南"],
  tnn: ["台南", "臺南"],
  tp: ["台北", "臺北"],
  tpe: ["台北", "臺北"],
  tc: ["台中", "臺中"],
  txg: ["台中", "臺中"],
};

/**
 * 從課名的括號註記猜分部：「Kizomba [KH]」→ 高雄、「Bachata Lv2（台南）」→ 台南。
 * 括號裡寫的是分部名稱本身，或是 `LOCATION_ALIASES` 的代號。猜不到 = null。
 */
export const locationHint = <L extends Named>(name: string, locations: L[]): L | null => {
  for (const match of name.matchAll(BRACKETS)) {
    const tag = match[1].trim().toLowerCase();
    if (!tag) continue;
    const direct = locations.find((l) => l.name.trim().toLowerCase() === tag);
    if (direct) return direct;
    const aliases = LOCATION_ALIASES[tag] ?? [];
    const aliased = locations.find((l) => aliases.includes(l.name.trim()));
    if (aliased) return aliased;
    const contains = locations.find((l) => tag.includes(l.name.trim().toLowerCase()));
    if (contains) return contains;
  }
  return null;
};

/**
 * 精靈步驟 ② 的預設分部：已經設好的不動 → 課名的代號 → 第一個分部（排序最前面的）。
 * `locations` 要是可選的分部（沒封存、照排序）。
 */
export const suggestedLocationId = (
  lesson: Pick<LessonSummary, "name" | "location">,
  locations: Named[]
): number | null =>
  lesson.location?.id ?? locationHint(lesson.name, locations)?.id ?? locations[0]?.id ?? null;

/**
 * 這個 `LessonGroup` 是不是「課種」：名稱跟底下至少一門課的課名對得上。
 * 對不上的是改版前的時段班（「週日課程」「週四晚上」），精靈會把它拆掉重排。
 */
export const isSeriesGroup = (group: Named, members: Pick<LessonSummary, "name">[]): boolean => {
  const key = seriesNameKey(group.name);
  return key !== "" && members.some((lesson) => seriesNameKey(lesson.name) === key);
};

export interface DraftSeries {
  /** 精靈裡的 id：`g<groupId>` 是現有的課種、`n<key>` 是依課名新歸的。 */
  key: string;
  name: string;
  /** 要不要歸成課種；取消就是「不歸類」。 */
  enabled: boolean;
  /** 新的在前。 */
  lessonIds: number[];
}

/**
 * 新課種的名稱：各期清理後的課名裡最常出現的寫法（「Bachata Lv2」×5 勝過「Bachata lv2」×1），
 * 一樣多就取最新一期的。`sorted` 要新的在前。
 */
const commonDisplayName = (sorted: LessonSummary[]): string => {
  const counts = new Map<string, number>();
  for (const lesson of sorted) {
    const name = seriesDisplayName(lesson.name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best = seriesDisplayName(sorted[0].name);
  for (const [name, count] of counts) if (count > counts.get(best)!) best = name;
  return best;
};

const startOf = (lesson: LessonSummary) =>
  lesson.firstPeriodStart ? new Date(lesson.firstPeriodStart).getTime() : 0;

const newestFirst = (a: LessonSummary, b: LessonSummary) => startOf(b) - startOf(a) || b.id - a.id;

/**
 * 精靈步驟 ① 的初稿：
 * - 已經是課種的群組原封不動帶進來（重跑精靈＝帶入目前的設定）。
 * - 其他的課（沒歸類或在舊時段班裡）依課名歸類；跟現有課種同名的併進那個課種。
 * 期數多的排前面。
 */
export const draftSeries = (lessons: LessonSummary[], groups: Named[]): DraftSeries[] => {
  const membersOf = new Map<number, LessonSummary[]>();
  for (const lesson of lessons) {
    if (lesson.groupId !== null) {
      membersOf.set(lesson.groupId, [...(membersOf.get(lesson.groupId) ?? []), lesson]);
    }
  }

  const drafts: { key: string; name: string; members: LessonSummary[] }[] = [];
  const byNameKey = new Map<string, (typeof drafts)[number]>();
  const seriesGroupIds = new Set<number>();
  for (const group of groups) {
    const members = membersOf.get(group.id) ?? [];
    if (members.length === 0 || !isSeriesGroup(group, members)) continue;
    seriesGroupIds.add(group.id);
    const draft = { key: `g${group.id}`, name: group.name, members: [...members] };
    drafts.push(draft);
    const nameKey = seriesNameKey(group.name);
    if (!byNameKey.has(nameKey)) byNameKey.set(nameKey, draft);
  }

  for (const lesson of lessons) {
    if (lesson.groupId !== null && seriesGroupIds.has(lesson.groupId)) continue;
    const nameKey = seriesNameKey(lesson.name) || lesson.name.trim().toLowerCase();
    let draft = byNameKey.get(nameKey);
    if (!draft) {
      draft = { key: `n${nameKey}`, name: "", members: [] };
      drafts.push(draft);
      byNameKey.set(nameKey, draft);
    }
    draft.members.push(lesson);
  }

  return drafts
    .map((draft) => {
      const sorted = draft.members.sort(newestFirst);
      return {
        key: draft.key,
        name: draft.name || commonDisplayName(sorted),
        enabled: true,
        lessonIds: sorted.map((l) => l.id),
      };
    })
    .sort((a, b) => b.lessonIds.length - a.lessonIds.length || a.name.localeCompare(b.name, "zh-Hant"));
};

/**
 * 還沒整理的課，課程頁用它決定要不要提示跑精靈：
 * - 掛在舊時段班底下的課；
 * - 沒歸類、但精靈會把它跟別門課歸在一起的課（只有一期、刻意不歸類的不算，免得一直提示）。
 */
export const unorganizedLessonCount = (lessons: LessonSummary[], groups: Named[]): number => {
  const counted = new Set<number>();
  for (const draft of draftSeries(lessons, groups)) {
    const groupId = draft.key.startsWith("g") ? Number(draft.key.slice(1)) : null;
    const members = draft.lessonIds.map((id) => lessons.find((l) => l.id === id)!);
    for (const lesson of members) {
      const stray =
        groupId !== null
          ? lesson.groupId !== groupId
          : lesson.groupId !== null || members.length > 1;
      if (stray) counted.add(lesson.id);
    }
  }
  return counted.size;
};
