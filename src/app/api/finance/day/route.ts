import { apiRoute, parseQuery } from "@/lib/apiRoute";
import { dayBookQuerySchema } from "@/domains/finance/schemas";
import { getDayBook } from "@/service/finance/split";

// 當天的帳：每堂分帳＋分給誰多少＋這天真的收付的錢。
export const GET = apiRoute(
  async ({ request, classroomId }) => getDayBook(classroomId, parseQuery(request, dayBookQuerySchema).date),
  { permission: "finance.view" }
);
