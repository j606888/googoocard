import prisma from "@/lib/prisma";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { badRequest } from "@/lib/apiError";
import { reorderDanceStylesSchema } from "@/lib/schemas";
import { danceStylePayloadSelect } from "@/lib/danceStyles";

// Rewrites every style's sortOrder to its index in `ids`. Moving one style
// with per-style PATCHes would take two writes and can't untangle ties (the
// backfill and old data may share a sortOrder), so the page sends the whole list.
export const PUT = apiRoute(async ({ request, classroomId }) => {
  const { ids } = await parseBody(request, reorderDanceStylesSchema);

  const existing = await prisma.danceStyle.findMany({
    where: { classroomId },
    select: { id: true },
  });
  // Exactly this classroom's styles, each once — a foreign id or a stale list
  // (a style added in another tab) is refused rather than half-applied.
  const own = new Set(existing.map((style) => style.id));
  if (ids.length !== own.size || new Set(ids).size !== ids.length || !ids.every((id) => own.has(id))) {
    throw badRequest("DANCE_STYLE_ORDER_MISMATCH");
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.danceStyle.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return prisma.danceStyle.findMany({
    where: { classroomId },
    select: danceStylePayloadSelect,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
});
