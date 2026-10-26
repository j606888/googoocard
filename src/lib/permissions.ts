/**
 * 權限與功能模組（docs/modules-plan.md 第 1 階段）。
 *
 * A role is only a **default bundle** of permissions. Each member can have
 * extra ones added (`Membership.grants`) or bundled ones taken away
 * (`Membership.revokes`), so only the difference from the bundle is stored —
 * adding a permission to a bundle here reaches everyone in that role without a
 * data migration.
 *
 * Modules (技能樹、水庫) are switched on per classroom (`ClassroomModule`). A
 * module's permissions only exist while it's on: `effectivePermissions` drops
 * them otherwise, and `apiRoute`'s `permission` option answers 404 for them.
 *
 * Pure — shared by the server (`apiRoute`) and the client (`useCan`).
 */
import type { MemberRole } from "@/lib/roles";

export const MODULES = ["curriculum", "finance"] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABELS: Record<Module, string> = {
  curriculum: "技能樹",
  finance: "水庫",
};

type PermissionGroup = "core" | Module;

export const PERMISSIONS = {
  "members.manage": { label: "管理成員", hint: "邀請、改角色與權限、移除成員", group: "core" },
  "modules.manage": { label: "開關功能模組", hint: "決定這間教室要用哪些模組", group: "core" },
  "curriculum.view": { label: "看技能樹、留言", hint: "看技能樹、參與討論", group: "curriculum" },
  "curriculum.edit": { label: "編輯技能樹", hint: "新增、搬動、封存技能，改分類與等級", group: "curriculum" },
  "finance.view": { label: "看水庫", hint: "看收支、資金與月結", group: "finance" },
  "finance.edit": { label: "記帳、改水庫設定", hint: "記帳、改分帳規則、核准發薪", group: "finance" },
} as const satisfies Record<string, { label: string; hint: string; group: PermissionGroup }>;

export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

export const PERMISSION_GROUPS: { group: PermissionGroup; label: string }[] = [
  { group: "core", label: "核心" },
  { group: "curriculum", label: MODULE_LABELS.curriculum },
  { group: "finance", label: MODULE_LABELS.finance },
];

/**
 * 角色預設組合. Day-to-day work (點名、課卡、收入) isn't split into permissions
 * at all — every role does it, a deliberate choice (docs/architecture.md「教室生命週期與角色」).
 * The owner isn't listed: an owner always has everything.
 */
export const ROLE_BUNDLES: Record<Exclude<MemberRole, "owner">, readonly Permission[]> = {
  admin: PERMISSION_KEYS,
  teacher: ["curriculum.view", "curriculum.edit"],
  assistant: ["curriculum.view"],
};

export function isPermission(value: string): value is Permission {
  return value in PERMISSIONS;
}

export function isModule(value: string): value is Module {
  return (MODULES as readonly string[]).includes(value);
}

export function moduleOf(permission: Permission): Module | null {
  const { group } = PERMISSIONS[permission];
  return group === "core" ? null : group;
}

export function roleBundle(role: string): Set<Permission> {
  if (role === "owner") return new Set(PERMISSION_KEYS);
  return new Set(ROLE_BUNDLES[role as keyof typeof ROLE_BUNDLES] ?? ROLE_BUNDLES.assistant);
}

/**
 * What a member can actually do: owner → everything; otherwise
 * (bundle ∪ grants) − revokes. Then anything belonging to a module that's off
 * is dropped. Unknown strings in grants/revokes are ignored.
 */
export function effectivePermissions(input: {
  role: string;
  grants?: readonly string[];
  revokes?: readonly string[];
  modules?: readonly string[];
}): Set<Permission> {
  const result = roleBundle(input.role);
  if (input.role !== "owner") {
    for (const p of input.grants ?? []) if (isPermission(p)) result.add(p);
    for (const p of input.revokes ?? []) if (isPermission(p)) result.delete(p);
  }
  const enabled = new Set(input.modules ?? []);
  for (const p of result) {
    const mod = moduleOf(p);
    if (mod && !enabled.has(mod)) result.delete(p);
  }
  return result;
}

/**
 * The inverse, for saving an edited checkbox list: what to store so that
 * `role`'s bundle plus these overrides comes out as `wanted`.
 *
 * Permissions of modules that are off aren't on the screen, so the caller passes
 * `keep` — the member's current grants/revokes — and overrides for hidden
 * permissions survive untouched.
 */
export function overridesFor(
  role: string,
  wanted: readonly Permission[],
  visible: readonly Permission[],
  keep: { grants: readonly string[]; revokes: readonly string[] } = { grants: [], revokes: [] }
): { grants: Permission[]; revokes: Permission[] } {
  const bundle = roleBundle(role);
  const want = new Set(wanted);
  const shown = new Set(visible);
  const grants = keep.grants.filter((p): p is Permission => isPermission(p) && !shown.has(p) && !bundle.has(p));
  const revokes = keep.revokes.filter((p): p is Permission => isPermission(p) && !shown.has(p) && bundle.has(p));
  for (const p of shown) {
    if (want.has(p) && !bundle.has(p)) grants.push(p);
    if (!want.has(p) && bundle.has(p)) revokes.push(p);
  }
  return { grants, revokes };
}

/** The permissions a member could hold given which modules are on — the checkboxes to show. */
export function visiblePermissions(modules: readonly string[]): Permission[] {
  const enabled = new Set(modules);
  return PERMISSION_KEYS.filter((p) => {
    const mod = moduleOf(p);
    return !mod || enabled.has(mod);
  });
}
