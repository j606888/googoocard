import { apiRoute } from "@/lib/apiRoute";
import { getMonthStatement, lockMonth, parseMonthParam } from "@/service/finance/settlement";
import { listBranchReviews } from "@/service/finance/branchReview";

// GET：結算單＋各分部核對狀態（任何成員可讀）。POST：確認結算、鎖住這個月（可以結算的人）。
export const GET = apiRoute<{ month: string }>(async ({ params, classroomId }) => {
  const month = parseMonthParam(params.month);
  const statement = await getMonthStatement(classroomId, month);
  return { ...statement, reviews: await listBranchReviews(classroomId, month, statement) };
});

export const POST = apiRoute<{ month: string }>(async ({ params, userId, classroomId }) =>
  lockMonth({ classroomId, userId, month: parseMonthParam(params.month) }),
);
