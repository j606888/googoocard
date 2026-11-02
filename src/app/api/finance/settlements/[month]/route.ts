import { ApiError } from "@/lib/apiError";
import { apiRoute } from "@/lib/apiRoute";
import { getMonthStatement, lockMonth } from "@/service/finance/settlement";

function parseMonth(raw: string | undefined): string {
  if (!raw || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw new ApiError(400, "INVALID_MONTH", "month must be YYYY-MM");
  }
  return raw;
}

// GET：結算單（任何成員可讀）。POST：確認結算、鎖住這個月（財務）。
export const GET = apiRoute<{ month: string }>(async ({ params, classroomId }) =>
  getMonthStatement(classroomId, parseMonth(params.month)),
);

export const POST = apiRoute<{ month: string }>(async ({ params, userId, classroomId }) =>
  lockMonth({ classroomId, userId, month: parseMonth(params.month) }),
);
