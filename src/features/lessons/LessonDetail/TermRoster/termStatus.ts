import type { TermAttendanceStatus } from "@/store/slices/lessons";

/** 整期出缺勤一格的顏色與文字。整期名單、學生 LINE 簽到都用這一份。 */
export const TERM_STATUS_META: Record<TermAttendanceStatus, { label: string; className: string }> = {
  present: { label: "有來", className: "bg-primary-600" },
  leave: { label: "請假", className: "bg-warning-400" },
  absent: { label: "曠課", className: "bg-danger-500" },
  upcoming: { label: "還沒上", className: "bg-neutral-200" },
  outside: { label: "不在報名堂數內", className: "bg-neutral-100" },
};

/** 一排小格子：每堂一格。`total` 用來補上還沒排出來的堂（整期 5 堂、只排了 3 堂）。 */
export const termSegments = (statuses: TermAttendanceStatus[], total: number): TermAttendanceStatus[] => {
  const covered = statuses.filter((s) => s !== "outside").slice(0, total);
  return [...covered, ...Array<TermAttendanceStatus>(Math.max(0, total - covered.length)).fill("upcoming")];
};
