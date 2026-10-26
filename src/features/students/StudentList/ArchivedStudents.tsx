"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import ResponsiveDialog, {
  ResponsiveDialogTitle,
} from "@/components/ResponsiveDialog";
import {
  Student,
  useGetStudentsQuery,
  useSetStudentArchivedMutation,
} from "@/store/slices/students";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";

const ArchivedRow = ({ student }: { student: Student }) => {
  const [setArchived, { isLoading }] = useSetStudentArchivedMutation();

  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-b-0">
      <img
        src={student.avatarUrl}
        alt=""
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
      <Link
        href={`/students/${student.id}`}
        className="flex-1 min-w-0 flex items-center gap-2 hover:underline"
      >
        <span className="font-medium truncate">{student.name}</span>
        <span className="text-[11px] font-mono text-neutral-500 shrink-0">
          #{student.number}
        </span>
      </Link>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        isLoading={isLoading}
        onClick={async () => {
          try {
            await setArchived({ id: student.id, archived: false }).unwrap();
            toast.success(`已還原 ${student.name}`);
          } catch {
            toast.error("還原失敗，請稍後再試");
          }
        }}
      >
        還原
      </Button>
    </li>
  );
};

/**
 * 名單底部的「已封存 N 位」入口。封存的學生不出現在名單、點名和自助簽到，
 * 這裡是唯一找得回他們的地方。沒有人被封存時整塊不顯示。
 */
const ArchivedStudents = ({ className = "" }: { className?: string }) => {
  const [open, setOpen] = useState(false);
  const { data: archived = [] } = useGetStudentsQuery({ archived: true });

  // 開著的時候還原了最後一位，對話框要留著讓人看見清單空了，而不是瞬間消失
  if (archived.length === 0 && !open) return null;

  return (
    <>
      {archived.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`w-full flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-800 cursor-pointer ${className}`}
        >
          <Archive className="w-4 h-4" />
          已封存 {archived.length} 位
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      )}

      <ResponsiveDialog open={open} onClose={() => setOpen(false)}>
        <div className="relative flex items-center justify-center mb-4">
          <ResponsiveDialogTitle className="text-xl font-semibold">
            已封存的學生
          </ResponsiveDialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            className="absolute -right-2 -top-1.5 text-neutral-500"
            onClick={() => setOpen(false)}
            aria-label="關閉"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
        <p className="text-sm text-neutral-500 mb-2">
          還原後會回到名單，課卡和出席紀錄都還在。
        </p>
        {archived.length === 0 && (
          <EmptyState kind="inline" title="沒有封存的學生了" className="my-2" />
        )}
        <ul className="max-h-[60vh] overflow-y-auto">
          {archived.map((student) => (
            <ArchivedRow key={student.id} student={student} />
          ))}
        </ul>
      </ResponsiveDialog>
    </>
  );
};

export default ArchivedStudents;
