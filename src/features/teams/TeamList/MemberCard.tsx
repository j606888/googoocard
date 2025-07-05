import { Crown } from "lucide-react";
import { Membership } from "@/store/slices/memberships";

const MemberCard = ({ membership, isMe }: { membership: Membership, isMe: boolean }) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-white rounded-sm shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className='text-xl font-semibold'>{membership.user.name}</span>
          {isMe && (
            <span className='text-xs text-primary-900 font-medium px-2 rounded-full bg-primary-100'>You</span>
          )}
        </div>
        <p className='text-sm text-gray-500'>{membership.user.email}</p>
      </div>
      {membership.role === 'owner' && (
        <div className="flex items-center gap-1 px-2 py-1 bg-warning-100 rounded-full">
          <Crown className="w-4 h-4 text-warning-900" />
          <span className="text-xs text-warning-900 font-medium">Owner</span>
        </div>
      )}
    </div>
  );
};

export default MemberCard;