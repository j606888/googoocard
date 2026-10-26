"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import Drawer from "@/components/Drawer";
import SegmentedTabs from "@/components/SegmentedTabs";
import { useGetStudentsQuery } from "@/store/slices/students";
import { TrialRoster, useRegisterTrialMutation } from "@/store/slices/lessons";
import { defaultTrialPrice } from "@/lib/trialPrice";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { FieldError, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

type Who = { kind: "existing"; id: number; name: string; returning: boolean } | { kind: "new"; name: string };
type Payment = "CASH" | "TRANSFER" | "UNPAID";

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "已收現金" },
  { value: "TRANSFER", label: "已收轉帳" },
  { value: "UNPAID", label: "還沒收" },
] as const;

const SUGGESTION_LIMIT = 5;

/**
 * 登記一位體驗學員：選既有學生或直接打名字（Google 表單上的人多半還不在系統裡），
 * 收費依新舊生帶預設（舊生免費），可以當場改；收了錢就一起記下怎麼收的。
 */
const RegisterTrialDrawer = ({
  lessonId,
  trialCards,
  registeredStudentIds,
  onClose,
}: {
  lessonId: number;
  trialCards: TrialRoster["trialCards"];
  /** 已經登記、還沒上的人——不再列進候選。 */
  registeredStudentIds: number[];
  onClose: () => void;
}) => {
  const { data: students = [] } = useGetStudentsQuery();
  const [registerTrial, { isLoading }] = useRegisterTrialMutation();
  const [query, setQuery] = useState("");
  const [who, setWho] = useState<Who | null>(null);
  const [cardId, setCardId] = useState(trialCards[0]?.id ?? 0);
  const [price, setPrice] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment>("CASH");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const card = trialCards.find((c) => c.id === cardId) ?? trialCards[0];
  const trimmed = query.trim();
  const suggestions = useMemo(() => {
    if (!trimmed) return [];
    const needle = trimmed.toLowerCase();
    return students
      .filter((s) => !registeredStudentIds.includes(s.id) && s.name.toLowerCase().includes(needle))
      .slice(0, SUGGESTION_LIMIT);
  }, [students, trimmed, registeredStudentIds]);
  const exactMatch = suggestions.some((s) => s.name === trimmed);

  const returning = who?.kind === "existing" && who.returning;
  const defaultPrice = card ? defaultTrialPrice({ price: card.price, isTrial: true }, returning) : 0;
  const finalPrice = price === null ? defaultPrice : Number(price) || 0;

  const handleSubmit = async () => {
    if (!who) {
      setError("請選擇或輸入學員");
      return;
    }
    try {
      await registerTrial({
        id: lessonId,
        ...(who.kind === "existing" ? { studentId: who.id } : { newStudentName: who.name }),
        cardId: card.id,
        finalPrice,
        isPaid: finalPrice === 0 || payment !== "UNPAID",
        paymentMethod: payment === "UNPAID" ? null : payment,
        paymentReference: payment === "TRANSFER" ? reference.trim() || null : null,
      }).unwrap();
      toast.success(`已登記 ${who.name}`);
      onClose();
    } catch (e) {
      const code = (e as { data?: { error?: string } })?.data?.error;
      toast.error(code === "ALREADY_REGISTERED" ? "這位已經登記過了" : "登記失敗");
    }
  };

  return (
    <Drawer
      open
      title="登記體驗"
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      disabled={!who || !card}
      submitText={
        !who ? "登記" : finalPrice === 0 ? "登記（免費）" : payment === "UNPAID" ? `登記，待收 $${formatMoney(finalPrice)}` : `登記，已收 $${formatMoney(finalPrice)}`
      }
      secondaryText="取消"
    >
      <div className="flex flex-col gap-5 pb-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-900">誰來體驗</span>
          {who ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-primary-300 bg-primary-50 px-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-semibold truncate">{who.name}</span>
                <span className="shrink-0 text-xs text-neutral-600">
                  {who.kind === "new" ? "新學員，會一起建立" : who.returning ? "舊生" : "還沒買過正式課卡"}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label="換一位"
                onClick={() => {
                  setWho(null);
                  setPrice(null);
                }}
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
                placeholder="輸入姓名（Google 表單上的名字）"
                aria-label="學員姓名"
                className={cn(fieldControlClass(!!error), "h-12")}
              />
              {trimmed && (
                <ul className="flex flex-col rounded-xl border border-neutral-200 overflow-hidden">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setWho({ kind: "existing", id: s.id, name: s.name, returning: s.isNewStudent === false })}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-50 border-b border-neutral-100 cursor-pointer"
                      >
                        <img src={s.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
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
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-primary-900 hover:bg-primary-50 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        新增「{trimmed}」為新學員
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </>
          )}
          <FieldError>{error}</FieldError>
        </div>

        {trialCards.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-900">體驗卡</span>
            <SegmentedTabs
              ariaLabel="體驗卡"
              options={trialCards.map((c) => ({ value: String(c.id), label: c.name }))}
              value={String(cardId)}
              onChange={(value) => {
                setCardId(Number(value));
                setPrice(null);
              }}
              fill
            />
          </div>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-900">
            收費
            {returning && <span className="ml-2 text-xs font-normal text-neutral-500">舊生預設免費</span>}
          </span>
          <span className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
            <input
              inputMode="numeric"
              value={price ?? String(defaultPrice)}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
              className={cn(fieldControlClass(), "h-12 pl-8")}
            />
          </span>
        </label>

        {finalPrice > 0 && (
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
      </div>
    </Drawer>
  );
};

export default RegisterTrialDrawer;
