"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import Field from "@/components/Field";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useOverrideLessonMutation, type LessonSplitRow } from "@/store/slices/finance";
import { MoneyInput } from "../ui";
import { errorText, money, parseMoneyInput } from "../format";

/**
 * 手動改這堂的老師實拿（例如課程忘了掛一位老師）。場地費、助教費照算；
 * 改完的差額由水庫基金吸收。要寫原因，大家看得到。
 */
export default function OverrideDialog({ row, onClose }: { row: LessonSplitRow; onClose: () => void }) {
  const { data: teachers } = useGetTeachersQuery();
  const [save, { isLoading }] = useOverrideLessonMutation();
  const start = row.status === "VERIFIED" && row.verified
    ? row.verified.lines.filter((l) => l.kind === "TEACHER").map((l) => ({ teacherId: l.teacherId!, amount: l.amount }))
    : row.split!.teacherLines;
  const [lines, setLines] = useState(start.map((l) => ({ teacherId: l.teacherId, amount: String(l.amount) })));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();

  const split = row.split!;
  const pool = split.revenue - split.venueFee - split.assistantFee - split.commission;
  const total = lines.reduce((sum, l) => sum + (parseMoneyInput(l.amount) ?? 0), 0);
  const nameOf = (id: number) => teachers?.find((t) => t.id === id)?.name ?? "？";
  const addable = (teachers ?? [])
    .filter((t) => !t.archivedAt && !lines.some((l) => l.teacherId === t.id))
    .map((t) => ({ value: t.id, label: t.name }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError("要寫原因");
    try {
      await save({
        periodId: row.periodId,
        teacherLines: lines.map((l) => ({ teacherId: l.teacherId, amount: parseMoneyInput(l.amount) ?? 0 })),
        reason: reason.trim(),
      }).unwrap();
      toast.success("改好並驗收了");
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <ResponsiveDialog open onClose={onClose} className="min-h-0 gap-4 p-5">
      <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">改實拿 · {row.lessonName}</ResponsiveDialogTitle>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <div key={line.teacherId} className="flex items-center gap-3">
              <span className="w-20 text-sm font-medium text-neutral-900">{nameOf(line.teacherId)}</span>
              <div className="w-36">
                <MoneyInput value={line.amount} onChange={(v) => setLines(lines.map((l, j) => (j === i ? { ...l, amount: v } : l)))} />
              </div>
              <Button type="button" variant="ghost" size="iconSm" aria-label={`拿掉${nameOf(line.teacherId)}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
          {addable.length > 0 && (
            <Select<number> size="sm" options={addable} placeholder="＋ 加一位老師" onChange={(id) => setLines([...lines, { teacherId: id, amount: "" }])} aria-label="加一位老師" />
          )}
          <p className="text-[13px] tabular-nums text-neutral-500">
            合計 {money(total)}，照規則可分 {money(Math.max(0, pool))}
          </p>
        </div>
        <Field label="為什麼改" maxLength={200} value={reason} error={error} onChange={(e) => { setReason(e.target.value); setError(undefined); }} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          <Button type="submit" isLoading={isLoading}>改好並驗收</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
