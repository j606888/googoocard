import { isValidDropInPrice } from "@/lib/lessonKind";

/**
 * 單堂方案：一堂課可以有幾個有名字的單堂價（「原價 $500」「複習價 $250」、
 * 「單人 $200」「雙人合報 $150」）。存在 `Lesson.dropInOptions`（JSON），
 * `Lesson.dropInPrice` 永遠等於第一個方案的價錢，所以只認 dropInPrice 的舊程式照樣能跑。
 * 學生自己選、不做資格鎖——每一筆都要老師確認收款，那一步就是把關。
 * `DropInCharge.optionName` 記的是當下的名稱快照，之後改方案不動舊帳。
 */
export type DropInOption = {
  /** "" = 課程只有一個沒名字的單堂價（舊資料、只設一個價錢）。 */
  name: string;
  price: number;
  /** 給學生看的一行說明，例如「限上過 1-3 期的同學」。 */
  note?: string;
};

export const MAX_DROP_IN_OPTIONS = 4;
export const DROP_IN_NAME_MAX = 12;
export const DROP_IN_NOTE_MAX = 30;

/** 驗證＋正規化一份方案清單（API 輸入、DB 讀出來都走這裡）。不合法回 null。 */
export function parseDropInOptions(value: unknown): DropInOption[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_DROP_IN_OPTIONS) return null;
  const options: DropInOption[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const { name, price, note } = raw as Record<string, unknown>;
    if (typeof name !== "string" || typeof price !== "number" || !isValidDropInPrice(price)) return null;
    const trimmed = name.trim();
    if (trimmed === "" || trimmed.length > DROP_IN_NAME_MAX) return null;
    if (options.some((o) => o.name === trimmed)) return null;
    if (note !== undefined && note !== null && typeof note !== "string") return null;
    const trimmedNote = typeof note === "string" ? note.trim() : "";
    if (trimmedNote.length > DROP_IN_NOTE_MAX) return null;
    options.push({ name: trimmed, price, ...(trimmedNote ? { note: trimmedNote } : {}) });
  }
  return options;
}

/** 這堂課的單堂方案。沒開放單堂 = []；只有一個沒名字的價錢 = [{ name: "", price }]。 */
export function lessonDropInOptions(lesson: {
  dropInPrice: number | null;
  dropInOptions?: unknown;
}): DropInOption[] {
  if (lesson.dropInPrice === null) return [];
  return parseDropInOptions(lesson.dropInOptions) ?? [{ name: "", price: lesson.dropInPrice }];
}

/** 依名稱找方案；沒給名稱 = 第一個（預設）。找不到回 null。 */
export function findDropInOption(
  options: DropInOption[],
  name: string | null | undefined
): DropInOption | null {
  if (name === undefined || name === null || name === "") return options[0] ?? null;
  return options.find((o) => o.name === name) ?? null;
}

/** 「單堂」或「單堂・複習價」——標籤、動態、推播共用。 */
export function dropInLabel(optionName: string | null | undefined) {
  return optionName ? `單堂・${optionName}` : "單堂";
}

/**
 * 課程新增／修改的輸入 → 要寫進 DB 的兩個欄位。
 * - 給了合法的 `dropInOptions`：照存，dropInPrice = 第一個方案的價錢。
 * - 只給 `dropInPrice`（或 options 是 null）：清掉方案，回到單一價。
 * - 兩個都沒給：不動（回 {}）。
 * 不合法回 "invalid"。
 */
export function resolveDropInInput(draft: {
  dropInPrice?: unknown;
  dropInOptions?: unknown;
}): { dropInPrice?: number | null; dropInOptions?: DropInOption[] | null } | "invalid" {
  if (draft.dropInPrice === undefined && draft.dropInOptions === undefined) return {};
  if (draft.dropInPrice !== undefined && !isValidDropInPrice(draft.dropInPrice)) return "invalid";
  if (draft.dropInPrice === null) return { dropInPrice: null, dropInOptions: null };
  if (draft.dropInOptions === undefined || draft.dropInOptions === null) {
    if (draft.dropInPrice === undefined) return "invalid";
    return { dropInPrice: draft.dropInPrice as number, dropInOptions: null };
  }
  const options = parseDropInOptions(draft.dropInOptions);
  if (!options) return "invalid";
  return { dropInPrice: options[0].price, dropInOptions: options };
}
