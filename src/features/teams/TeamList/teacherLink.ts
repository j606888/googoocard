import { canTeach } from "@/lib/teachers";
import type { Membership } from "@/store/slices/memberships";
import type { Teacher } from "@/store/slices/teachers";

/**
 * 團隊頁「老師身分」那一欄：成員的帳號連到哪位老師。
 * 老師＝會教課的人（老師頁上那些，`canTeach`）；純小幫手、不上課的管理員不用連。
 */

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** 這個成員可以連過去的老師：在職、會教課、還沒連給別人（已經連著他自己的也算）。 */
export function linkableTeachers(teachers: readonly Teacher[], forUserId: number): Teacher[] {
  return teachers.filter(
    (t) => !t.archivedAt && canTeach(t.kind) && (t.userId === null || t.userId === forUserId)
  );
}

/** 他的帳號已經連到一位老師（老師頁上看得到他）。 */
export const isLinkedTeacher = (member: Membership) =>
  member.teacher !== null && canTeach(member.teacher.kind);

/**
 * 老師頁上有一位跟他同名、還沒帳號的老師——多半就是他（先建好空殼、後來才用一般連結加入）。
 * 不自動連：名字可能撞，交給管理員按。
 */
export function suggestedTeacher(member: Membership, teachers: readonly Teacher[]): Teacher | undefined {
  if (isLinkedTeacher(member)) return undefined;
  const names = [member.user.name, member.teacher?.name].filter((n): n is string => Boolean(n?.trim()));
  return teachers.find(
    (t) =>
      !t.archivedAt &&
      canTeach(t.kind) &&
      t.userId === null &&
      names.some((name) => sameName(name, t.name))
  );
}

/** 角色是老師、卻還沒連到老師——提示管理員連一下（不擋任何事）。 */
export const needsTeacherLink = (member: Membership) =>
  member.role === "teacher" && !isLinkedTeacher(member);
