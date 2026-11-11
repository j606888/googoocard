import { Link2, Plus, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import MemberRow, { type MemberActions } from "./MemberRow";
import InvitationCard from "./InvitationCard";
import DangerZone from "./DangerZone";
import {
  Membership,
  useDeleteInviteTokenMutation,
  useGetInviteTokensQuery,
  useGetMembershipsQuery,
  useRemoveMembershipMutation,
  useTransferOwnershipMutation,
} from "@/store/slices/memberships";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import TeacherForm from "@/features/teachers/TeacherForm";
import { isAdminRole } from "@/lib/roles";
import InviteDrawer from "./InviteDrawer";
import EditMemberDrawer from "./EditMemberDrawer";
import LinkTeacherDrawer from "./LinkTeacherDrawer";
import { needsTeacherLink, suggestedTeacher } from "./teacherLink";

// Mirrors a MemberRow: avatar, name + email, role pill.
const MemberRowSkeleton = () => (
  <li className="flex items-center gap-3 px-4 py-3 lg:px-5">
    <Skeleton className="size-10 rounded-full" />
    <div className="flex flex-1 flex-col gap-1">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-4 w-40" />
    </div>
    <Skeleton className="h-5.5 w-14" />
  </li>
);

// Mirrors an InvitationCard row: link icon, URL, usage bar, copy button.
const InvitationCardSkeleton = () => (
  <li className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 lg:flex-row lg:items-center lg:gap-3.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-5 lg:py-3.5">
    <Skeleton className="hidden size-10 shrink-0 rounded-lg lg:block" />
    <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-2">
      <Skeleton className="h-3.5 w-56 max-w-full" />
      <Skeleton className="h-3 w-36" />
    </div>
    <Skeleton className="h-11 w-full rounded-xl lg:h-9 lg:w-20" />
  </li>
);

const HINT = "角色決定能管什麼；老師身分決定他在老師頁上是哪一位、哪些是他的課。";

const sectionCard = "rounded-2xl border border-neutral-200 bg-white";

const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, teacher: 2, assistant: 3 };

/**
 * 團隊：有帳號、能登入這間教室的人（2026-11 拆開：老師頁＝會教課的人，可以沒帳號）。
 *
 * 每個成員的帳號可以連到老師頁上的一位老師（`Teacher.userId`），連了他教的課就是「我的課」。
 * 純小幫手、不上課的管理員不用連——他們背後也有一筆人員資料（加入時 `ensurePerson()` 建的），
 * 課程的小幫手選單靠它，但不出現在老師頁。
 */
