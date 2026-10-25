import { useState } from "react";
import { Crown, MoreHorizontal, UserMinus } from "lucide-react";
import { Membership } from "@/store/slices/memberships";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Initials avatar tints, picked by user id so a person keeps their colour.
const AVATAR_TINTS = [
  "bg-primary-100 text-primary-900",
  "bg-warning-100 text-warning-900",
  "bg-sky-100 text-sky-900",
  "bg-neutral-100 text-neutral-700",
];

const menuItem =
  "flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-neutral-100";

/** One row of the members card: avatar, name + email, role, and (for an owner viewing an assistant) a ⋯ menu. */
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
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = membership.role === "owner";
  const { name, email } = membership.user;
  const canTransfer = onTransfer && !isMe && !isOwner;
  const canRemove = onRemove && !isMe && !isOwner;

  return (
    <li className="flex items-center gap-3 px-4 py-3 lg:gap-3.5 lg:px-5">
      <div
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
          AVATAR_TINTS[membership.userId % AVATAR_TINTS.length]
        }`}
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          {isMe && (
            <span className="shrink-0 rounded-full bg-primary-100 px-2 text-xs font-medium text-primary-900">
              你
            </span>
          )}
        </div>
        <span className="truncate text-xs text-neutral-500 lg:text-sm">{email}</span>
      </div>
      {isOwner ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning-100 px-2.5 py-1 text-xs font-medium text-warning-900">
          <Crown className="h-3.5 w-3.5" />
          擁有者
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
          助教
        </span>
      )}
      {/* Keeps the role pills in one column when other rows have a menu. */}
      {(onTransfer || onRemove) && !canTransfer && !canRemove && (
        <div aria-hidden="true" className="-mr-2 w-11 shrink-0" />
      )}
      {(canTransfer || canRemove) && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${name} 的更多操作`}
              className="-mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 data-[state=open]:bg-neutral-100"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-56 flex-col rounded-xl p-1.5">
            {canTransfer && (
              <button
                type="button"
                className={menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  onTransfer(membership);
                }}
              >
                <Crown className="h-4 w-4" />
                把教室交給他
              </button>
            )}
            {canRemove && (
              <button
                type="button"
                className={`${menuItem} text-danger-700 hover:bg-danger-50`}
                onClick={() => {
                  setMenuOpen(false);
                  onRemove(membership);
                }}
              >
                <UserMinus className="h-4 w-4" />
                移出教室
              </button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </li>
  );
};

export default MemberCard;
