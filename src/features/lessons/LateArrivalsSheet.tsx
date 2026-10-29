"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import StatusTag from "@/components/StatusTag";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";
import { filterByKeyword } from "@/hooks/attendanceFlow";
import { useGetStudentsQuery } from "@/store/slices/students";
import {
  useLazyGetAttendanceQuery,
  useUpdateAttendanceMutation,
  type AgendaPeriod,
  type LessonStudent,
} from "@/store/slices/lessons";
import { relativeDayLabel } from "./lessonSchedule";

const MAX_SEARCH_RESULTS = 5;

type Person = { id: number; name: string; avatarUrl: string; noCard: boolean };

/**
 * 補勾遲到的人：已經點過名、還在上課時，把晚到的學生加進這一堂。
 *
 * 走既有的「修改點名」(PUT attendance)：送出的 studentIds 是「現有紀錄 ＋ 新勾的」。
 * `reconcileAndFinalize` 對已有紀錄的人不動（不重複扣卡），只對新加的人扣卡。
 * 現有紀錄送出前重抓一次——開著抽屜時有學生自己用 LINE 簽到的話，漏送他會被當成「取消勾選」而退卡。
 */
const LateArrivalsSheet = ({
  open,
  onClose,
  period,
  roster,
}: {
  open: boolean;
  onClose: () => void;
  period: AgendaPeriod;
  /** 課程名冊（含「本課課卡」狀態）；還在載入時是 undefined。 */
  roster: LessonStudent[] | undefined;
}) => {
  const router = useRouter();
  const [ticked, setTicked] = useState<number[]>([]);
  const [extra, setExtra] = useState<Person[]>([]);
  const [keyword, setKeyword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: students } = useGetStudentsQuery(undefined, { skip: !open });
  const [fetchAttendance] = useLazyGetAttendanceQuery();
  const [updateAttendance] = useUpdateAttendanceMutation();

  const attendees = useMemo(() => new Set(period.attendeeIds), [period.attendeeIds]);

  const missing: Person[] = useMemo(
    () => [
      ...(roster ?? [])
        .filter((s) => !attendees.has(s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          avatarUrl: s.avatarUrl,
          noCard: s.cardStatus.level === "none",
        })),
      ...extra,
    ],
    [roster, attendees, extra]
  );

  const results = useMemo(() => {
    if (!keyword.trim()) return [];
    const shown = new Set([...missing.map((p) => p.id), ...attendees]);
    return filterByKeyword(students, keyword)
      .filter((s) => !s.archivedAt && !shown.has(s.id))
      .slice(0, MAX_SEARCH_RESULTS);
  }, [students, keyword, missing, attendees]);

  const toggle = (id: number) =>
    setTicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addOther = (student: { id: number; name: string; avatarUrl: string }) => {
    setExtra((prev) => [...prev, { ...student, noCard: false }]);
    setTicked((prev) => [...prev, student.id]);
    setKeyword("");
  };

  const close = () => {
    setTicked([]);
    setExtra([]);
    setKeyword("");
    onClose();
  };

  const target = { id: period.lesson.id, periodId: period.id };

  const submit = async () => {
    if (ticked.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const current = await fetchAttendance(target, false).unwrap();
      const studentIds = [...new Set([...current.map((r) => r.studentId), ...ticked])];
      await updateAttendance({ ...target, studentIds }).unwrap();
      // 新加的人沒有卡可扣（或要選卡）時，跟一般點名一樣到結果頁處理。
      const after = await fetchAttendance(target, false).unwrap();
      const unresolved = after.some((r) => ticked.includes(r.studentId) && !r.cardId);
      if (unresolved) {
        router.push(`/lessons/${period.lesson.id}/periods/${period.id}/check-success?justSubmitted=1`);
        return;
      }
      toast.success(`已加入 ${ticked.length} 人`);
      close();
    } catch {
      toast.error("加入失敗，請再試一次");
    } finally {
      setIsSubmitting(false);
    }
  };

  const start = new Date(period.startTime);
  const subtitle = [
    period.lesson.name,
    `${relativeDayLabel(start, new Date())} ${format(start, "HH:mm")}`,
    `已點 ${period.attendeeIds.length} 人`,
  ].join(" · ");

  return (
    <Drawer
      title="補勾遲到的人"
      subtitle={subtitle}
      open={open}
      onClose={close}
      onSubmit={submit}
      isLoading={isSubmitting}
      disabled={ticked.length === 0}
      submitText={ticked.length > 0 ? `加入 ${ticked.length} 人` : "加入"}
    >
      <div className="flex flex-col gap-2 pb-4">
        <p className="text-[13px] font-semibold tracking-wide text-neutral-500">
          還沒到 · {missing.length}
        </p>
        {missing.map((person) => {
          const on = ticked.includes(person.id);
          return (
            <label
              key={person.id}
              className={cn(
                "flex h-13.5 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3",
                on ? "border-primary-300 bg-primary-50" : "border-neutral-200 bg-white"
              )}
            >
              <Image
                src={person.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="shrink-0 rounded-full"
              />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-neutral-900">
                {person.name}
              </span>
              {person.noCard && <StatusTag tone="warning">沒卡</StatusTag>}
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(person.id)}
                aria-label={`${person.name} 到了`}
                className="size-5.5 shrink-0 cursor-pointer accent-primary-900"
              />
            </label>
          );
        })}

        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="不是這門課的？搜尋其他學生"
            aria-label="搜尋其他學生"
            className={cn(fieldControlClass(), "h-12 pl-10")}
          />
        </div>
        {results.length > 0 && (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {results.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => addOther(student)}
                  className="flex h-12 w-full cursor-pointer items-center gap-3 px-3 text-left hover:bg-neutral-50"
                >
                  <Image
                    src={student.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    className="shrink-0 rounded-full"
                  />
                  <span className="flex-1 truncate text-sm text-neutral-900">{student.name}</span>
                  <span className="text-[13px] font-semibold text-primary-700">加入</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {keyword.trim() && results.length === 0 && students && (
          <p className="px-1 text-[13px] text-neutral-500">找不到「{keyword.trim()}」</p>
        )}

        <p className="mt-1.5 text-xs text-neutral-500">
          學生自己用 LINE 簽到的，會直接算進已點名，不用再勾。
        </p>
      </div>
    </Drawer>
  );
};

export default LateArrivalsSheet;
