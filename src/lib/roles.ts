/**
 * `Membership.role` values. "owner" is the classroom's creator (exactly one,
 * `Classroom.ownerId`); "admin" is any other 管理員. Both manage the team; only
 * the owner archives or hands over the classroom. "teacher" and "assistant"
 * (小幫手) can do the same day-to-day work — a teacher is linked to a
 * `Teacher` row (`Teacher.userId`) so their own lessons show on the lessons page.
 */
export const MEMBER_ROLES = ["owner", "admin", "teacher", "assistant"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Roles an admin can hand out by invite or role change — never "owner" (that's a transfer). */
export const ASSIGNABLE_ROLES = ["admin", "teacher", "assistant"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "管理員",
  admin: "管理員",
  teacher: "老師",
  assistant: "小幫手",
};

/** Invite, change roles, remove members. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Whether the team page / invites may link a member in this role to a `Teacher` row (not a 小幫手).
 * Finance setup's 「是本人嗎」 link (`POST /api/finance/teachers/[id]/link`) may still link a 小幫手.
 */
export function canLinkTeacher(role: string): boolean {
  return role !== "assistant";
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as MemberRole] ?? ROLE_LABELS.assistant;
}
