import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field from "@/components/Field";
import { type AssignableRole } from "@/lib/roles";
import { useCreateInviteTokenMutation } from "@/store/slices/memberships";
import RolePicker from "./RolePicker";
import TeacherPicker, {
  teacherChoiceError,
  useResolveTeacherChoice,
  type TeacherChoice,
} from "./TeacherPicker";
import { teamErrorMessage } from "./teamErrors";

/** 管理員 creating an invite link: who they'll be, and for a teacher which teacher. */
export default function InviteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [role, setRole] = useState<AssignableRole>("teacher");
  const [teacher, setTeacher] = useState<TeacherChoice>({ kind: "none" });
  const [maxUses, setMaxUses] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [createInviteToken, { isLoading }] = useCreateInviteTokenMutation();
  const resolveTeacher = useResolveTeacherChoice();
  const [isResolving, setIsResolving] = useState(false);

  // An admin's teacher link is set later from 編輯成員, so only a teacher picks here.
  const teacherError = role === "teacher" ? teacherChoiceError(teacher, true) : undefined;

  const reset = () => {
    setRole("teacher");
    setTeacher({ kind: "none" });
    setMaxUses(1);
    setShowErrors(false);
  };

  const handleSubmit = async () => {
    if (teacherError) {
      setShowErrors(true);
      return;
    }
    setIsResolving(true);
    try {
      const teacherId = role === "teacher" ? await resolveTeacher(teacher) : null;
      await createInviteToken({ maxUses, role, teacherId }).unwrap();
      toast.success("已建立邀請連結");
      reset();
      onClose();
    } catch (e) {
      toast.error(teamErrorMessage(e, "建立失敗"));
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Drawer
      title="邀請成員"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="建立邀請連結"
      isLoading={isLoading || isResolving}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <RolePicker legend="他加入後是什麼角色？" value={role} onChange={setRole} />
        {role === "teacher" && (
          <TeacherPicker
            value={teacher}
            onChange={setTeacher}
            forUserId={null}
            error={showErrors ? teacherError : undefined}
          />
        )}
        {role === "teacher" ? (
          <p className="text-xs text-neutral-500">老師的邀請連結只能用一次，傳給他本人就好</p>
        ) : (
          <Field
            label="可使用次數"
            hint="有這個連結的人都能用它加入"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
          />
        )}
      </form>
    </Drawer>
  );
}
