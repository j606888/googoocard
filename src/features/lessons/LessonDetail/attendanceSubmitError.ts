/**
 * Turns a failed 點名／修改點名 request (an RTK Query `unwrap()` rejection) into
 * a message the teacher can act on, instead of a bare「失敗，請再試一次」.
 */
export type AttendanceSubmitError = {
  /** The period was already finalized by someone else. */
  alreadyTaken: boolean;
  message: string;
};

export function describeAttendanceSubmitError(error: unknown): AttendanceSubmitError {
  const err = error as { status?: number | string; data?: { error?: string } } | undefined;
  const code = err?.data?.error;

  if (code === "attendance_already_taken") {
    return { alreadyTaken: true, message: "這個時段已經有人點過名了，帶你去看點名結果" };
  }
  if (code === "card_exhausted") {
    return { alreadyTaken: false, message: "有學生的課卡剛好被用完了，請重新整理後再送一次" };
  }
  if (err?.status === 404) {
    return { alreadyTaken: false, message: "找不到這堂課或時段，可能已被刪除" };
  }
  if (err?.status === 401 || err?.status === 403) {
    return { alreadyTaken: false, message: "登入已失效或沒有權限，請重新登入" };
  }
  if (err?.status === "FETCH_ERROR" || err?.status === "TIMEOUT_ERROR") {
    return { alreadyTaken: false, message: "網路連線不穩，沒有送出，請再試一次" };
  }
  return { alreadyTaken: false, message: "伺服器出錯了，沒有送出，請再試一次" };
}
