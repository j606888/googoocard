import { apiRoute, parseBody } from "@/lib/apiRoute";
import { entrySchema } from "@/domains/finance/schemas";
import { createEntry } from "@/service/finance/entries";

/** 記一筆大水庫的帳（只有營收負責人，service 判斷）。 */
export const POST = apiRoute(
  async ({ request, classroomId, userId }) => createEntry(classroomId, userId, await parseBody(request, entrySchema)),
  { permission: "finance.view" }
);
