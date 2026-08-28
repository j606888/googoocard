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

const TABS = ["Members", "Invitations"] as const;

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
    if (!confirm(`Remove ${membership.user.name} from this classroom?`)) {
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
    if (!confirm("Are you sure you want to delete this invite token?")) {
      return;
    }
    await deleteInviteToken({ id });
  };

  if (isMembershipsLoading || isInviteTokensLoading) return <ListSkeleton />;

  return (
    <>
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-semibold">Teams</h2>
          <button className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600">
            <Plus className="w-4 h-4" />
            <span
              className="font-medium"
              onClick={() => setNewMemberModalOpen(true)}
            >
              Invite
            </span>
          </button>
        </div>
        <div className="flex border-b border-neutral-200 mb-3">
          {TABS.map((tab) => (
            <div
              key={tab}
              className={`px-4 py-2 cursor-pointer ${
                tab === activeTab
                  ? "border-b-2 border-primary-500 font-semibold text-primary-500"
                  : "text-neutral-500"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
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
        title="Create invite link"
        open={newMemberModalOpen}
        onClose={() => setNewMemberModalOpen(false)}
        onSubmit={handleCreateInviteToken}
      >
        <form>
          <p className="text-sm text-neutral-500 mb-2">
            Anymoe with invite link can join the classroom
          </p>
          <label className="block mb-2 font-medium">Max usage</label>
          <input
            className="w-full mb-4 p-2 rounded bg-neutral-100"
            placeholder="Max uses"
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
          />
        </form>
      </Drawer>
    </>
  );
};

export default TeamList;
