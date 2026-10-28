import { apiRoute, parseBody, parseId } from "@/lib/apiRoute";
import { patchEntrySchema } from "@/domains/finance/schemas";
import { updateEntry } from "@/service/finance/entries";

type Params = { id: string };

/** 改一筆（要寫原因，留修改紀錄）。 */
export const PATCH = apiRoute<Params>(
  async ({ request, classroomId, userId, params }) => {
    const { entry, reason } = await parseBody(request, patchEntrySchema);
    return updateEntry(classroomId, userId, parseId(params.id, "entry id"), entry, reason);
  },
  { permission: "finance.view" }
);
