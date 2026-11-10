/**
 * `Membership.role` values. "owner" is the classroom's creator (exactly one,
 * `Classroom.ownerId`); "admin" is any other 管理員. Both manage the team; only
 * the owner archives or hands over the classroom. "teacher" and "assistant"
 * (小幫手) can do the same day-to-day work. A teacher is always linked to a
 * `Teacher` row (`Teacher.userId`); anyone else may be (a 小幫手 too), so the
 * lessons they teach or assist show as theirs on the lessons page.
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
 * Whether an **invite link** for this role carries a `Teacher` row. A 小幫手
 * invite is multi-use, so it never does — an admin links them afterwards in
 * 成員設定 (`PATCH /api/memberships/[id]` accepts a teacher for every role).
 */
export function inviteCanLinkTeacher(role: string): boolean {
  return role !== "assistant";
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as MemberRole] ?? ROLE_LABELS.assistant;
}
