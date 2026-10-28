import type { EntryEvent, EntryField, EntryValues, FieldChange, Stamp, Transaction } from "../types";

/**
 * 流水帳一筆的歷程：編輯、封存、還原都只是在 `history` 後面加一筆，
 * 原本的內容永遠倒推得回來（`originalValues`），所以沒有人能悄悄改帳。
 */

export const ENTRY_FIELDS: EntryField[] = ["amount", "description", "category", "date", "branch", "holder"];

export const FIELD_LABELS: Record<EntryField, string> = {
  amount: "金額",
  description: "說明",
  category: "類別",
  date: "日期",
  branch: "據點",
  holder: "錢在誰手上",
};

type ArchivedEvent = Extract<EntryEvent, { type: "archived" }>;

export function entryValues(tx: Transaction): EntryValues {
  const { date, category, description, branch, holder, amount } = tx;
  return { date, category, description, branch, holder, amount };
}

export function diffEntry(before: EntryValues, after: EntryValues): FieldChange[] {
  return ENTRY_FIELDS.filter((field) => before[field] !== after[field]).map((field) => ({
    field,
    from: before[field],
    to: after[field],
  }));
}

export function editEntry(tx: Transaction, after: EntryValues, stamp: Stamp, reason: string): Transaction {
  const changes = diffEntry(entryValues(tx), after);
  return { ...tx, ...after, history: [...tx.history, { type: "edited", ...stamp, reason, changes }] };
}

export function archiveEntry(tx: Transaction, stamp: Stamp, reason: string): Transaction {
  return { ...tx, history: [...tx.history, { type: "archived", ...stamp, reason }] };
}

export function restoreEntry(tx: Transaction, stamp: Stamp): Transaction {
  return { ...tx, history: [...tx.history, { type: "restored", ...stamp }] };
}

/** 目前的封存（後來被還原了就是 undefined）。 */
export function archivedEvent(tx: Transaction): ArchivedEvent | undefined {
  for (let i = tx.history.length - 1; i >= 0; i--) {
    const event = tx.history[i];
    if (event.type === "archived") return event;
    if (event.type === "restored") return undefined;
  }
  return undefined;
}

export const isArchived = (tx: Transaction) => archivedEvent(tx) !== undefined;

/** 誰、什麼時候記的。 */
export const recordedOf = (tx: Transaction): Stamp => tx.history[0];

export const editCount = (tx: Transaction) => tx.history.filter((event) => event.type === "edited").length;

/** 記錄之後最後一次有人動它；沒動過是 undefined。 */
export const lastTouched = (tx: Transaction): EntryEvent | undefined =>
  tx.history.length > 1 ? tx.history[tx.history.length - 1] : undefined;

/** 剛記下來時的內容：把每次修改倒回去。 */
export function originalValues(tx: Transaction): EntryValues {
  const values: Record<EntryField, string | number> = entryValues(tx);
  for (const event of [...tx.history].reverse()) {
    if (event.type !== "edited") continue;
    for (const change of event.changes) values[change.field] = change.from;
  }
  return values as EntryValues;
}

/** 「21:15」；不是在 `date` 那天記的就連日期「10/18 10:16」。 */
export function stampTime(stamp: Stamp, date: string): string {
  const [day, time] = stamp.at.split(" ");
  return day === date ? time : stamp.at;
}
