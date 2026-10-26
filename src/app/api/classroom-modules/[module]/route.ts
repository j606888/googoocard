import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { ApiError } from "@/lib/apiError";
import { isModule, type Module } from "@/lib/permissions";

type Params = { module: string };

function parseModule(raw: string): Module {
  if (!isModule(raw)) throw new ApiError(404, "MODULE_NOT_FOUND", "Unknown module");
  return raw;
}

/** Switch a module on. Already on → 200 all the same. */
export const PUT = apiRoute<Params>(async ({ params, userId, classroomId }) => {
  const module_ = parseModule(params.module);
  await prisma.classroomModule.upsert({
    where: { classroomId_module: { classroomId, module: module_ } },
    create: { classroomId, module: module_, enabledById: userId },
    update: {},
  });
  return { module: module_, enabled: true };
}, { permission: "modules.manage" });

/**
 * Switch a module off. Only the switch goes: the module's own tables keep
 * their rows, so switching it back on brings everything back.
 */
export const DELETE = apiRoute<Params>(async ({ params, classroomId }) => {
  const module_ = parseModule(params.module);
  await prisma.classroomModule.deleteMany({ where: { classroomId, module: module_ } });
  return { module: module_, enabled: false };
}, { permission: "modules.manage" });
