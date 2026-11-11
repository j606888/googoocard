import { Link2, Plus, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PersonRow, { type PersonActions } from "./PersonRow";
import InvitationCard from "./InvitationCard";
import DangerZone from "./DangerZone";
import {
  Membership,
  useDeleteInviteTokenMutation,
  useGetInviteTokensQuery,
  useGetMembershipsQuery,
  useRemoveMembershipMutation,
  useTransferOwnershipMutation,
} from "@/store/slices/memberships";
import {
  useDeleteTeacherMutation,
  useGetTeachersQuery,
  useUpdateTeacherMutation,
  type Teacher,
} from "@/store/slices/teachers";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import SegmentedTabs from "@/components/SegmentedTabs";
import TeacherForm from "@/features/teachers/TeacherForm";
import { isAdminRole } from "@/lib/roles";
import InviteDrawer from "./InviteDrawer";
import EditMemberDrawer from "./EditMemberDrawer";
import { teamErrorMessage } from "./teamErrors";

// Mirrors a PersonRow: avatar, name + account line, role pill.
const PersonRowSkeleton = () => (
  <li className="flex items-center gap-3 px-4 py-3 lg:px-5">
    <Skeleton className="size-10 rounded-full" />
    <div className="flex flex-1 flex-col gap-1">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-4 w-40" />
    </div>
    <Skeleton className="h-5.5 w-14" />
  </li>
);

// Mirrors an InvitationCard row: link icon, URL, usage bar, copy button.
const InvitationCardSkeleton = () => (
  <li className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 lg:flex-row lg:items-center lg:gap-3.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-5 lg:py-3.5">
    <Skeleton className="hidden size-10 shrink-0 rounded-lg lg:block" />
    <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-2">
      <Skeleton className="h-3.5 w-56 max-w-full" />
      <Skeleton className="h-3 w-36" />
    </div>
    <Skeleton className="h-11 w-full rounded-xl lg:h-9 lg:w-20" />
  </li>
);

const HINT = "身分是在課程裡做什麼（老師／小幫手）；帳號角色是能不能登入、能管什麼。";

const sectionCard = "rounded-2xl border border-neutral-200 bg-white";

const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, teacher: 2, assistant: 3 };

type Tab = "active" | "archived";

/**
 * 團隊：教室裡的每一個人，一列一個（團隊與老師合併，2026-11）。
 *
 * 一個人＝一筆人員資料（`Teacher`）：名字、代表色、身分（老師／小幫手／不上課）、分部。
 * 有帳號的另外連著一筆 `Membership`（角色＝權限）。三種情況都在同一張名冊：
 * 有帳號也上課、沒帳號的外師（可以從這一列邀請）、有帳號但不上課的管理員。
 * 帳號加入時自動建人員資料（`ensurePerson()`），所以名冊和帳號永遠一對一。
 */
