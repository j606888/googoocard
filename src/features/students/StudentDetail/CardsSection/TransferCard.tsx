import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, Check, Minus, Plus, Search } from "lucide-react";
import Drawer from "@/components/Drawer";
import EmptyState from "@/components/EmptyState";
import { FieldLabel, fieldControlClass } from "@/components/Field";
import {
  StudentCardWithCard,
  useGetStudentsQuery,
  useTransferStudentCardMutation,
} from "@/store/slices/students";
import { canBuyCard } from "@/domains/qualification";
import { formatCardSerial } from "@/lib/cardSerial";
import { cn } from "@/lib/utils";
import SessionDots from "./SessionDots";
import { shortDate } from "./cardStatus";

/** 沒打字時列出最近有來上課的這麼多人；有打字時最多列這麼多筆結果。 */
const SUGGESTIONS = 5;
const RESULTS = 20;

const ERROR_MESSAGES: Record<string, string> = {
  CARD_UNPAID: "這張卡還沒收款，先確認收款才能轉讓",
  CARD_TRIAL: "體驗課卡不能轉讓",
  CARD_EXPIRED: "這張卡已經結束了",
  STUDENT_NOT_QUALIFIED: "對方沒有這個舞種的資格，不能用複習卡",
  STUDENT_ARCHIVED: "對方已封存",
};

