import { allTeachersInClassroom } from "@/lib/authz";

/**
 * 開課／改課送來的 `assistantIds`（課程小幫手，選填）。
 * - 沒送 → `{ ids: undefined }`（建立 = 沒有小幫手；修改 = 不動）。
 * - 每個 id 都要是本教室的 `Teacher`（封存的也算，跟 `teacherIds` 同一條規則）。
 * - 同一個人不能同時是這門課的老師和小幫手。
 */
export async function resolveAssistantIds(
  draft: { teacherIds: number[]; assistantIds?: unknown },
  classroomId: number
): Promise<{ ids: number[] | undefined } | { error: "ASSISTANT_NOT_FOUND" | "ASSISTANT_IS_TEACHER" }> {
  if (draft.assistantIds === undefined) return { ids: undefined };
  const raw = draft.assistantIds;
  if (!Array.isArray(raw) || !raw.every((id): id is number => Number.isInteger(id))) {
    return { error: "ASSISTANT_NOT_FOUND" };
  }
  const ids = [...new Set(raw)];
  if (!(await allTeachersInClassroom(ids, classroomId))) return { error: "ASSISTANT_NOT_FOUND" };
  if (ids.some((id) => draft.teacherIds.includes(id))) return { error: "ASSISTANT_IS_TEACHER" };
  return { ids };
}
