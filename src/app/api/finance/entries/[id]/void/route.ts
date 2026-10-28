import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { voidEntrySchema } from "@/domains/finance/schemas";
import { voidEntry } from "@/service/finance/entries";

type Params = { id: string };

/** 作廢（不真的刪除，要寫原因）。 */
export const POST = apiRoute<Params>(
  async ({ request, classroomId, userId, params }) =>
    voidEntry(classroomId, userId, parseId(params.id, "entry id"), (await parseBody(request, voidEntrySchema)).reason),
  { permission: "finance.view" }
);
