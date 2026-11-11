import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field from "@/components/Field";
import { type AssignableRole } from "@/lib/roles";
import { useCreateInviteTokenMutation } from "@/store/slices/memberships";
import type { Teacher } from "@/store/slices/teachers";

type InvitedPerson = Pick<Teacher, "id" | "name" | "kind">;
import { inviteUrl } from "./InvitationCard";
import RolePicker from "./RolePicker";
import { teamErrorMessage } from "./teamErrors";

/** 名冊上的人要被邀請時，預設給什麼角色：照他的身分。 */
const roleFor = (person: InvitedPerson): AssignableRole =>
  person.kind === "NONE" ? "admin" : person.kind === "ASSISTANT" ? "assistant" : "teacher";

/**
 * 管理員建立邀請連結。
 * - 帶 `person`：邀請名冊上這一位（沒帳號的老師／小幫手），連結只能用一次，對方加入後帳號就連到這一筆。
 *   建好直接複製連結。
 * - 不帶：一般連結，可以用好幾次；加入的人會自動在名冊上多一筆（名字取帳號名字、身分照角色）。
 */
export default function InviteDrawer({
  open,
  person,
  onClose,
}: {
  open: boolean;
  person?: InvitedPerson | null;
  onClose: () => void;
}) {
  const [role, setRole] = useState<AssignableRole>(person ? roleFor(person) : "assistant");
  const [maxUses, setMaxUses] = useState(person ? 1 : 10);
  const [createInviteToken, { isLoading }] = useCreateInviteTokenMutation();

  const handleSubmit = async () => {
    try {
      const invite = await createInviteToken({
        maxUses: person ? 1 : maxUses,
        role,
        teacherId: person?.id ?? null,
      }).unwrap();
      try {
        await navigator.clipboard.writeText(inviteUrl(invite.token));
        toast.success(person ? `已複製給 ${person.name} 的邀請連結` : "已建立並複製邀請連結");
      } catch {
        toast.success("已建立邀請連結，在下方「邀請連結」複製");
      }
      onClose();
    } catch (e) {
      toast.error(teamErrorMessage(e, "建立失敗"));
    }
  };

  return (
    <Drawer
      title={person ? `邀請 ${person.name}` : "邀請成員"}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="建立並複製連結"
      isLoading={isLoading}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <RolePicker legend="他加入後是什麼角色？" value={role} onChange={setRole} />
        {person ? (
          <p className="text-xs leading-relaxed text-neutral-500">
            連結只能用一次，傳給 {person.name} 本人。他加入後帳號就連到老師 {person.name}，
            他教的、協助的課都會變成「我的課」。
          </p>
        ) : (
          <>
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
            <p className="text-xs leading-relaxed text-neutral-500">
              要邀請老師頁上已經有的老師，請從他的卡片按「邀請」，加入後就會自動連到那位老師。
              用這條連結加入的人，之後也可以在團隊頁「連到老師」。
            </p>
          </>
        )}
      </form>
    </Drawer>
  );
}
