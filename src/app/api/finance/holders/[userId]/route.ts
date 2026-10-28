import { apiRoute, parseId } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { getHolderPassbook } from "@/service/finance/money";

type Params = { userId: string };

/** 一位代收人的存摺。全公開：任何人都看得到任何人的。 */
export const GET = apiRoute<Params>(
  async ({ classroomId, params }) => {
    const passbook = await getHolderPassbook(classroomId, parseId(params.userId, "user id"));
    if (!passbook) throw notFound("User");
    return passbook;
  },
  { permission: "finance.view" }
);