const TeamList = () => {
  const [inviting, setInviting] = useState(false);
  const [editingRole, setEditingRole] = useState<Membership | null>(null);
  const [linking, setLinking] = useState<Membership | null>(null);
  const [editingPerson, setEditingPerson] = useState<{ key: number; personId: number } | null>(null);

  const { data: memberships, isLoading: isMembershipsLoading } = useGetMembershipsQuery();
  const { data: teachers = [] } = useGetTeachersQuery();
  const { data: inviteTokens, isLoading: isInviteTokensLoading } = useGetInviteTokensQuery();
  const { data: me, isLoading: isMeLoading } = useGetMeQuery();
  const { data: classrooms } = useGetClassroomsQuery();
  const classroomName = classrooms?.classrooms.find(
    (c) => c.id === classrooms.currentClassroomId
  )?.name;
  const [deleteInviteToken] = useDeleteInviteTokenMutation();
  const [removeMembership] = useRemoveMembershipMutation();
  const [transferOwnership] = useTransferOwnershipMutation();

  const myRole = memberships?.find((membership) => membership.userId === me?.id)?.role;
  const isOwner = myRole === "owner";
  const isAdmin = isAdminRole(myRole);

  // 自己最上面，其餘照角色。
  const sorted = useMemo(() => {
    const rank = (m: Membership) => (m.userId === me?.id ? -1 : (ROLE_ORDER[m.role] ?? 5));
    return [...(memberships ?? [])].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  }, [memberships, me?.id]);

  // 老師頁上有同名、還沒帳號的老師——多半就是他，提醒管理員連起來。
  const suggestions = sorted
    .map((membership) => ({ membership, teacher: suggestedTeacher(membership, teachers) }))
    .filter((s): s is { membership: Membership; teacher: NonNullable<typeof s.teacher> } => Boolean(s.teacher));
  const suggestedIds = new Set(suggestions.map((s) => s.membership.id));

  const actions: MemberActions = {
    onEditPerson: (membership) =>
      membership.teacher && setEditingPerson({ key: Date.now(), personId: membership.teacher.id }),
    onLinkTeacher: isAdmin ? setLinking : undefined,
    onChangeRole: isAdmin ? setEditingRole : undefined,
    onRemove: isAdmin
      ? async (membership) => {
          if (!confirm(`確定要把 ${membership.user.name} 移出這間教室嗎？\n他教過的課照常顯示。`)) return;
          await removeMembership({ id: membership.id });
        }
      : undefined,
    onTransfer: isOwner
      ? async (membership) => {
          if (
            !confirm(
              `確定要把教室交給 ${membership.user.name} 嗎？\n你會變成一般管理員，之後就不能再刪除教室。`
            )
          ) {
            return;
          }
          await transferOwnership({ id: membership.id });
        }
      : undefined,
  };

  const handleDeleteInviteToken = async (id: number) => {
    if (!confirm("確定要刪除這個邀請連結嗎？")) return;
    await deleteInviteToken({ id });
  };

  const isLoading = isMembershipsLoading || isMeLoading;
  const editingPersonRow = editingPerson && teachers.find((t) => t.id === editingPerson.personId);

  return (
    <>
      <div className="flex w-full max-w-[880px] flex-col gap-5 px-4 py-4 lg:gap-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-2xl font-bold">團隊</h2>
            <p className="truncate text-[13px] text-neutral-500 lg:text-sm">
              {classroomName}
              {memberships && `・${memberships.length} 人`}
            </p>
          </div>
          {isAdmin && (
            <Button type="button" className="shrink-0" onClick={() => setInviting(true)}>
              <UserPlus />
              <span>
                邀請<span className="hidden lg:inline">成員</span>
              </span>
            </Button>
          )}
        </header>

        {isAdmin &&
          suggestions.map(({ membership, teacher }) => (
            <div
              key={membership.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning-300 bg-warning-50 px-4 py-3"
            >
              <div className="flex min-w-[14rem] flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-warning-950">{membership.user.name} 還沒連到老師</span>
                <span className="text-[13px] text-warning-900">
                  老師頁上有一位「{teacher.name}」，連起來之後他教的課就是 {membership.user.name} 的「我的課」。
                </span>
              </div>
              <Button type="button" size="sm" onClick={() => setLinking(membership)}>
                連到老師 {teacher.name}
              </Button>
            </div>
          ))}

        <section className="flex flex-col gap-2 lg:gap-0">
          <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_96px_180px_40px] lg:gap-4 lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-neutral-200 lg:bg-neutral-50 lg:px-5 lg:py-3 text-xs text-neutral-500">
            <span>成員</span>
            <span>角色</span>
            <span>老師身分</span>
            <span />
          </div>
          <ul className={`${sectionCard} divide-y divide-neutral-100 lg:rounded-t-none`}>
            {isLoading && Array.from({ length: 4 }, (_, i) => <MemberRowSkeleton key={i} />)}
            {!isLoading &&
              sorted.map((membership) => (
                <MemberRow
                  key={membership.id}
                  membership={membership}
                  isMe={membership.userId === me?.id}
                  needsLink={needsTeacherLink(membership) || suggestedIds.has(membership.id)}
                  actions={actions}
                />
              ))}
          </ul>
          <p className="mx-1 text-xs leading-relaxed text-neutral-500 lg:mx-0 lg:mt-2">
            {HINT}
            {!isAdmin && myRole && "要邀請、改角色或移除成員，請找管理員。"}
          </p>
        </section>

        {isAdmin && (
          <section className="flex flex-col gap-2 lg:gap-0">
            <div className="mx-1 flex items-center justify-between gap-3 lg:mx-0 lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-neutral-200 lg:bg-white lg:px-5 lg:pt-4 lg:pb-3.5">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold text-neutral-700 lg:text-base lg:text-neutral-900">邀請連結</h3>
                <p className="hidden text-[13px] text-neutral-500 lg:block">
                  還沒被接受的邀請。要邀請老師頁上的老師，從他的卡片按「邀請」。
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setInviting(true)}
                className="shrink-0 gap-1"
              >
                <Plus className="size-4" />
                建立連結
              </Button>
            </div>
            {isInviteTokensLoading ? (
              <ul className="flex flex-col gap-2 lg:gap-0 lg:rounded-b-2xl lg:border lg:border-neutral-200 lg:bg-white">
                <InvitationCardSkeleton />
              </ul>
            ) : inviteTokens && inviteTokens.length > 0 ? (
              <ul className="flex flex-col gap-2 lg:gap-0 lg:divide-y lg:divide-neutral-100 lg:rounded-b-2xl lg:border lg:border-neutral-200 lg:bg-white">
                {inviteTokens.map((inviteToken) => (
                  <InvitationCard
                    key={inviteToken.id}
                    inviteToken={inviteToken}
                    onDelete={handleDeleteInviteToken}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                kind="inline"
                icon={<Link2 />}
                title="目前沒有可用的邀請連結"
                description="老師頁上沒帳號的老師，從他的卡片按「邀請」；其他人用一般連結"
                className="bg-white lg:rounded-t-none lg:rounded-b-2xl lg:border lg:border-solid lg:px-5"
              />
            )}
          </section>
        )}

        {!isLoading && myRole && <DangerZone role={myRole} />}
      </div>

      {inviting && <InviteDrawer open onClose={() => setInviting(false)} />}
      {editingRole && (
        <EditMemberDrawer key={editingRole.id} membership={editingRole} onClose={() => setEditingRole(null)} />
      )}
      {linking && <LinkTeacherDrawer key={linking.id} membership={linking} onClose={() => setLinking(null)} />}
      {editingPerson && editingPersonRow && (
        <TeacherForm
          key={editingPerson.key}
          open
          teacher={editingPersonRow}
          onClose={() => setEditingPerson(null)}
        />
      )}
    </>
  );
};

export default TeamList;
