/** 這一期屬於哪個課種：現有的、或當場取名的新課種（新增課程的 `SeriesGroup`）。 */
export type SeriesChoice = { type: "existing"; id: number } | { type: "new"; name: string } | null;

/** The series' own name for a choice (what the lesson is called unless renamed). */
export function seriesName(choice: SeriesChoice, groups: { id: number; name: string }[]): string {
  if (!choice) return "";
  if (choice.type === "new") return choice.name.trim();
  return groups.find((g) => g.id === choice.id)?.name ?? "";
}
