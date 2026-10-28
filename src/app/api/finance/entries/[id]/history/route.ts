import { apiRoute, parseId } from "@/lib/apiRoute";
import { entryHistory } from "@/service/finance/entries";

type Params = { id: string };

export const GET = apiRoute<Params>(
  async ({ classroomId, params }) => entryHistory(classroomId, parseId(params.id, "entry id")),
  { permission: "finance.view" }
);
