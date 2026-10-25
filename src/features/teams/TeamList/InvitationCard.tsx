import { Copy, Link2, Trash2 } from "lucide-react";
import { InviteToken } from "@/store/slices/memberships";
import { toast } from "sonner";

const NEXT_PUBLIC_HOST_URL = process.env.NEXT_PUBLIC_HOST_URL;

/**
 * One invite link: URL, usage, copy and delete. A stacked card on phones, a
 * single row inside the invitations card from `lg:` up.
 */
const InvitationCard = ({
  inviteToken,
  onDelete,
}: {
  inviteToken: InviteToken;
  onDelete: (id: number) => void;
}) => {
  const url = `${NEXT_PUBLIC_HOST_URL}/invitations?token=${inviteToken.token}`;
  const usedRatio = inviteToken.maxUses > 0 ? Math.min(inviteToken.uses / inviteToken.maxUses, 1) : 0;

  const usage = (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full bg-primary-700" style={{ width: `${usedRatio * 100}%` }} />
      </div>
      <span className="text-xs text-neutral-500">
        已使用 {inviteToken.uses} / {inviteToken.maxUses} 次
      </span>
    </div>
  );

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 lg:flex-row lg:items-center lg:gap-3.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-5 lg:py-3.5">
      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 lg:flex">
        <Link2 className="h-[18px] w-[18px]" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-1.5">
        <div className="flex items-center justify-between lg:order-2">
          {usage}
          <DeleteButton className="-my-3 -mr-2.5 flex lg:hidden" onClick={() => onDelete(inviteToken.id)} />
        </div>
        <span className="truncate rounded-lg bg-neutral-50 px-3 py-2.5 font-mono text-xs lg:order-1 lg:bg-transparent lg:p-0 lg:text-[13px]">
          {url.replace(/^https?:\/\//, "")}
        </span>
      </div>
      <button
        type="button"
        className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary-100 px-3.5 text-[15px] font-medium text-primary-900 hover:bg-primary-300 lg:h-10 lg:text-sm"
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast("已複製");
        }}
      >
        <Copy className="h-4 w-4" />
        <span>
          複製<span className="lg:hidden">連結</span>
        </span>
      </button>
      <DeleteButton className="hidden lg:flex" onClick={() => onDelete(inviteToken.id)} />
    </li>
  );
};

const DeleteButton = ({ className, onClick }: { className: string; onClick: () => void }) => (
  <button
    type="button"
    aria-label="刪除這個邀請連結"
    className={`h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-danger-600 ${className}`}
    onClick={onClick}
  >
    <Trash2 className="h-4 w-4" />
  </button>
);

export default InvitationCard;
