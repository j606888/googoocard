import StudentAvatar from "@/components/StudentAvatar";
import RoundCheckbox from "@/components/RoundCheckbox";
import StatusTag from "@/components/StatusTag";
import type { PeriodTermInfo } from "@/store/slices/lessons";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** 上一堂誰請假——沒有補課機制，老師請他們提早來補進度。 */
export const PreviousLeavesBanner = ({ previous }: { previous: PeriodTermInfo["previousLeaves"] }) =>
  previous && previous.students.length > 0 ? (
    <div className="rounded-2xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-950">
      <p>
        <span className="font-bold">上一堂（{formatDate(previous.startTime, "M/d")}）請假：</span>
        {previous.students.map((s) => s.name).join("、")}
      </p>
      <p className="text-[13px]">可以請他們今天提早 10–15 分鐘來補進度。</p>
    </div>
  ) : null;

/**
 * 點名頁的「整期」區：報了整期的人標「預計會到」但**不預設勾選**（來了老師親手勾，不扣卡）；
 * 沒勾的人選「請假」或「曠課」（預設曠課，事先請假的帶入「請假」）。每列標整期付了沒，
 * 點名時就知道誰還欠整期的錢。收入不管來不來都照算，這裡只是讓老師知道誰要補進度。
 */
const TermAttendanceSection = ({
  term,
  selectedIds,
  leaveIds,
  selfCheckInStudentIds,
  keyword,
  onToggle,
  onLeaveChange,
}: {
  term: PeriodTermInfo;
  selectedIds: number[];
  leaveIds: Set<number>;
  selfCheckInStudentIds: number[];
  keyword: string;
  onToggle: (studentId: number) => void;
  onLeaveChange: (studentId: number, onLeave: boolean) => void;
}) => {
  const needle = keyword.trim().toLowerCase();
  const rows = needle
    ? term.enrolled.filter((e) => e.student.name.toLowerCase().includes(needle))
    : term.enrolled;
  if (rows.length === 0) return null;
  const selected = new Set(selectedIds);
  const sessions = term.termSessions ?? 0;
  const present = term.enrolled.filter((e) => selected.has(e.student.id)).length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-9 items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-700">
          整期報名
          <span className="font-medium text-neutral-500">
            {" "}
            · {present} / {term.enrolled.length} · 第 {term.periodIndex + 1} / {sessions} 堂
          </span>
        </h2>
      </div>
      {rows.map(({ student, isPaid, price, paidOtherwise }) => {
        const isChecked = selected.has(student.id);
        const onLeave = leaveIds.has(student.id);
        const subtitle = isChecked
          ? paidOtherwise
            ? "這堂改用課卡／單堂付"
            : "整期 · 不扣卡"
          : onLeave
            ? "已請假"
            : "預計今天會到 · 沒來選請假或曠課";
        return (
          <div
            key={student.id}
            className={cn(
              "flex min-h-[58px] items-center rounded-xl border-[1.5px] transition-colors",
              isChecked ? "border-primary-300 bg-primary-50" : "border-neutral-200 bg-white"
            )}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              aria-label={`${student.name} 出席（整期）`}
              onClick={() => onToggle(student.id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch rounded-xl px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300"
            >
              <StudentAvatar
                className="size-9 shrink-0 rounded-full object-cover"
                width={36}
                height={36}
                src={student.avatarUrl}
                alt=""
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold text-neutral-900">{student.name}</span>
                  {selfCheckInStudentIds.includes(student.id) && <StatusTag tone="outline">自助簽到</StatusTag>}
                  {isPaid ? (
                    <StatusTag tone="positive">整期已付</StatusTag>
                  ) : (
                    <StatusTag tone="warning">整期未付 ${formatMoney(price)}</StatusTag>
                  )}
                </span>
                <span className="block truncate text-xs text-neutral-600">{subtitle}</span>
              </span>
              {isChecked && <RoundCheckbox isChecked className="size-7 shrink-0" />}
            </button>
            {!isChecked && (
              <div className="flex shrink-0 items-center gap-2 pr-3">
                <div role="radiogroup" aria-label={`${student.name} 沒來的原因`} className="flex rounded-lg bg-neutral-100 p-0.5">
                  {[
                    { value: true, label: "請假", on: "bg-white text-warning-950 shadow-xs" },
                    { value: false, label: "曠課", on: "bg-white text-danger-700 shadow-xs" },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      role="radio"
                      aria-checked={onLeave === option.value}
                      onClick={() => onLeaveChange(student.id, option.value)}
                      className={cn(
                        "min-h-8 cursor-pointer rounded-md px-2.5 text-[13px] font-medium",
                        onLeave === option.value ? option.on : "text-neutral-500"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button type="button" tabIndex={-1} aria-hidden="true" className="cursor-pointer" onClick={() => onToggle(student.id)}>
                  <RoundCheckbox isChecked={false} className="size-7" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TermAttendanceSection;
