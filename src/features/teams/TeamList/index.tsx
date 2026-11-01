import { Link2, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import MemberCard from "./MemberCard";
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
import { useGetMeQuery } from "@/store/slices/me";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { isAdminRole } from "@/lib/roles";
import InviteDrawer from "./InviteDrawer";
import EditMemberDrawer from "./EditMemberDrawer";

// Mirrors a MemberCard row: avatar, name + email, role pill.
const MemberCardSkeleton = () => (
  <li className="flex items-center gap-3 px-4 py-3 lg:px-5">
    <Skeleton className="size-10" />
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

const ROLE_HINT = "管理員能邀請和管理成員；老師和小幫手能使用所有日常功能";

const sectionCard = "rounded-2xl border border-neutral-200 bg-white";

const TeamList = () => {
  const [newMemberModalOpen, setNewMemberModalOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const { data: memberships, isLoading: isMembershipsLoading } = useGetMembershipsQuery();
  const [deleteInviteToken] = useDeleteInviteTokenMutation();
  const { data: inviteTokens, isLoading: isInviteTokensLoading } = useGetInviteTokensQuery();
  const { data: me, isLoading: isMeLoading } = useGetMeQuery();
  const { data: classrooms } = useGetClassroomsQuery();
  const classroomName = classrooms?.classrooms.find(
    (c) => c.id === classrooms.currentClassroomId
  )?.name;
  const [removeMembership] = useRemoveMembershipMutation();
  const [transferOwnership] = useTransferOwnershipMutation();

  // The viewer's own role in the current classroom — the same list already
  // powers the "You" pill, so no extra request is needed for it.
  const myRole = memberships?.find((membership) => membership.userId === me?.id)?.role;
  const isOwner = myRole === "owner";
  const isAdmin = isAdminRole(myRole);

  const handleRemoveMember = async (membership: Membership) => {
    if (!confirm(`確定要把 ${membership.user.name} 移出這間教室嗎？`)) {
      return;
    }
    await removeMembership({ id: membership.id });
  };

  const handleTransferOwnership = async (membership: Membership) => {
    if (
      !confirm(
        `確定要把教室交給 ${membership.user.name} 嗎？\n你會變成一般管理員，之後就不能再刪除教室。`
      )
    ) {
      return;
    }
    await transferOwnership({ id: membership.id });
  };

  const handleDeleteInviteToken = async (id: number) => {
    if (!confirm("確定要刪除這個邀請連結嗎？")) {
      return;
    }
    await deleteInviteToken({ id });
  };

  // The owner actions, the "You" pill and the danger zone all depend on `me`,
  // so the member list waits for it too rather than popping those in late.
  const isMembersLoading = isMembershipsLoading || isMeLoading;

  const openCreateInvite = () => setNewMemberModalOpen(true);

  return (
    <>
      <div className="flex w-full max-w-[760px] flex-col gap-5 px-4 py-4 lg:gap-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-2xl font-bold lg:text-[28px]">團隊</h2>
            <p className="truncate text-[13px] text-neutral-500 lg:text-sm">
              {classroomName}
              {memberships && `・${memberships.length} 位成員`}
            </p>
          </div>
          {isAdmin && (
            <Button type="button" onClick={openCreateInvite} className="shrink-0">
              <UserPlus />
              <span>
                邀請<span className="hidden lg:inline">成員</span>
              </span>
            </Button>
          )}
        </header>

        <section className="flex flex-col gap-2 lg:gap-0">
          <div className="mx-1 flex flex-wrap items-baseline justify-between gap-x-3 lg:mx-0 lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-neutral-200 lg:bg-white lg:px-5 lg:pt-4 lg:pb-3.5">
            <h3 className="text-sm font-bold text-neutral-700 lg:text-base lg:text-neutral-900">成員</h3>
            <p className="hidden text-[13px] text-neutral-500 lg:block">{ROLE_HINT}</p>
          </div>
          <ul className={`${sectionCard} divide-y divide-neutral-100 lg:rounded-t-none`}>
            {isMembersLoading &&
              Array.from({ length: 3 }, (_, i) => <MemberCardSkeleton key={i} />)}
            {!isMembersLoading &&
              memberships?.map((membership) => (
                <MemberCard
                  key={membership.id}
                  membership={membership}
                  isMe={membership.userId === me?.id}
                  onEdit={isAdmin ? setEditing : undefined}
                  onRemove={isAdmin ? handleRemoveMember : undefined}
                  onTransfer={isOwner ? handleTransferOwnership : undefined}
                />
              ))}
          </ul>
          <p className="mx-1 text-xs leading-relaxed text-neutral-500 lg:hidden">
            {isAdmin || !myRole ? `${ROLE_HINT}。` : "要邀請、改角色或移除成員，請找管理員。"}
          </p>
        </section>

        {isAdmin && (
          <section className="flex flex-col gap-2 lg:gap-0">
            <div className="mx-1 flex items-center justify-between gap-3 lg:mx-0 lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-neutral-200 lg:bg-white lg:px-5 lg:pt-4 lg:pb-3.5">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold text-neutral-700 lg:text-base lg:text-neutral-900">邀請連結</h3>
                <p className="hidden text-[13px] text-neutral-500 lg:block">
                  傳給要加入的人，對方登入後就會以連結上的角色加入
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openCreateInvite}
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
                description="建立一個，傳給要加入的老師或小幫手"
                className="bg-white lg:rounded-t-none lg:rounded-b-2xl lg:border lg:border-solid lg:px-5"
              />
            )}
          </section>
        )}

        {!isMembersLoading && myRole && <DangerZone role={myRole} />}
      </div>
      <InviteDrawer open={newMemberModalOpen} onClose={() => setNewMemberModalOpen(false)} />
      {editing && (
        <EditMemberDrawer
          key={editing.id}
          membership={editing}
          isMe={editing.userId === me?.id}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
};

export default TeamList;
