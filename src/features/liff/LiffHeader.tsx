"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option = { id: number; title: string; subtitle?: string; avatarUrl?: string };

/**
 * LIFF 頁首：深綠底＋頁名，下面一顆膠囊寫「教室 · 學生」。能切換時膠囊帶 ▾，
 * 點開是底部面板：綁定的學生（通常一間教室一位）或沒綁定時可選的公開教室。
 * 只有一個選項時就是純文字，不能點。
 */
export default function LiffHeader({
  title,
  label,
  options = [],
  selectedId,
  onPick,
  sheetTitle = "切換教室",
  sheetNote,
}: {
  title: string;
  /** 「HustleHustle · 王小明」 */
  label?: string;
  options?: Option[];
  selectedId?: number;
  onPick?: (id: number) => void;
  sheetTitle?: string;
  sheetNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const switchable = options.length > 1 && !!onPick;

  return (
    <div className="flex flex-col gap-2.5 bg-primary-900 px-4 pb-4 pt-3.5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {label &&
        (switchable ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-8 max-w-full items-center gap-1.5 self-start rounded-full bg-white/15 px-3 text-[13px] font-medium text-white active:bg-white/25"
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
          </button>
        ) : (
          <span className="flex h-8 max-w-full items-center self-start truncate rounded-full bg-white/15 px-3 text-[13px] font-medium text-white">
            {label}
          </span>
        ))}

      <ResponsiveDialog open={open} onClose={() => setOpen(false)}>
        <div className="mb-4 flex items-center justify-between">
          <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">{sheetTitle}</ResponsiveDialogTitle>
          <Button variant="ghost" size="iconSm" onClick={() => setOpen(false)} aria-label="關閉" className="text-neutral-500">
            <X className="size-5" />
          </Button>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pb-2">
          {options.map((opt) => {
            const selected = opt.id === selectedId;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (!selected) onPick?.(opt.id);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left",
                  selected ? "border-primary-700 bg-primary-50" : "border-neutral-200 active:bg-neutral-50"
                )}
              >
                {opt.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={opt.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-neutral-900">{opt.title}</span>
                  {opt.subtitle && <span className="truncate text-xs text-neutral-500">{opt.subtitle}</span>}
                </span>
                {selected && <Check className="size-5 shrink-0 text-primary-900" aria-label="目前選取" />}
              </button>
            );
          })}
        </div>
        {sheetNote && <p className="mt-2 text-xs leading-relaxed text-neutral-500">{sheetNote}</p>}
      </ResponsiveDialog>
    </div>
  );
}

/** The header for a bound student's page: classroom · name, switchable between bound students. */
export function StudentLiffHeader({
  title,
  student,
  boundStudents,
  pickStudent,
}: {
  title: string;
  student: { id: number; name: string; classroom: { name: string } };
  boundStudents: { id: number; name: string; avatarUrl: string; classroom: { name: string } }[];
  pickStudent: (id: number) => void;
}) {
  return (
    <LiffHeader
      title={title}
      label={`${student.classroom.name} · ${student.name}`}
      options={boundStudents.map((s) => ({ id: s.id, title: s.classroom.name, subtitle: s.name, avatarUrl: s.avatarUrl }))}
      selectedId={student.id}
      onPick={pickStudent}
      sheetNote="切換後，聊天室的「我的課卡」也會顯示這間教室。要在別間教室綁定，請那邊的老師給你綁定連結。"
    />
  );
}
