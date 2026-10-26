"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import Drawer from "@/components/Drawer";
import Field from "@/components/Field";
import { Button } from "@/components/ui/button";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatDate } from "@/lib/utils";
import {
  MergeSide,
  StudentWithDetail,
  useGetMergePreviewQuery,
  useGetStudentsQuery,
  useMergeStudentMutation,
} from "@/store/slices/students";

const SideCard = ({ side, label, keep }: { side: MergeSide; label: string; keep: boolean }) => (
  <div
    className={`flex flex-col gap-1.5 rounded-xl bg-white p-3 ${
      keep ? "border-2 border-primary-700" : "border border-neutral-200"
    }`}
  >
    <p className={`text-xs ${keep ? "font-medium text-primary-900" : "text-neutral-500"}`}>{label}</p>
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={side.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      <span className="truncate font-semibold">{side.name}</span>
    </div>
    <p className="text-xs leading-relaxed text-neutral-600">
      #{side.number} · {formatDate(side.createdAt)} 建立
      <br />
      {side.lineBound ? `已綁 LINE${side.lineDisplayName ? `「${side.lineDisplayName}」` : ""}` : "未綁 LINE"}
      <br />
      {side.cardCount} 張卡 · {side.attendanceCount} 次出席
    </p>
  </div>
);

/**
 * 合併學員（設計稿 C5）：這位學員（併掉、封存）的課卡、出席、動態、舞種資格搬到
 * 另一位（保留）。同一堂兩邊都點了名、或兩邊綁了不同 LINE，先列出來讓老師確認。
 */
const MergeStudentDialog = ({
  student,
  open,
  initialTargetId,
  onClose,
}: {
  student: StudentWithDetail;
  open: boolean;
  initialTargetId?: number | null;
  onClose: () => void;
}) => {
  const router = useRouter();
  const { data: students = [] } = useGetStudentsQuery(undefined, { skip: !open });
  const [targetId, setTargetId] = useState<number | null>(initialTargetId ?? null);
  const [query, setQuery] = useState("");
  const [keepLineFrom, setKeepLineFrom] = useState<"source" | "target">("source");
  const [merge, { isLoading }] = useMergeStudentMutation();

  useEffect(() => {
    if (open) setTargetId(initialTargetId ?? null);
  }, [open, initialTargetId]);

  const { data: preview, isFetching } = useGetMergePreviewQuery(
    { id: student.id, targetId: targetId ?? 0 },
    { skip: !open || !targetId }
  );

  // Same name first — that's almost always who this is.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const same = (n: string) => n.trim().toLowerCase() === student.name.trim().toLowerCase();
    return students
      .filter((s) => s.id !== student.id && (!q || s.name.toLowerCase().includes(q)))
      .sort((a, b) => Number(same(b.name)) - Number(same(a.name)))
      .slice(0, 8);
  }, [students, student, query]);

  const handleMerge = async () => {
    if (!targetId) return;
    try {
      await merge({
        id: student.id,
        targetId,
        keepLineFrom: preview?.lineConflict ? keepLineFrom : undefined,
      }).unwrap();
      toast.success(`已合併到 ${preview?.target.name ?? "該學員"}`);
      onClose();
      router.replace(`/students/${targetId}`);
    } catch {
      toast.error("合併失敗，請稍後再試");
    }
  };

  return (
    <Drawer
      open={open}
      title="合併學員"
      subtitle="同一個人有兩筆資料時，把它們併成一筆"
      onClose={onClose}
      onSubmit={handleMerge}
      isLoading={isLoading}
      disabled={!preview || isFetching}
      submitText="確認合併"
    >
      <div className="flex flex-col gap-4 pb-4">
        {!targetId || !preview ? (
          <div className="flex flex-col gap-2">
            <Field
              label={`「${student.name}」要併到哪一位？`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋名字"
            />
            <ul className="flex flex-col">
              {candidates.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setTargetId(s.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-neutral-50 cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="font-mono text-xs text-neutral-500">#{s.number}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <SideCard side={preview.source} label="併掉（封存）" keep={false} />
              <SideCard side={preview.target} label="保留" keep />
            </div>
            <Button type="button" variant="link" className="w-fit text-sm" onClick={() => setTargetId(null)}>
              換一位
            </Button>

            <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-3 text-sm">
              <p className="font-semibold">合併後</p>
              <p className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                課卡、出席、動態、舞種資格都搬到保留的 {preview.target.name}
              </p>
              {preview.source.lineBound && !preview.lineConflict && (
                <p className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
                  LINE 綁定移過去，之後掃碼就是這一筆
                </p>
              )}
            </div>

            {(preview.clashes.length > 0 || preview.lineConflict) && (
              <div className="flex flex-col gap-2 rounded-xl border border-warning-300 bg-warning-50 p-3 text-sm text-warning-950">
                <p className="font-semibold">需要你確認</p>
                {preview.clashes.map((c, i) => (
                  <p key={i} className="leading-relaxed">
                    {formatDate(c.startTime, "M/d")} {c.lessonName} 兩筆都點了名，保留
                    {c.keepFrom === "target" ? preview.target.name : preview.source.name}
                    那筆
                    {c.refundCardName
                      ? `，另一筆退回 1 堂到 ${c.refundCardName} ${
                          c.refundCardSerial !== null ? formatCardSerial(c.refundCardSerial) : ""
                        }`
                      : ""}
                    。
                  </p>
                ))}
                {preview.lineConflict && (
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="mb-1">兩筆綁了不同的 LINE，要留哪一個？</legend>
                    {(["source", "target"] as const).map((side) => (
                      <label key={side} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="keep-line"
                          checked={keepLineFrom === side}
                          onChange={() => setKeepLineFrom(side)}
                          className="h-4 w-4 accent-primary-700"
                        />
                        {side === "source" ? `${preview.source.name}（併掉這筆）的 LINE` : `${preview.target.name}（保留這筆）的 LINE`}
                        {preview[side].lineDisplayName && `「${preview[side].lineDisplayName}」`}
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
};

export default MergeStudentDialog;
