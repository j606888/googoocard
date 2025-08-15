import { Copy, Trash } from "lucide-react";
import { InviteToken } from "@/store/slices/memberships";
import { toast } from "sonner";

const NEXT_PUBLIC_HOST_URL = process.env.NEXT_PUBLIC_HOST_URL;

const InvitationCard = ({ inviteToken, onDelete }: { inviteToken: InviteToken, onDelete: (id: number) => void }) => {
  return <div className='border border-gray-200 rounded-sm p-3 flex flex-col gap-2'>
    <div className='flex items-center justify-between'>
      <div className='flex items-center gap-2'>
        <span className='text-sm'>usage:</span>
        <span className='text-sm font-medium'>{inviteToken.uses} / {inviteToken.maxUses}</span>
      </div>
      <Trash className='w-4 h-4 text-gray-500 cursor-pointer' onClick={() => onDelete(inviteToken.id)} />
    </div>
    <div className='bg-primary-50 px-3 py-2 rounded-sm text-primary-900 text-sm truncate'>
      {NEXT_PUBLIC_HOST_URL}/invitations?token={inviteToken.token}
    </div>
    <button className='bg-primary-500 text-white px-3 py-2 rounded-sm flex items-center gap-2 justify-center cursor-pointer hover:bg-primary-600' onClick={() => {
      navigator.clipboard.writeText(`${NEXT_PUBLIC_HOST_URL}/invitations?token=${inviteToken.token}`);
      toast("Copied to clipboard");
    }}>
      <Copy className='w-4 h-4' />
      <span className='text-sm'>Copy the link</span>
    </button>
  </div>;
};

export default InvitationCard;