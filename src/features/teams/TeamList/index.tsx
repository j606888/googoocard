import { Plus } from "lucide-react";
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
} from "@/store/slices/memberships";
import { useGetMeQuery } from "@/store/slices/me";
import ListSkeleton from "@/components/skeletons/ListSkeleton";

// Label is display text; `value` stays the identifier the panels switch on.
const TABS = [
  { label: "成員", value: "Members" },
  { label: "邀請連結", value: "Invitations" },
] as const;

const TeamList = () => {
  const [newMemberModalOpen, setNewMemberModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Members" | "Invitations">(
    "Members"
  );
  const { data: memberships, isLoading: isMembershipsLoading } = useGetMembershipsQuery();
  const [createInviteToken] = useCreateInviteTokenMutation();
  const [deleteInviteToken] = useDeleteInviteTokenMutation();
  const { data: inviteTokens, isLoading: isInviteTokensLoading } = useGetInviteTokensQuery();
  const { data: me } = useGetMeQuery();
  const [removeMembership] = useRemoveMembershipMutation();
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

  if (isMembershipsLoading || isInviteTokensLoading) return <ListSkeleton />;

  return (
    <>
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-semibold">團隊</h2>
          <button className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600">
            <Plus className="w-4 h-4" />
            <span
              className="font-medium"
              onClick={() => setNewMemberModalOpen(true)}
            >
              邀請
            </span>
          </button>
        </div>
        <div className="flex border-b border-neutral-200 mb-3">
          {TABS.map((tab) => (
            <div
              key={tab.value}
              className={`px-4 py-2 cursor-pointer ${
                tab.value === activeTab
                  ? "border-b-2 border-primary-500 font-semibold text-primary-500"
                  : "text-neutral-500"
              }`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </div>
          ))}
        </div>
        {activeTab === "Members" && (
          <div className="flex flex-col gap-3">
            {memberships?.map((membership) => (
              <MemberCard
                key={membership.id}
                membership={membership}
                isMe={membership.userId === me?.id}
                onRemove={isOwner ? handleRemoveMember : undefined}
              />
            ))}
            {myRole && <DangerZone role={myRole} />}
          </div>
        )}
        {activeTab === "Invitations" && (
          <div className="flex flex-col gap-3">
            {inviteTokens?.map((inviteToken) => (
              <InvitationCard
                key={inviteToken.id}
                inviteToken={inviteToken}
                onDelete={handleDeleteInviteToken}
              />
            ))}
          </div>
        )}
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
