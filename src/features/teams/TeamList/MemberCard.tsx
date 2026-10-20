import { Crown, X } from "lucide-react";
import { Membership } from "@/store/slices/memberships";

const MemberCard = ({
  membership,
  isMe,
  onRemove,
  onTransfer,
}: {
  membership: Membership;
  isMe: boolean;
  /** Passed only when the viewer may remove this member (owner, and not self). */
  onRemove?: (membership: Membership) => void;
  /** Passed only when the viewer may hand the classroom to this member (owner, and not self). */
  onTransfer?: (membership: Membership) => void;
}) => {
  const isOwner = membership.role === "owner";

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-white rounded-sm shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className='text-xl font-semibold'>{membership.user.name}</span>
          {isMe && (
            <span className='text-xs text-primary-900 font-medium px-2 rounded-full bg-primary-100'>你</span>
          )}
        </div>
        <p className='text-sm text-neutral-500'>{membership.user.email}</p>
      </div>
      <div className="flex items-center gap-2">
        {isOwner && (
          <div className="flex items-center gap-1 px-2 py-1 bg-warning-100 rounded-full">
            <Crown className="w-4 h-4 text-warning-900" />
            <span className="text-xs text-warning-900 font-medium">擁有者</span>
          </div>
        )}
        {onTransfer && !isMe && !isOwner && (
          <button
            className="cursor-pointer rounded-full border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            onClick={() => onTransfer(membership)}
          >
            轉為擁有者
          </button>
        )}
        {onRemove && !isMe && !isOwner && (
          <button
            aria-label={`Remove ${membership.user.name}`}
            className="cursor-pointer p-1 text-neutral-400 hover:text-danger-600"
            onClick={() => onRemove(membership)}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MemberCard;
