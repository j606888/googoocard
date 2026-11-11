import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Crown,
  MoreHorizontal,
  Pencil,
  Send,
  ShieldCheck,
  Trash,
  UserMinus,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import StatusTag, { type StatusTone } from "@/components/StatusTag";
import TeacherAvatar from "@/features/teachers/TeacherAvatar";
import { roleLabel } from "@/lib/roles";
import { TEACHER_KIND_LABELS } from "@/lib/teachers";
import type { Membership } from "@/store/slices/memberships";
import type { Teacher } from "@/store/slices/teachers";

const menuItem =
  "flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-neutral-100";

const ROLE_TONES: Record<string, StatusTone> = {
  owner: "warning",
  admin: "warning",
  teacher: "positive",
  assistant: "neutral",
};

export interface PersonActions {
  /** 編輯名字、身分、分部……（任何成員都可以）。 */
  onEdit: (person: Teacher) => void;
  /** 以下只有管理員會傳。 */
  onInvite?: (person: Teacher) => void;
  onChangeRole?: (membership: Membership) => void;
  onRemove?: (membership: Membership) => void;
  /** 只有建立者會傳。 */
  onTransfer?: (membership: Membership) => void;
  onArchive: (person: Teacher, archived: boolean) => void;
  onDelete: (person: Teacher) => void;
}

/**
 * 團隊名冊的一列：一個人。身分（老師／小幫手／不上課）與帳號（有沒有、什麼角色）並排，
 * 三種情況——有帳號也上課、沒帳號的外師、有帳號但不上課——一眼就分得出來。
 */
const PersonRow = ({
  person,
  membership,
  isMe,
  actions,
}: {
  person: Teacher;
  /** 這個人的帳號；沒帳號就是 undefined。 */
  membership: Membership | undefined;
  isMe: boolean;
  actions: PersonActions;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const archived = Boolean(person.archivedAt);
  const isOwner = membership?.role === "owner";
  const canChangeRole = membership && actions.onChangeRole;
  const canTransfer = membership && actions.onTransfer && !isMe && !isOwner;
  const canRemove = membership && actions.onRemove && !isMe && !isOwner;
  const canInvite = !membership && !archived && actions.onInvite;

  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3 lg:gap-3.5 lg:px-5">
      <TeacherAvatar name={person.name} color={person.color} icon={person.icon} muted={archived} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium text-neutral-900">{person.name}</span>
          {isMe && <StatusTag tone="positive">你</StatusTag>}
          <span className="text-xs text-neutral-600">{TEACHER_KIND_LABELS[person.kind]}</span>
          {person.locations.length > 0 && (
            <span className="text-xs text-neutral-500">
              {person.locations.map((l) => l.name).join("、")}
            </span>
          )}
        </div>
        <span className="truncate text-xs text-neutral-500 lg:text-sm">
          {membership ? membership.user.email : "沒有帳號"}
        </span>
      </div>

      {membership ? (
        <StatusTag tone={ROLE_TONES[membership.role] ?? "neutral"}>
          {isOwner && <Crown aria-label="建立者" className="h-3.5 w-3.5" />}
          {roleLabel(membership.role)}
        </StatusTag>
      ) : canInvite ? (
        <Button variant="secondary" size="sm" className="gap-1" onClick={() => actions.onInvite!(person)}>
          <Send className="size-3.5" />
          邀請
        </Button>
      ) : archived ? (
        <StatusTag tone="neutral">已封存</StatusTag>
      ) : null}

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${person.name} 的更多操作`}
            className="-mr-2 text-neutral-600 data-[state=open]:bg-neutral-100"
          >
            <MoreHorizontal className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex w-56 flex-col p-1.5">
          {!archived && (
            <button type="button" className={menuItem} onClick={run(() => actions.onEdit(person))}>
              <Pencil className="h-4 w-4" />
              編輯資料
            </button>
          )}
          {canChangeRole && (
            <button type="button" className={menuItem} onClick={run(() => actions.onChangeRole!(membership))}>
              <ShieldCheck className="h-4 w-4" />
              {isMe || isOwner ? "帳號設定" : "改角色"}
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
          {!membership && (
            <button
              type="button"
              className={menuItem}
              onClick={run(() => actions.onArchive(person, !archived))}
            >
              {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {archived ? "還原" : "封存"}
            </button>
          )}
          {!membership && person.lessonCount === 0 && (
            <button
              type="button"
              className={`${menuItem} text-danger-700 hover:bg-danger-50`}
              onClick={run(() => actions.onDelete(person))}
            >
              <Trash className="h-4 w-4" />
              刪除
            </button>
          )}
        </PopoverContent>
      </Popover>
    </li>
  );
};

export default PersonRow;
