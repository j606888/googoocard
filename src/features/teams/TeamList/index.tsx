import { Link2, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import MemberCard from "./MemberCard";
import InvitationCard from "./InvitationCard";
import DangerZone from "./DangerZone";
import {
  Membership,
  useCreateInviteTokenMutation,
  useDeleteInviteTokenMutation,
  useGetInviteTokensQuery,
  useGetMembershipsQuery,
  useRemoveMembershipMutation,
  useTransferOwnershipMutation,
} from "@/store/slices/memberships";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors a MemberCard row: avatar, name + email, role pill.
const MemberCardSkeleton = () => (
  <li className="flex items-center gap-3 px-4 py-3 lg:px-5">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="flex flex-1 flex-col gap-1">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-4 w-40" />
    </div>
    <Skeleton className="h-6 w-14 rounded-full" />
  </li>
);

const ROLE_HINT = "擁有者能管理成員與教室，助教能使用所有日常功能";

const sectionCard = "rounded-2xl border border-neutral-200 bg-white";

const TeamList = () => {
  const [newMemberModalOpen, setNewMemberModalOpen] = useState(false);
  const { data: memberships, isLoading: isMembershipsLoading } = useGetMembershipsQuery();
  const [createInviteToken] = useCreateInviteTokenMutation();
  const [deleteInviteToken] = useDeleteInviteTokenMutation();
  const { data: inviteTokens, isLoading: isInviteTokensLoading } = useGetInviteTokensQuery();
  const { data: me, isLoading: isMeLoading } = useGetMeQuery();
  const { data: classrooms } = useGetClassroomsQuery();
  const classroomName = classrooms?.classrooms.find(
    (c) => c.id === classrooms.currentClassroomId
  )?.name;
  const [removeMembership] = useRemoveMembershipMutation();
  const [transferOwnership] = useTransferOwnershipMutation();
  const [maxUses, setMaxUses] = useState(1);

  // The viewer's own role in the current classroom — the same list already
  // powers the "You" pill, so no extra request is needed for it.
  const myRole = memberships?.find((membership) => membership.userId === me?.id)?.role;
  const isOwner = myRole === "owner";

  const handleRemoveMember = async (membership: Membership) => {
    if (!confirm(`確定要把 ${membership.user.name} 移出這間教室嗎？`)) {
      return;
    }
    await removeMembership({ id: membership.id });
  };

  const handleTransferOwnership = async (membership: Membership) => {
    if (
      !confirm(
        `確定要把教室交給 ${membership.user.name} 嗎？\n你會變成助教，之後就不能再刪除教室或移除成員。`
      )
    ) {
      return;
    }
    await transferOwnership({ id: membership.id });
  };

  const handleCreateInviteToken = async () => {
    await createInviteToken({ maxUses });
    setNewMemberModalOpen(false);
    setMaxUses(1);
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
          <button
            type="button"
            onClick={openCreateInvite}
            className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-primary-700 px-4 font-medium text-white hover:bg-primary-900 lg:px-5"
          >
            <UserPlus className="h-[18px] w-[18px]" />
            <span>
              邀請<span className="hidden lg:inline">助教</span>
            </span>
          </button>
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
                  onRemove={isOwner ? handleRemoveMember : undefined}
                  onTransfer={isOwner ? handleTransferOwnership : undefined}
                />
              ))}
          </ul>
          <p className="mx-1 text-xs leading-relaxed text-neutral-500 lg:hidden">
            {isOwner || !myRole ? `${ROLE_HINT}。` : "要移除成員或轉移教室，請找擁有者。"}
          </p>
        </section>

        <section className="flex flex-col gap-2 lg:gap-0">
          <div className="mx-1 flex items-center justify-between gap-3 lg:mx-0 lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-neutral-200 lg:bg-white lg:px-5 lg:pt-4 lg:pb-3.5">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-bold text-neutral-700 lg:text-base lg:text-neutral-900">邀請連結</h3>
              <p className="hidden text-[13px] text-neutral-500 lg:block">
                傳給要加入的助教，對方登入後就會加入這間教室
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateInvite}
              className="-mr-1 flex h-11 shrink-0 cursor-pointer items-center gap-1 px-1 text-sm font-medium text-primary-700 hover:text-primary-900 lg:mr-0 lg:h-10 lg:rounded-lg lg:border lg:border-neutral-300 lg:px-3.5 lg:text-neutral-900 lg:hover:bg-neutral-50"
            >
              <Plus className="h-4 w-4" />
              建立連結
            </button>
          </div>
          {isInviteTokensLoading ? (
            <Skeleton className="h-[140px] w-full rounded-2xl lg:h-[72px] lg:rounded-t-none" />
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
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-5 text-center lg:rounded-t-none lg:border-solid lg:border-neutral-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <Link2 className="h-[18px] w-[18px]" />
              </div>
              <p className="text-sm font-medium">目前沒有可用的邀請連結</p>
              <p className="text-xs text-neutral-500">建立一個，傳給要加入的助教</p>
            </div>
          )}
        </section>

        {!isMembersLoading && myRole && <DangerZone role={myRole} />}
      </div>
      <Drawer
        title="建立邀請連結"
        open={newMemberModalOpen}
        onClose={() => setNewMemberModalOpen(false)}
        onSubmit={handleCreateInviteToken}
      >
        <form>
          <p className="text-sm text-neutral-500 mb-2">
            任何人只要有這個連結就能加入教室
          </p>
          <label className="block mb-2 font-medium">可使用次數</label>
          <input
            className="w-full mb-4 p-2 rounded bg-neutral-100"
            placeholder="最多幾次"
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
          />
        </form>
      </Drawer>
    </>
  );
};

export default TeamList;
