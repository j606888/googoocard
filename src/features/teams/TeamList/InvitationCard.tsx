import { Copy, Trash2 } from "lucide-react";
import { InviteToken } from "@/store/slices/memberships";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";

const NEXT_PUBLIC_HOST_URL = process.env.NEXT_PUBLIC_HOST_URL;

export const inviteUrl = (token: string) => `${NEXT_PUBLIC_HOST_URL}/invitations?token=${token}`;

/**
 * One invite link: URL, then the role it hands out and its usage as one ink-3 line, copy and delete.
 * A hairline row in the invitations list.
 */
const InvitationCard = ({
  inviteToken,
  onDelete,
}: {
  inviteToken: InviteToken;
  onDelete: (id: number) => void;
}) => {
  const url = inviteUrl(inviteToken.token);
  const meta = [
    roleLabel(inviteToken.role),
    inviteToken.teacher && `給 ${inviteToken.teacher.name}`,
    `已使用 ${inviteToken.uses} / ${inviteToken.maxUses} 次`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex min-h-14 items-center gap-2 py-2.5 lg:gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-mono text-[13px] text-ink">{url.replace(/^https?:\/\//, "")}</span>
        <span className="truncate text-[13px] tabular-nums text-ink-3">{meta}</span>
      </div>
      <Button
        type="button"
        variant="text"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast("已複製");
        }}
      >
        <Copy className="size-4" />
        <span>
          複製<span className="lg:hidden">連結</span>
        </span>
      </Button>
      <DeleteButton className="-mr-2" onClick={() => onDelete(inviteToken.id)} />
    </li>
  );
};

const DeleteButton = ({ className, onClick }: { className: string; onClick: () => void }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    aria-label="刪除這個邀請連結"
    className={cn("text-ink-3 hover:bg-danger-50 hover:text-danger-700", className)}
    onClick={onClick}
  >
    <Trash2 className="size-4" />
  </Button>
);

export default InvitationCard;
