"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import Drawer from "@/components/Drawer";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useGetStudentsQuery } from "@/store/slices/students";
import {
  type EnrollmentRoster,
  useDeleteEnrollmentMutation,
  useRegisterEnrollmentMutation,
  useUpdateEnrollmentMutation,
} from "@/store/slices/lessons";
import { formatMoney } from "@/lib/money";
import { termPerSession } from "@/lib/termEnrollment";
import { Button } from "@/components/ui/button";
import { FieldError, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

type Who = { kind: "existing"; id: number; name: string } | { kind: "new"; name: string };
type Payment = "CASH" | "TRANSFER" | "UNPAID";

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "已收現金" },
  { value: "TRANSFER", label: "已收轉帳" },
  { value: "UNPAID", label: "還沒收" },
] as const;

const SUGGESTION_LIMIT = 5;

type Enrollment = EnrollmentRoster["enrollments"][number];

/**
 * 登記整期（`enrollment` 沒給）或改一筆報名的價錢／堂數（舊生半價）。
 * 價錢、堂數預設是開課時定的；沒有插班——第一堂上過才登記也一樣收整期。
 */
const EnrollmentDrawer = ({
  lessonId,
  termPrice,
  termSessions,
  enrolledStudentIds,
  firstPeriodTaken,
  enrollment,
  onClose,
}: {
  lessonId: number;
  termPrice: number;
  termSessions: number;
  enrolledStudentIds: number[];
  /** 第一堂已經點過名——登記時提醒一聲。 */
  firstPeriodTaken: boolean;
  enrollment?: Enrollment;
  onClose: () => void;
}) => {
  const editing = enrollment !== undefined;
  const { data: students = [] } = useGetStudentsQuery(undefined, { skip: editing });
  const [registerEnrollment, { isLoading: isRegistering }] = useRegisterEnrollmentMutation();
  const [updateEnrollment, { isLoading: isUpdating }] = useUpdateEnrollmentMutation();
  const [deleteEnrollment, { isLoading: isDeleting }] = useDeleteEnrollmentMutation();
  const [query, setQuery] = useState("");
  const [who, setWho] = useState<Who | null>(
    enrollment ? { kind: "existing", id: enrollment.student.id, name: enrollment.student.name } : null
  );
  const [price, setPrice] = useState(String(enrollment?.price ?? termPrice));
  const [note, setNote] = useState(enrollment?.note ?? "");
  const [payment, setPayment] = useState<Payment>("CASH");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const suggestions = useMemo(() => {
    if (!trimmed) return [];
    const needle = trimmed.toLowerCase();
    return students
      .filter((s) => !enrolledStudentIds.includes(s.id) && s.name.toLowerCase().includes(needle))
      .slice(0, SUGGESTION_LIMIT);
  }, [students, trimmed, enrolledStudentIds]);
  const exactMatch = suggestions.some((s) => s.name === trimmed);

  const priceValue = Number(price) || 0;
  // 報了就是整期：堂數一律 = 這一期的，只能個別改價。
  const perSession = termPerSession(priceValue, termSessions);
  const customised = priceValue !== termPrice;
  // 已收款後改價：每堂收入會跟著變，實收金額不會——提醒一下，動態會記一筆。
  const repricingPaid = editing && enrollment.isPaid && priceValue !== enrollment.price;

  const handleSubmit = async () => {
    if (!who) {
      setError("請選擇或輸入學員");
      return;
    }
    try {
      if (enrollment) {
        await updateEnrollment({
          enrollmentId: enrollment.id,
          price: priceValue,
          note: note.trim() || null,
        }).unwrap();
        toast.success("已更新");
      } else {
        await registerEnrollment({
          id: lessonId,
          ...(who.kind === "existing" ? { studentId: who.id } : { newStudentName: who.name }),
          price: priceValue,
          note: note.trim() || null,
          isPaid: priceValue === 0 || payment !== "UNPAID",
          paymentMethod: payment === "UNPAID" ? null : payment,
          paymentReference: payment === "TRANSFER" ? reference.trim() || null : null,
        }).unwrap();
        toast.success(`已登記 ${who.name} 整期`);
      }
      onClose();
    } catch (e) {
      const code = (e as { data?: { code?: string } })?.data?.code;
      toast.error(code === "ALREADY_ENROLLED" ? "這位已經報過這一期了" : editing ? "更新失敗" : "登記失敗");
    }
  };

  const handleDelete = async () => {
    if (!enrollment) return;
    try {
      await deleteEnrollment({ enrollmentId: enrollment.id }).unwrap();
      toast.success("已取消報名");
      onClose();
    } catch (e) {
      const code = (e as { data?: { code?: string } })?.data?.code;
      toast.error(code === "ENROLLMENT_IN_USE" ? "已經上過課了，不能取消（整期不退費）" : "取消失敗");
    }
  };

  const submitText = editing
    ? "儲存"
    : !who
      ? "登記"
      : priceValue === 0
        ? "登記（免費）"
        : payment === "UNPAID"
          ? `登記，待收 $${formatMoney(priceValue)}`
          : `登記，已收 $${formatMoney(priceValue)}`;

  return (
    <Drawer
      open
      title={editing ? "整期報名" : "登記整期"}
      subtitle={editing ? enrollment.student.name : undefined}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isRegistering || isUpdating}
      disabled={!who}
      submitText={submitText}
      secondaryText="取消"
    >
      <div className="flex flex-col gap-5 pb-4">
        {!editing && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-900">誰報整期</span>
            {who ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-primary-300 bg-primary-50 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold">{who.name}</span>
                  {who.kind === "new" && <span className="shrink-0 text-xs text-neutral-600">新學員，會一起建立</span>}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconSm"
                  aria-label="換一位"
                  onClick={() => setWho(null)}
                  className="text-neutral-600 hover:bg-white"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setError(null);
                  }}
                  placeholder="輸入姓名"
                  aria-label="學員姓名"
                  className={cn(fieldControlClass(!!error && !who), "h-12")}
                />
                {trimmed && (
                  <ul className="flex flex-col overflow-hidden rounded-xl border border-neutral-200">
                    {suggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setWho({ kind: "existing", id: s.id, name: s.name })}
                          className="flex w-full cursor-pointer items-center gap-2.5 border-b border-neutral-100 px-3 py-2.5 text-left hover:bg-neutral-50"
                        >
                          <img src={s.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                          <span className="font-medium">{s.name}</span>
                          <span className="ml-auto text-xs text-neutral-500">#{s.number}</span>
                        </button>
                      </li>
                    ))}
                    {!exactMatch && (
                      <li>
                        <button
                          type="button"
                          onClick={() => setWho({ kind: "new", name: trimmed })}
                          className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-primary-900 hover:bg-primary-50"
                        >
                          <UserPlus className="h-4 w-4" />
                          新增「{trimmed}」為新學員
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-900">收費</span>
            <span className="relative">
              <span className="absolute top-1/2 left-4 -translate-y-1/2 text-neutral-500">$</span>
              <input
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                aria-label="收費"
                className={cn(fieldControlClass(), "h-12 pl-8 tabular-nums")}
              />
            </span>
          </label>
        </div>
        <p className="-mt-3 text-[13px] text-neutral-600">
          整期 {termSessions} 堂，每堂 <span className="tabular-nums">${formatMoney(Math.round(perSession))}</span>
          {customised ? `（這一期原價 $${formatMoney(termPrice)}）` : "，請假曠課照算"}
        </p>
        {repricingPaid && (
          <p className="-mt-2 rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning-950">
            已收 ${formatMoney(enrollment.price)}。改價後這一期每堂收入跟著變（已點名的也會），實收金額不會變；學生動態會記一筆改價。
          </p>
        )}
        <FieldError>{error}</FieldError>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-900">備註（選填）</span>
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：舊生半價"
            className={cn(fieldControlClass(), "h-12")}
          />
        </label>

        {!editing && priceValue > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-900">收款</span>
            <SegmentedTabs ariaLabel="收款" options={PAYMENT_OPTIONS} value={payment} onChange={setPayment} fill />
            {payment === "TRANSFER" && (
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                inputMode="numeric"
                maxLength={20}
                placeholder="轉帳末五碼（選填）"
                aria-label="轉帳末五碼"
                className={cn(fieldControlClass(), "h-12 tracking-widest")}
              />
            )}
            {payment === "UNPAID" && (
              <p className="text-xs text-neutral-500">會出現在「待處理」的待確認收款，收到再確認。</p>
            )}
          </div>
        )}

        {!editing && firstPeriodTaken && (
          <p className="rounded-xl bg-warning-50 px-3 py-2.5 text-[13px] text-warning-950">
            第一堂已經上過了。沒有插班——登記一樣收整期，每一堂都照算。
          </p>
        )}

        {editing && (
          <Button
            type="button"
            variant="ghost"
            className="self-start text-danger-700 hover:bg-danger-50"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            取消這筆報名（登記錯了才用）
          </Button>
        )}
      </div>
    </Drawer>
  );
};

export default EnrollmentDrawer;
