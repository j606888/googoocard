import { useState } from "react";
import { Crown, Link2, MoreHorizontal, Pencil, UserMinus } from "lucide-react";
import { Membership } from "@/store/slices/memberships";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import StatusTag, { type StatusTone } from "@/components/StatusTag";
import { roleLabel } from "@/lib/roles";

// Initials avatar tints, picked by user id so a person keeps their colour.
const AVATAR_TINTS = [
  "bg-primary-100 text-primary-900",
  "bg-warning-100 text-warning-950",
  "bg-primary-50 text-primary-700",
  "bg-neutral-100 text-neutral-700",
];

const menuItem =
  "flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-neutral-100";

const ROLE_TONES: Record<string, StatusTone> = {
  owner: "warning",
  admin: "warning",
  teacher: "positive",
  assistant: "neutral",
};

/**
 * One row of the members card: avatar, name + email (+ the teacher they're
 * linked to), role, and for a 管理員 viewer a ⋯ menu.
 */
const MemberCard = ({
  membership,
  isMe,
  onEdit,
  onRemove,
  onTransfer,
}: {
  membership: Membership;
  isMe: boolean;
  /** Passed only when the viewer is a 管理員 — any row, own included (to link a teacher). */
  onEdit?: (membership: Membership) => void;
  /** Passed only when the viewer may remove members (管理員); never offered on self or the owner. */
  onRemove?: (membership: Membership) => void;
  /** Passed only when the viewer is the owner; never offered on self. */
  onTransfer?: (membership: Membership) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = membership.role === "owner";
  const { name, email } = membership.user;
  const canTransfer = onTransfer && !isMe && !isOwner;
  const canRemove = onRemove && !isMe && !isOwner;
  const hasMenu = onEdit || canTransfer || canRemove;

  return (
    <li className="flex items-center gap-3 px-4 py-3 lg:gap-3.5 lg:px-5">
      <div
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
          AVATAR_TINTS[membership.userId % AVATAR_TINTS.length]
        }`}
      >
        {name.trim().charAt(0).toUpperCase()}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-neutral-900">{name}</span>
          {isMe && (
            <StatusTag tone="positive">你</StatusTag>
          )}
        </div>
        <span className="truncate text-xs text-neutral-500 lg:text-sm">{email}</span>
        {membership.teacher && (
          <span className="flex items-center gap-1 truncate text-xs font-medium text-primary-700">
            <Link2 aria-hidden="true" className="size-3.5 shrink-0" />
            {membership.teacher.name}
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 lg:flex-row lg:items-center lg:gap-1.5">
        <StatusTag tone={ROLE_TONES[membership.role] ?? "neutral"}>
          {isOwner && <Crown aria-label="建立者" className="h-3.5 w-3.5" />}
          {roleLabel(membership.role)}
        </StatusTag>
        {membership.customized && <StatusTag tone="outline">自訂權限</StatusTag>}
      </div>
      {hasMenu && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${name} 的更多操作`}
              className="-mr-2 text-neutral-600 data-[state=open]:bg-neutral-100"
            >
              <MoreHorizontal className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-56 flex-col p-1.5">
            {onEdit && (
              <button
                type="button"
                className={menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(membership);
                }}
              >
                <Pencil className="h-4 w-4" />
                {isMe || isOwner ? "連結老師資料" : "改角色與權限"}
              </button>
            )}
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