const TeamList = () => {
  const [tab, setTab] = useState<Tab>("active");
  const [inviting, setInviting] = useState<{ person: Teacher | null } | null>(null);
  const [editingMember, setEditingMember] = useState<Membership | null>(null);
  const [editingPerson, setEditingPerson] = useState<{ key: number; person?: Teacher } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<Teacher | null>(null);

  const { data: memberships, isLoading: isMembershipsLoading } = useGetMembershipsQuery();
  const { data: people, isLoading: isPeopleLoading } = useGetTeachersQuery();
  const { data: inviteTokens, isLoading: isInviteTokensLoading } = useGetInviteTokensQuery();
  const { data: me, isLoading: isMeLoading } = useGetMeQuery();
  const { data: classrooms } = useGetClassroomsQuery();
  const classroomName = classrooms?.classrooms.find(
    (c) => c.id === classrooms.currentClassroomId
  )?.name;
  const [deleteInviteToken] = useDeleteInviteTokenMutation();
  const [removeMembership] = useRemoveMembershipMutation();
  const [transferOwnership] = useTransferOwnershipMutation();
  const [updateTeacher] = useUpdateTeacherMutation();
  const [deleteTeacher, { isLoading: isDeleting }] = useDeleteTeacherMutation();

  const myRole = memberships?.find((membership) => membership.userId === me?.id)?.role;
  const isOwner = myRole === "owner";
  const isAdmin = isAdminRole(myRole);

  const memberByUser = useMemo(
    () => new Map((memberships ?? []).map((m) => [m.userId, m])),
    [memberships]
  );

  // 有帳號的照角色排在前面（自己最上面），沒帳號的照建立順序接在後面。
  const sorted = useMemo(() => {
    const rank = (person: Teacher) => {
      const member = person.userId !== null ? memberByUser.get(person.userId) : undefined;
      if (!member) return 10;
      if (member.userId === me?.id) return -1;
      return ROLE_ORDER[member.role] ?? 5;
    };
    return [...(people ?? [])].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  }, [people, memberByUser, me?.id]);
  const active = sorted.filter((p) => !p.archivedAt);
  const archived = sorted.filter((p) => p.archivedAt);
  const shown = tab === "archived" && archived.length > 0 ? archived : active;

  // 老師頁的「到團隊編輯」帶 ?person=<id>：打開那個人的編輯抽屜。
  useEffect(() => {
    if (!people) return;
    const id = Number(new URLSearchParams(window.location.search).get("person"));
    const person = people.find((p) => p.id === id);
    if (person) {
      setEditingPerson({ key: Date.now(), person });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [people]);

  const actions: PersonActions = {
    onEdit: (person) => setEditingPerson({ key: Date.now(), person }),
    onInvite: isAdmin ? (person) => setInviting({ person }) : undefined,
    onChangeRole: isAdmin ? setEditingMember : undefined,
    onRemove: isAdmin
      ? async (membership) => {
          if (!confirm(`確定要把 ${membership.user.name} 移出這間教室嗎？\n他的人員資料會留著，舊課照常顯示。`)) return;
          await removeMembership({ id: membership.id });
        }
      : undefined,
    onTransfer: isOwner
      ? async (membership) => {
          if (
            !confirm(
              `確定要把教室交給 ${membership.user.name} 嗎？\n你會變成一般管理員，之後就不能再刪除教室。`
            )
          ) {
            return;
          }
          await transferOwnership({ id: membership.id });
        }
      : undefined,
    onArchive: async (person, value) => {
      try {
        await updateTeacher({ id: person.id, archived: value }).unwrap();
        toast.success(value ? `已封存 ${person.name}` : `已還原 ${person.name}`);
      } catch (e) {
        toast.error(teamErrorMessage(e, "操作失敗"));
      }
    },
    onDelete: setConfirmingDelete,
  };

  const handleDelete = async () => {
    if (!confirmingDelete) return;
    try {
      await deleteTeacher({ id: confirmingDelete.id }).unwrap();
      toast.success(`已刪除 ${confirmingDelete.name}`);
    } catch (e) {
      toast.error(teamErrorMessage(e, "刪除失敗"));
    }
    setConfirmingDelete(null);
  };

  const handleDeleteInviteToken = async (id: number) => {
    if (!confirm("確定要刪除這個邀請連結嗎？")) return;
    await deleteInviteToken({ id });
  };

  const isLoading = isMembershipsLoading || isMeLoading || isPeopleLoading;

  return (
    <>
      <div className="flex w-full max-w-[760px] flex-col gap-5 px-4 py-4 lg:gap-6 lg:px-8 lg:py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-2xl font-bold">團隊</h2>
            <p className="truncate text-[13px] text-neutral-500 lg:text-sm">
              {classroomName}
              {people && `・${active.length} 人`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant={isAdmin ? "secondary" : "primary"}
              onClick={() => setEditingPerson({ key: Date.now() })}
            >
              <Plus />
              <span>
                新增<span className="hidden lg:inline">人員</span>
              </span>
            </Button>
            {isAdmin && (
              <Button type="button" onClick={() => setInviting({ person: null })}>
                <UserPlus />
                <span>
                  邀請<span className="hidden lg:inline">成員</span>
                </span>
              </Button>
            )}
          </div>
        </header>

        <section className="flex flex-col gap-2 lg:gap-0">
          <div className="mx-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:mx-0 lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-neutral-200 lg:bg-white lg:px-5 lg:pt-4 lg:pb-3.5">
            <h3 className="text-sm font-bold text-neutral-700 lg:text-base lg:text-neutral-900">名冊</h3>
            {archived.length > 0 && (
              <SegmentedTabs<Tab>
                ariaLabel="名冊狀態"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "active", label: "在職中", hint: active.length },
                  { value: "archived", label: "已封存", hint: archived.length },
                ]}
              />
            )}
          </div>
          <ul className={`${sectionCard} divide-y divide-neutral-100 lg:rounded-t-none`}>
            {isLoading && Array.from({ length: 4 }, (_, i) => <PersonRowSkeleton key={i} />)}
            {!isLoading &&
              shown.map((person) => {
                const membership = person.userId !== null ? memberByUser.get(person.userId) : undefined;
                return (
                  <PersonRow
                    key={person.id}
                    person={person}
                    membership={membership}
                    isMe={person.userId !== null && person.userId === me?.id}
                    actions={actions}
                  />
                );
              })}
          </ul>
          <p className="mx-1 text-xs leading-relaxed text-neutral-500 lg:mx-0 lg:mt-2">
            {HINT}
            {!isAdmin && myRole && "要邀請、改角色或移除成員，請找管理員。"}
          </p>
        </section>

        {isAdmin && (
          <section className="flex flex-col gap-2 lg:gap-0">
            <div className="mx-1 flex items-center justify-between gap-3 lg:mx-0 lg:rounded-t-2xl lg:border lg:border-b-0 lg:border-neutral-200 lg:bg-white lg:px-5 lg:pt-4 lg:pb-3.5">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold text-neutral-700 lg:text-base lg:text-neutral-900">邀請連結</h3>
                <p className="hidden text-[13px] text-neutral-500 lg:block">
                  傳給要加入的人，對方登入後就會以連結上的角色加入
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setInviting({ person: null })}
                className="shrink-0 gap-1"
              >
                <Plus className="size-4" />
                建立連結
              </Button>
            </div>
            {isInviteTokensLoading ? (
              <ul className="flex flex-col gap-2 lg:gap-0 lg:rounded-b-2xl lg:border lg:border-neutral-200 lg:bg-white">
                <InvitationCardSkeleton />
              </ul>
            ) : inviteTokens && inviteTokens.length > 0 ? (
              <ul className="flex flex-col gap-2 lg:gap-0 lg:divide-y lg:divide-neutral-100 lg:rounded-b-2xl lg:border lg:border-neutral-200 lg:bg-white">
                {inviteTokens.map((inviteToken) => (
                  <InvitationCard
                    key={inviteToken.id}
                    inviteToken={inviteToken}
                    onDelete={handleDeleteInviteToken}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                kind="inline"
                icon={<Link2 />}
                title="目前沒有可用的邀請連結"
                description="名冊上沒帳號的人，從他那一列按「邀請」；新來的人用一般連結"
                className="bg-white lg:rounded-t-none lg:rounded-b-2xl lg:border lg:border-solid lg:px-5"
              />
            )}
          </section>
        )}

        {!isLoading && myRole && <DangerZone role={myRole} />}
      </div>

      {inviting && (
        <InviteDrawer
          key={inviting.person?.id ?? "new"}
          open
          person={inviting.person}
          onClose={() => setInviting(null)}
        />
      )}
      {editingMember && (
        <EditMemberDrawer
          key={editingMember.id}
          membership={editingMember}
          isMe={editingMember.userId === me?.id}
          onClose={() => setEditingMember(null)}
        />
      )}
      {editingPerson && (
        <TeacherForm
          key={editingPerson.key}
          open
          teacher={editingPerson.person}
          onClose={() => setEditingPerson(null)}
        />
      )}
      {confirmingDelete && (
        <ConfirmDelete
          name={confirmingDelete.name}
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </>
  );
};

const ConfirmDelete = ({
  name,
  isLoading,
  onConfirm,
  onCancel,
}: {
  name: string;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <ConfirmDialog
    open
    title={`刪除「${name}」？`}
    message="他沒上過課，刪掉不影響其他資料。"
    confirmLabel="刪除"
    variant="danger"
    isLoading={isLoading}
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);

export default TeamList;
