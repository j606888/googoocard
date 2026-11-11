import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import TeacherAvatar from "@/features/teachers/TeacherAvatar";
import { cn } from "@/lib/utils";
import { canTeach } from "@/lib/teachers";
import { useUpdateMembershipMutation, type Membership } from "@/store/slices/memberships";
import { useGetTeachersQuery, useUpdateTeacherMutation } from "@/store/slices/teachers";
import { linkableTeachers, suggestedTeacher } from "./teacherLink";
import { teamErrorMessage } from "./teamErrors";

type Choice = `t${number}` | "new" | "none";

/**
 * 「他是哪一位老師？」——把成員的帳號連到老師頁上的一位老師。
 * - 選一位老師：帳號連過去；加入時自動建的那筆（協助紀錄）併進去、刪掉（API `mergePersonInto`）。
 * - 新增一位老師：他自己那筆改成會教課的人，出現在老師頁。
 * - 他不教課：他自己那筆改成小幫手，不在老師頁，小幫手選單還選得到。
 * Mount with `key`.
 */
export default function LinkTeacherDrawer({
  membership,
  onClose,
}: {
  membership: Membership;
  onClose: () => void;
}) {
  const { data: teachers = [] } = useGetTeachersQuery();
  const own = membership.teacher;
  const candidates = linkableTeachers(teachers, membership.userId);
  const suggested = suggestedTeacher(membership, teachers);
  const initial: Choice =
    own && canTeach(own.kind)
      ? `t${own.id}`
      : suggested
        ? `t${suggested.id}`
        : membership.role === "teacher"
          ? "new"
          : "none";
  const [choice, setChoice] = useState<Choice>(initial);
  const [updateMembership, { isLoading: isLinking }] = useUpdateMembershipMutation();
  const [updateTeacher, { isLoading: isUpdating }] = useUpdateTeacherMutation();
  const name = membership.user.name;
  const picked = choice.startsWith("t") ? teachers.find((t) => `t${t.id}` === choice) : undefined;

  const handleSubmit = async () => {
    try {
      if (picked) {
        if (picked.id !== own?.id) await updateMembership({ id: membership.id, teacherId: picked.id }).unwrap();
        toast.success(`已把 ${name} 連到老師 ${picked.name}`);
      } else if (own) {
        // 自己那筆改身分：要教課 → 老師（當過小幫手的 → 老師＋小幫手）；不教課 → 小幫手。
        const kind =
          choice === "new"
            ? own.kind === "ASSISTANT" || own.kind === "BOTH"
              ? "BOTH"
              : "TEACHER"
            : canTeach(own.kind)
              ? "ASSISTANT"
              : own.kind;
        if (kind !== own.kind) await updateTeacher({ id: own.id, kind }).unwrap();
        toast.success(choice === "new" ? `${name} 已經在老師頁上` : `${name} 不在老師頁上`);
      }
      onClose();
    } catch (e) {
      toast.error(teamErrorMessage(e, "更新失敗"));
    }
  };

  const currentTeachesHere = own && canTeach(own.kind);

  return (
    <Drawer
      open
      title={`${name} 是哪一位老師？`}
      subtitle={membership.user.email}
      submitText={picked ? `連到 ${picked.name}` : "儲存"}
      isLoading={isLinking || isUpdating}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">選一位老師</legend>
        {candidates.length > 0 && <p className="text-xs text-neutral-500">老師頁上的老師</p>}
        {candidates.map((teacher) => (
          <Option
            key={teacher.id}
            checked={choice === `t${teacher.id}`}
            onSelect={() => setChoice(`t${teacher.id}`)}
            avatar={<TeacherAvatar name={teacher.name} color={teacher.color} icon={teacher.icon} size="sm" />}
            title={teacher.name}
            detail={[
              teacher.locations.map((l) => l.name).join("、"),
              teacher.lessonCount > 0 ? `教過 ${teacher.lessonCount} 門課` : "還沒教過課",
            ]
              .filter(Boolean)
              .join(" · ")}
            tag={
              teacher.userId === membership.userId
                ? "目前"
                : teacher.id === suggested?.id
                  ? "名字相同"
                  : undefined
            }
          />
        ))}
        <div className="my-1 h-px bg-neutral-100" />
        {!currentTeachesHere && (
          <Option
            checked={choice === "new"}
            onSelect={() => setChoice("new")}
            title={`新增一位老師「${own?.name ?? name}」`}
            detail="老師頁上還沒有他"
          />
        )}
        <Option
          checked={choice === "none"}
          onSelect={() => setChoice("none")}
          title="他不教課"
          detail="不會出現在老師頁，課程的小幫手選單還是選得到他"
        />
      </fieldset>
      <p className="mt-5 text-[13px] leading-relaxed text-neutral-500">
        {picked && picked.id !== own?.id
          ? `連起來之後，${picked.name} 教的課會變成 ${name} 的「我的課」；他之前當小幫手的紀錄也會一起搬過去。`
          : "連到老師後，他教的課就是他的「我的課」。"}
      </p>
    </Drawer>
  );
}

const Option = ({
  checked,
  onSelect,
  avatar,
  title,
  detail,
  tag,
}: {
  checked: boolean;
  onSelect: () => void;
  avatar?: ReactNode;
  title: string;
  detail: string;
  tag?: string;
}) => (
  <label
    className={cn(
      "flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3",
      checked ? "border-primary-700 bg-primary-50 ring-1 ring-primary-700" : "border-neutral-200 hover:bg-neutral-50"
    )}
  >
    <input type="radio" name="link-teacher" checked={checked} onChange={onSelect} className="size-4 accent-primary-700" />
    {avatar}
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate text-[15px] font-medium text-neutral-900">{title}</span>
      <span className="text-[13px] text-neutral-500">{detail}</span>
    </span>
    {tag && (
      <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-800">
        {tag}
      </span>
    )}
  </label>
);