// 課卡轉讓 —— 剩餘堂數整批給同教室的另一位學生（2026-10-26 定案，不能只轉一部分）。
// 對方拿到同卡種的新卡；這張卡結束並標「已轉讓 N 堂 → 對方」。不產生新營收。
// 規則在 POST .../transfer，這裡只是把擋得住的先在名單上擋掉（複習卡資格）。
const TransferCard = ({
  studentCard,
  studentName,
  open,
  onClose,
}: {
  studentCard: StudentCardWithCard;
  studentName: string;
  open: boolean;
  onClose: () => void;
}) => {
  const { data: students, isLoading: isLoadingStudents } = useGetStudentsQuery(undefined, { skip: !open });
  const [transferStudentCard, { isLoading }] = useTransferStudentCardMutation();
  const [query, setQuery] = useState("");
  const [toStudentId, setToStudentId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      setToStudentId(null);
      setNote("");
    }
  }, [open]);

  const sessions = studentCard.remainingSessions;
  const serial = formatCardSerial(studentCard.serialNumber);

  const candidates = useMemo(() => {
    const others = (students ?? []).filter(
      (student) => student.id !== studentCard.studentId && !student.archivedAt
    );
    const keyword = query.trim().toLowerCase();
    const list = keyword
      ? others.filter((student) => student.name.toLowerCase().includes(keyword)).slice(0, RESULTS)
      : [...others]
          .sort((a, b) => (b.lastAttendAt ?? "").localeCompare(a.lastAttendAt ?? ""))
          .slice(0, SUGGESTIONS);
    return list.map((student) => ({
      student,
      allowed: canBuyCard(studentCard.card, student.danceLevels ?? {}).allowed,
    }));
  }, [students, studentCard, query]);

  const recipient = (students ?? []).find((student) => student.id === toStudentId) ?? null;
  const styleName = studentCard.card.danceStyle?.name ?? "這個舞種";

  const handleSubmit = async () => {
    if (!recipient) return;
    try {
      await transferStudentCard({
        id: studentCard.studentId,
        studentCardId: studentCard.id,
        toStudentId: recipient.id,
        note: note.trim() || undefined,
      }).unwrap();
      toast.success(`已把 ${sessions} 堂轉給 ${recipient.name}`);
      onClose();
    } catch (error) {
      const code = (error as { data?: { code?: string } })?.data?.code;
      toast.error((code && ERROR_MESSAGES[code]) ?? "轉讓失敗");
    }
  };

  return (
    <Drawer
      title="轉讓課卡"
      subtitle="剩下的堂數整批給另一位學生"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={recipient ? `轉讓 ${sessions} 堂給 ${recipient.name}` : "選一位學生"}
      disabled={!recipient}
      isLoading={isLoading}
      secondaryText="取消"
      onSecondary={onClose}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 border border-neutral-200 rounded-2xl px-4 py-3.5">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[13px] text-neutral-500">{studentName} 的</span>
              <span className="text-[15px] font-bold text-neutral-900 truncate">
                {studentCard.card.name}{" "}
                <span className="text-[13px] font-semibold text-neutral-500 tabular-nums">{serial}</span>
              </span>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-[15px] font-bold text-neutral-900">剩 {sessions} 堂</span>
              <SessionDots total={studentCard.totalSessions} remaining={sessions} size="sm" />
            </div>
          </div>
          <div aria-hidden className="h-9 flex items-center justify-center text-primary-700">
            <ArrowDown className="size-5" />
          </div>

          <div className="flex flex-col gap-2.5">
            <FieldLabel htmlFor="transfer-search">給誰</FieldLabel>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-[18px] text-neutral-500" aria-hidden />
              <input
                id="transfer-search"
                type="search"
                autoComplete="off"
                placeholder="搜尋學生姓名"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={cn(fieldControlClass(), "h-12 pl-10")}
              />
            </div>
            {isLoadingStudents ? null : candidates.length === 0 ? (
              <EmptyState kind="inline" title={query ? `沒有符合「${query}」的學生` : "教室裡沒有其他學生"} />
            ) : (
              <div role="radiogroup" aria-label="接收的學生" className="flex flex-col gap-2">
                {candidates.map(({ student, allowed }) => {
                  const selected = student.id === toStudentId;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!allowed}
                      onClick={() => setToStudentId(student.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors",
                        selected
                          ? "border-[1.5px] border-primary-700 bg-primary-50"
                          : allowed
                            ? "border border-neutral-200 bg-white hover:border-primary-300 cursor-pointer"
                            : "border border-dashed border-neutral-300 bg-neutral-50 cursor-not-allowed"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={student.avatarUrl} alt="" className="size-10 rounded-full object-cover shrink-0" />
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className={cn("text-[15px] font-semibold truncate", allowed ? "text-neutral-900" : "text-neutral-600")}>
                          {student.name}
                        </span>
                        <span className={cn("text-[13px]", allowed ? "text-neutral-500" : "text-danger-700")}>
                          {!allowed
                            ? `還沒有 ${styleName} 資格，不能用複習卡`
                            : student.lastAttendAt
                              ? `上次上課 ${shortDate(student.lastAttendAt)}`
                              : "還沒上過課"}
                        </span>
                      </span>
                      {allowed && (
                        <span
                          aria-hidden
                          className={cn(
                            "size-[22px] rounded-full flex items-center justify-center shrink-0",
                            selected ? "bg-primary-900 text-white" : "border-[1.5px] border-neutral-300"
                          )}
                        >
                          {selected && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {recipient && (
          <div className="bg-neutral-50 rounded-2xl p-4 flex flex-col gap-3 text-sm text-neutral-900">
            <span className="text-[13px] font-semibold text-neutral-700">轉讓之後</span>
            <div className="flex gap-2.5 items-start">
              <span aria-hidden className="size-[22px] rounded-full bg-primary-100 text-primary-900 flex items-center justify-center shrink-0">
                <Plus className="size-3.5" strokeWidth={2.6} />
              </span>
              <span>
                <strong>{recipient.name}</strong> 拿到一張新的「{studentCard.card.name}」，{sessions} 堂
              </span>
            </div>
            <div className="flex gap-2.5 items-start">
              <span aria-hidden className="size-[22px] rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center shrink-0">
                <Minus className="size-3.5" strokeWidth={2.6} />
              </span>
              <span>
                <strong>{studentName}</strong> 的 {serial} 結束，標記「已轉讓 {sessions} 堂 → {recipient.name}」
              </span>
            </div>
            <span className="text-xs text-neutral-500">新卡不算新營收；付款紀錄留在原卡。</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="transfer-note" hint="（選填）">原因</FieldLabel>
          <input
            id="transfer-note"
            type="text"
            maxLength={500}
            placeholder="例：搬家，轉給同學"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={cn(fieldControlClass(), "h-12")}
          />
        </div>
      </div>
    </Drawer>
  );
};

export default TransferCard;
