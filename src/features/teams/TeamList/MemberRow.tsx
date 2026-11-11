import { useState } from "react";
import Link from "next/link";
import { Crown, Link2, MoreHorizontal, Pencil, ShieldCheck, UserMinus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import StatusTag, { type StatusTone } from "@/components/StatusTag";
import TeacherAvatar from "@/features/teachers/TeacherAvatar";
import { roleLabel } from "@/lib/roles";
import type { Membership } from "@/store/slices/memberships";
import { isLinkedTeacher } from "./teacherLink";

const menuItem =
  "flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-neutral-100";

const ROLE_TONES: Record<string, StatusTone> = {
  owner: "warning",
  admin: "warning",
  teacher: "positive",
  assistant: "neutral",
};

export interface MemberActions {
  /** 編輯自己那筆人員資料（名字、顏色、分部）。 */
  onEditPerson: (membership: Membership) => void;
  /** 以下只有管理員會傳。 */
  onLinkTeacher?: (membership: Membership) => void;
  onChangeRole?: (membership: Membership) => void;
  onRemove?: (membership: Membership) => void;
  /** 只有建立者會傳。 */
  onTransfer?: (membership: Membership) => void;
}

/**
 * 團隊的一列：一個帳號。名字／email、角色，和「老師身分」——連到哪位老師、還沒連、或不教課。
 */
const MemberRow = ({
  membership,
  isMe,
  needsLink,
  actions,
}: {
  membership: Membership;
  isMe: boolean;
  /** 角色是老師、或老師頁有同名的人，卻還沒連到老師。 */
  needsLink: boolean;
  actions: MemberActions;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const person = membership.teacher;
  const isOwner = membership.role === "owner";
  const canChangeRole = actions.onChangeRole && !isMe && !isOwner;
  const canTransfer = actions.onTransfer && !isMe && !isOwner;
  const canRemove = actions.onRemove && !isMe && !isOwner;
  const linked = isLinkedTeacher(membership);

  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const teacherCell = linked ? (
    <Link
      href={`/teachers/${person!.id}`}
      className="relative inline-flex items-center gap-1.5 text-sm text-neutral-800 hover:underline"
    >
      老師 {person!.name}
    </Link>
  ) : needsLink && actions.onLinkTeacher ? (
    <button
      type="button"
      onClick={() => actions.onLinkTeacher!(membership)}
      className="inline-flex h-9 items-center rounded-lg border border-dashed border-warning-400 px-3 text-[13px] font-semibold text-warning-900 hover:bg-warning-50"
    >
      還沒連 · 連到老師
    </button>
  ) : needsLink ? (
    <span className="text-sm text-warning-900">還沒連到老師</span>
  ) : (
    <span className="text-sm text-neutral-500">不教課</span>
  );

  return (
    <li className="flex items-center gap-3 px-4 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_96px_180px_40px] lg:gap-4 lg:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {person ? (
          <TeacherAvatar name={person.name} color={person.color} icon={person.icon} />
        ) : (
          <TeacherAvatar name={membership.user.name} color="neutral" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-neutral-900">{membership.user.name}</span>
            {isMe && <StatusTag tone="positive">你</StatusTag>}
          </div>
          <span className="truncate text-xs text-neutral-500 lg:text-sm">{membership.user.email}</span>
          {/* 手機：老師身分放在 email 下面。 */}
          <div className="mt-1 lg:hidden">{teacherCell}</div>
        </div>
      </div>

      <StatusTag tone={ROLE_TONES[membership.role] ?? "neutral"} className="shrink-0 lg:justify-self-start">
        {isOwner && <Crown aria-label="建立者" className="h-3.5 w-3.5" />}
        {roleLabel(membership.role)}
      </StatusTag>

      <div className="hidden lg:block">{teacherCell}</div>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${membership.user.name} 的更多操作`}
            className="-mr-2 text-neutral-600 data-[state=open]:bg-neutral-100"
          >
            <MoreHorizontal className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-56 flex-col p-1.5">
          {actions.onLinkTeacher && (
            <button type="button" className={menuItem} onClick={run(() => actions.onLinkTeacher!(membership))}>
              <Link2 className="h-4 w-4" />
              {linked ? "改連到別的老師" : "連到老師"}
            </button>
          )}
          {person && (
            <button type="button" className={menuItem} onClick={run(() => actions.onEditPerson(membership))}>
              <Pencil className="h-4 w-4" />
              編輯名字與顏色
            </button>
          )}
          {canChangeRole && (
            <button type="button" className={menuItem} onClick={run(() => actions.onChangeRole!(membership))}>
              <ShieldCheck className="h-4 w-4" />
              改角色
            </button>
          )}
          {canTransfer && (
            <button type="button" className={menuItem} onClick={run(() => actions.onTransfer!(membership))}>
              <Crown className="h-4 w-4" />
              把教室交給他
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              className={`${menuItem} text-danger-700 hover:bg-danger-50`}
              onClick={run(() => actions.onRemove!(membership))}
            >
              <UserMinus className="h-4 w-4" />
              移出教室
            </button>
          )}
        </PopoverContent>
      </Popover>
    </li>
  );
};

export default MemberRow;
