import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { MODULES, isModuleLocked } from "@/lib/permissions";

/** Every module, on or off, for the 功能模組 page. `locked` = 準備中, can't be switched on. */
export const GET = apiRoute(async ({ classroomId }) => {
  const rows = await prisma.classroomModule.findMany({
    where: { classroomId },
    select: { module: true, enabledAt: true, enabledBy: { select: { id: true, name: true } } },
  });
  const byModule = new Map(rows.map((row) => [row.module, row]));
  return MODULES.map((module) => {
    const row = byModule.get(module);
    return {
      module,
      enabled: Boolean(row),
      locked: isModuleLocked(module),
      enabledAt: row?.enabledAt ?? null,
      enabledBy: row?.enabledBy ?? null,
    };
  });
});
