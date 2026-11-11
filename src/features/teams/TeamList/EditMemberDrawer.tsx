import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { type AssignableRole } from "@/lib/roles";
import { Membership, useUpdateMembershipMutation } from "@/store/slices/memberships";
import RolePicker from "./RolePicker";
import { teamErrorMessage } from "./teamErrors";

/**
 * 管理員改成員的角色（權限）。建立者與自己的角色不能改（API 也會擋），選單上就不會出現。
 * 連到哪位老師另外用 `LinkTeacherDrawer`。Mount with `key={membership.id}`.
 */
export default function EditMemberDrawer({
  membership,
  onClose,
}: {
  membership: Membership;
  onClose: () => void;
}) {
  const [role, setRole] = useState<AssignableRole>(membership.role as AssignableRole);
  const [updateMembership, { isLoading }] = useUpdateMembershipMutation();

  const handleSubmit = async () => {
    try {
      await updateMembership({ id: membership.id, role }).unwrap();
      toast.success("已更新角色");
      onClose();
    } catch (e) {
      toast.error(teamErrorMessage(e, "更新失敗"));
    }
  };

  return (
    <Drawer
      open
      title={`${membership.user.name} 的角色`}
      subtitle={membership.user.email}
      submitText="儲存"
      isLoading={isLoading}
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
        <RolePicker legend="角色" value={role} onChange={setRole} />
      </form>
    </Drawer>
  );
}
