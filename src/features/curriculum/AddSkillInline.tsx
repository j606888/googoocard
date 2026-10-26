"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { fieldControlClass } from "@/components/Field";
import { SKILL_NAME_MAX } from "@/domains/curriculum/skillTree";
import { useCreateSkillMutation } from "@/store/slices/curriculum";

/** 等級欄底部的「＋ 新增技能」：點了變輸入框，Enter 加入、可以連續加。 */
export default function AddSkillInline({
  danceStyleId,
  categoryId,
  tierId,
}: {
  danceStyleId: number;
  categoryId: number;
  tierId: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [create] = useCreateSkillMutation();

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Cleared straight away (not disabled while saving) so the next name can be typed at once.
    setName("");
    try {
      await create({ danceStyleId, name: trimmed, categoryId, tierId }).unwrap();
    } catch (e) {
      setName(trimmed);
      const code = (e as { data?: { code?: string } })?.data?.code;
      toast.error(code === "SKILL_NAME_TAKEN" ? `已經有「${trimmed}」了` : "沒有加進去，請再試一次");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-neutral-300 text-sm font-medium text-neutral-500 hover:border-primary-300 hover:text-primary-700"
      >
        <Plus className="size-4" />
        新增技能
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={name}
        maxLength={SKILL_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="技能名稱，Enter 加入"
        aria-label="新技能名稱"
        className={`${fieldControlClass()} h-11 text-[15px]`}
      />
    </form>
  );
}
