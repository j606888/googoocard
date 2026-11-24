"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { FieldError, fieldControlClass } from "@/components/Field";
import { useBookPeriodMutation } from "@/store/slices/lessons";
import { cn } from "@/lib/utils";
import StudentPickField, { type Who, whoBody } from "./StudentPickField";

/** 點名頁「＋ 預計會來」：只登記這一堂（今天臨時有人說要來）。不勾選、不收錢。 */
const PeriodBookingDrawer = ({
  lessonId,
  periodId,
  excludeIds,
  open,
  onClose,
}: {
  lessonId: number;
  periodId: number;
  excludeIds: number[];
  open: boolean;
  onClose: () => void;
}) => {
  const [who, setWho] = useState<Who | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bookPeriod, { isLoading }] = useBookPeriodMutation();

  const close = () => {
    setWho(null);
    setNote("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!who) {
      setError("請選擇或輸入學員");
      return;
    }
    try {
      await bookPeriod({ id: lessonId, periodId, ...whoBody(who), note: note.trim() || null }).unwrap();
      toast.success(`已登記 ${who.name} 預計會來`);
      close();
    } catch {
      toast.error("登記失敗，請再試一次");
    }
  };

  return (
    <Drawer
      open={open}
      title="預計會來"
      subtitle="只登記這一堂"
      onClose={close}
      onSubmit={submit}
      isLoading={isLoading}
      disabled={!who}
      submitText="登記"
      secondaryText="取消"
    >
      <div className="flex flex-col gap-5 pb-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-900">誰會來</span>
          <StudentPickField
            who={who}
            onChange={(next) => {
              setWho(next);
              setError(null);
            }}
            excludeIds={excludeIds}
            invalid={!!error && !who}
          />
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-900">備註（選填）</span>
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：說會帶朋友"
            className={cn(fieldControlClass(), "h-12")}
          />
        </label>
        <FieldError>{error}</FieldError>
        <p className="text-[13px] text-neutral-600">會排在點名頁最上面、標「預計今天會到」，不會自動勾。</p>
      </div>
    </Drawer>
  );
};

export default PeriodBookingDrawer;
