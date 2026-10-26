import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { canLinkTeacher, isAdminRole, roleLabel, type AssignableRole } from "@/lib/roles";
import { isPermission, roleBundle, type Permission } from "@/lib/permissions";
import { Membership, useUpdateMembershipMutation } from "@/store/slices/memberships";
import RolePicker from "./RolePicker";
import PermissionPicker, { useVisiblePermissions } from "./PermissionPicker";
import TeacherPicker, {
  initialTeacherChoice,
  teacherChoiceError,
  useResolveTeacherChoice,
  type TeacherChoice,
} from "./TeacherPicker";
import { teamErrorMessage } from "./teamErrors";

/**
 * 管理員 changing a member's role, permissions and teacher link. The owner's
 * and your own role and permissions are shown but not editable (the API
 * refuses both) — the teacher link still is, so an admin who also teaches can
 * link themselves. Picking another role resets the permissions to that role's
 * defaults, as the API does.
 * Mount with `key={membership.id}` so the form resets per member.
 */
export default function EditMemberDrawer({
  membership,
  isMe,
  onClose,
}: {
  membership: Membership;
  isMe: boolean;
  onClose: () => void;
}) {
  const roleLocked = membership.role === "owner" || isMe;
  const [role, setRole] = useState<AssignableRole>(
    membership.role === "owner" ? "admin" : (membership.role as AssignableRole)
  );
  const visiblePermissions = useVisiblePermissions();
  const [permissions, setPermissions] = useState<Set<Permission>>(
    () => new Set(membership.permissions.filter(isPermission))
  );
  const changeRole = (next: AssignableRole) => {
    setRole(next);
    const bundle = roleBundle(next);
    setPermissions(new Set(visiblePermissions.filter((p) => bundle.has(p))));
  };
  const [teacher, setTeacher] = useState<TeacherChoice>(initialTeacherChoice(membership.teacher?.id));
  const [showErrors, setShowErrors] = useState(false);
  const [updateMembership, { isLoading }] = useUpdateMembershipMutation();
  const resolveTeacher = useResolveTeacherChoice();
  const [isResolving, setIsResolving] = useState(false);

  const linksTeacher = canLinkTeacher(role);
  const teacherError = linksTeacher ? teacherChoiceError(teacher, role === "teacher") : undefined;

  const handleSubmit = async () => {
    if (teacherError) {
      setShowErrors(true);
      return;
    }
    setIsResolving(true);
    try {
      const teacherId = linksTeacher ? await resolveTeacher(teacher) : null;
      await updateMembership({
        id: membership.id,
        ...(!roleLocked && { role, permissions: [...permissions] }),
        teacherId,
      }).unwrap();
      toast.success("已更新");
      onClose();
    } catch (e) {
      toast.error(teamErrorMessage(e, "更新失敗"));
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Drawer
      open
      title={`編輯 ${membership.user.name}`}
      subtitle={membership.user.email}
      submitText="儲存"
      isLoading={isLoading || isResolving}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {roleLocked ? (
          <div className="flex flex-col gap-1 rounded-xl bg-neutral-50 px-4 py-3">
            <span className="text-sm font-medium text-neutral-900">角色：{roleLabel(membership.role)}</span>
            <span className="text-[13px] text-neutral-500">
              {isMe ? "自己的角色要請另一位管理員改" : "建立者的角色要用「把教室交給他」來換"}
            </span>
          </div>
        ) : (
          <RolePicker legend="角色" value={role} onChange={changeRole} />
        )}
        <PermissionPicker
          role={roleLocked ? membership.role : role}
          value={permissions}
          onChange={setPermissions}
          locked={roleLocked}
        />
        {linksTeacher && (
          <TeacherPicker
            value={teacher}
            onChange={setTeacher}
            forUserId={membership.userId}
            optional={isAdminRole(role)}
            error={showErrors ? teacherError : undefined}
          />
        )}
      </form>
    </Drawer>
  );
}
