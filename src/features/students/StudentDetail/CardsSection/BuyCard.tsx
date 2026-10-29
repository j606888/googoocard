import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { PaymentMethod, Student, StudentCardWithCard } from "@/store/slices/students";
import SegmentedTabs, { type SegmentedOption } from "@/components/SegmentedTabs";
import { useCreateStudentCardMutation } from "@/store/slices/students";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { canBuyCard } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Field, { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import EmptyState from "@/components/EmptyState";
import StatusTag from "@/components/StatusTag";

type BuyableStudent = Pick<Student, "id" | "name" | "danceLevels"> & {
  /** 有帶的話：卡種依上次買過排序、標題顯示目前剩幾堂。 */
  studentCards?: Pick<StudentCardWithCard, "cardId" | "createdAt" | "remainingSessions" | "expiredAt">[];
};

/** 付款：當場收現金、轉帳（可記末五碼），或還沒付（卡照樣能用，之後再確認收款）。 */
type Payment = PaymentMethod | "UNPAID";

const PAYMENT_OPTIONS: SegmentedOption<Payment>[] = [
  { value: "CASH", label: "現金" },
  { value: "TRANSFER", label: "轉帳" },
  { value: "UNPAID", label: "還沒付" },
];

const PAYMENT_LABEL: Record<Payment, string> = { CASH: "現金", TRANSFER: "轉帳", UNPAID: "還沒付" };

// 沒有課程脈絡：複習卡只看學生有沒有這張卡自己舞種的資格。
export const buyBlockedReason = (card: Card, student: Pick<Student, "danceLevels">): string | null => {
  const decision = canBuyCard(card, student.danceLevels ?? {});
  if (decision.allowed) return null;
  if (decision.reason === "NOT_QUALIFIED" && card.danceStyle) {
    return `未具備 ${card.danceStyle.name} 複習資格`;
  }
  return "複習卡未設定舞種，請先至課卡頁設定";
};

/**
 * 卡種不超過 `COLLAPSE_ABOVE` 種就全部列出；更多時只先列 `VISIBLE_CARD_COUNT` 種，
 * 其餘收在「顯示其他 N 種卡」——不會為了藏一兩張多一顆按鈕。
 */
const COLLAPSE_ABOVE = 6;
const VISIBLE_CARD_COUNT = 4;
const NOTE_MAX = 500;

/**
 * 卡種排序：這位學生買過的在前（越近買的越前面），其餘照課卡頁的順序；
 * 資格不符的複習卡一律放最後——看得到鎖定原因，但不擋在常用卡前面。
 */
const orderCards = (cards: Card[], student: BuyableStudent): Card[] => {
  const lastBought = new Map<number, number>();
  for (const sc of student.studentCards ?? []) {
    const at = new Date(sc.createdAt).getTime();
    if (at > (lastBought.get(sc.cardId) ?? 0)) lastBought.set(sc.cardId, at);
  }
  const rank = (card: Card) => (buyBlockedReason(card, student) ? 2 : lastBought.has(card.id) ? 0 : 1);
  return cards
    .map((card, index) => ({ card, index }))
    .sort(
      (a, b) =>
        rank(a.card) - rank(b.card) ||
        (lastBought.get(b.card.id) ?? 0) - (lastBought.get(a.card.id) ?? 0) ||
        a.index - b.index
    )
    .map(({ card }) => card);
};

/**
 * 購買課卡的表單（受控）：呼叫端決定何時開、可以預選一種卡
 * （空狀態的常用卡種快選）。`BuyCard` 是它加上一顆開啟按鈕。
 */
export const BuyCardDialog = ({
  student,
  open,
  onClose,
  initialCardId = null,
}: {
  student: BuyableStudent;
  open: boolean;
  onClose: () => void;
  initialCardId?: number | null;
}) => {
  const { data: cards } = useGetCardsQuery();
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [cardSessions, setCardSessions] = useState<string>("");
  const [cardPrice, setCardPrice] = useState<string>("");
  const [payment, setPayment] = useState<Payment>("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [errors, setErrors] = useState<{ selectedCardId?: string; cardSessions?: string }>({});
  const [createStudentCard, { isLoading }] = useCreateStudentCardMutation();
  const fieldId = useId();

  const cardOptions = useMemo(
    () => orderCards(cards?.activeCards ?? [], student),
    [cards, student]
  );
  const boughtCardIds = useMemo(
    () => new Set((student.studentCards ?? []).map((sc) => sc.cardId)),
    [student]
  );

  const selectCard = (card: Card) => {
    setSelectedCardId(card.id);
    setCardSessions(card.sessions.toString());
    setCardPrice(card.price.toString());
    setErrors((prev) => ({ ...prev, selectedCardId: undefined, cardSessions: undefined }));
  };

  // 每次打開都從乾淨的狀態開始：有預選就用預選，否則選排第一的（通常是上次買的）。
  // 不能買的（資格不符）不預選。
  useEffect(() => {
    if (!open) return;
    const initial = initialCardId
      ? cardOptions.find((card) => card.id === initialCardId)
      : cardOptions.find((card) => boughtCardIds.has(card.id));
    if (initial && !buyBlockedReason(initial, student)) {
      selectCard(initial);
    } else {
      setSelectedCardId(null);
      setCardSessions("");
      setCardPrice("");
    }
    setPayment("CASH");
    setReference("");
    setNote("");
    setShowAll(false);
    setErrors({});
    // 只在打開時重設；cardOptions 晚到時由下面的 effect 補選
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCardId]);

  // 打開當下卡種還沒載到：載到後補上預選
  useEffect(() => {
    if (!open || selectedCardId !== null || cardOptions.length === 0) return;
    const initial = initialCardId
      ? cardOptions.find((card) => card.id === initialCardId)
      : cardOptions.find((card) => boughtCardIds.has(card.id));
    if (initial && !buyBlockedReason(initial, student)) selectCard(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardOptions]);

  const handleSessionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || parseInt(value) > 0) {
      setCardSessions(value);
      setErrors((prev) => ({ ...prev, cardSessions: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!selectedCardId) {
      setErrors((prev) => ({ ...prev, selectedCardId: "請選擇卡種" }));
      return;
    }
    const sessions = parseInt(cardSessions);
    if (!Number.isInteger(sessions) || sessions < 1) {
      setErrors((prev) => ({ ...prev, cardSessions: "堂數至少 1 堂" }));
      return;
    }
    try {
      await createStudentCard({
        id: student.id,
        cardId: selectedCardId,
        sessions,
        price: parseInt(cardPrice) || 0,
        isPaid: payment !== "UNPAID",
        paymentMethod: payment === "UNPAID" ? null : payment,
        paymentReference: payment === "TRANSFER" ? reference.trim() || null : null,
        note: note.trim() || undefined,
      }).unwrap();
      toast.success(`已為 ${student.name} 購買課卡`);
      onClose();
    } catch (err) {
      const message = (err as { data?: { error?: string } })?.data?.error;
      toast.error(message ? `購買失敗：${message}` : "購買失敗，請稍後再試");
    }
  };

  const selectedIndex = cardOptions.findIndex((card) => card.id === selectedCardId);
  // 選到的卡就算排在後面也要看得到
  const visibleCount = Math.max(VISIBLE_CARD_COUNT, selectedIndex + 1);
  const visibleCards =
    showAll || cardOptions.length <= COLLAPSE_ABOVE ? cardOptions : cardOptions.slice(0, visibleCount);
  const hiddenCount = cardOptions.length - visibleCards.length;
  const price = parseInt(cardPrice) || 0;
  const sessions = parseInt(cardSessions) || 0;
  const remaining = student.studentCards
    ?.filter((sc) => !sc.expiredAt)
    .reduce((sum, sc) => sum + Math.max(0, sc.remainingSessions), 0);

  return (
    <Drawer
      title="購買課卡"
      subtitle={remaining === undefined ? student.name : `${student.name} · 目前剩 ${remaining} 堂`}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="確認購買"
      isLoading={isLoading}
      disabled={!selectedCardId}
      footerStart={
        selectedCardId && (
          <div className="leading-tight">
            <div className="text-lg font-bold text-neutral-900 tabular-nums">${formatMoney(price)}</div>
            <div className="text-xs text-neutral-500">
              {sessions} 堂 · {PAYMENT_LABEL[payment]}
            </div>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <fieldset>
          <legend className="w-full flex justify-between text-sm font-semibold mb-2">
            卡種
            {boughtCardIds.size > 0 && (
              <span className="font-normal text-xs text-neutral-500">上次買的在最前面</span>
            )}
          </legend>
          <div className="flex flex-col gap-2">
            {visibleCards.map((card) => {
              const blockedReason = buyBlockedReason(card, student);
              const selected = selectedCardId === card.id;
              return (
                <label
                  key={card.id}
                  className={`flex items-center gap-2.5 min-h-12 px-3 py-2.5 rounded-xl border ${
                    blockedReason
                      ? "bg-neutral-50 border-neutral-200 text-neutral-400 cursor-not-allowed"
                      : selected
                        ? "border-primary-700 ring-1 ring-primary-700 bg-primary-50 cursor-pointer"
                        : "border-neutral-300 cursor-pointer hover:border-primary-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="buy-card"
                    checked={selected}
                    disabled={!!blockedReason}
                    onChange={() => selectCard(card)}
                    className="w-[18px] h-[18px] accent-primary-700 shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 flex-wrap text-[15px] font-semibold">
                      {card.name}
                      {card.isPracticeCard && (
                        <StatusTag tone="warning">複習</StatusTag>
                      )}
                      {card.isPracticeCard && card.danceStyle && (
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${danceStyleMeta(card.danceStyle).badge}`}
                        >
                          {card.danceStyle.name}
                        </span>
                      )}
                    </span>
                    <span className={`block text-xs ${blockedReason ? "text-warning-950" : "text-neutral-500"}`}>
                      {blockedReason ??
                        [`${card.sessions} 堂`, boughtCardIds.has(card.id) ? "買過" : null]
                          .filter(Boolean)
                          .join(" · ")}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums shrink-0">${formatMoney(card.price)}</span>
                </label>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <Button
              type="button"
              variant="link"
              onClick={() => setShowAll(true)}
              className="mt-1.5 py-1.5 text-sm font-semibold"
            >
              顯示其他 {hiddenCount} 種卡
            </Button>
          )}
          {cardOptions.length === 0 && (
            <EmptyState kind="inline" title="還沒有啟用中的卡種" description="請先到「課卡」頁新增。" />
          )}
          {errors.selectedCardId && (
            <div className="mt-1">
              <FieldError>{errors.selectedCardId}</FieldError>
            </div>
          )}
        </fieldset>

        {selectedCardId && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor={`${fieldId}-sessions`}>堂數</FieldLabel>
                <input
                  id={`${fieldId}-sessions`}
                  type="number"
                  inputMode="numeric"
                  value={cardSessions}
                  onChange={handleSessionsChange}
                  aria-invalid={errors.cardSessions ? true : undefined}
                  aria-describedby={errors.cardSessions ? `${fieldId}-sessions-error` : undefined}
                  className={cn(fieldControlClass(!!errors.cardSessions), "h-12 tabular-nums")}
                />
                <FieldError id={`${fieldId}-sessions-error`}>{errors.cardSessions}</FieldError>
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor={`${fieldId}-price`}>金額</FieldLabel>
                <input
                  id={`${fieldId}-price`}
                  type="number"
                  inputMode="numeric"
                  value={cardPrice}
                  onChange={(e) => setCardPrice(e.target.value)}
                  className={cn(fieldControlClass(), "h-12 tabular-nums")}
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-neutral-900 mb-1.5">付款</div>
              <SegmentedTabs
                ariaLabel="付款方式"
                options={PAYMENT_OPTIONS}
                value={payment}
                onChange={setPayment}
                fill
              />
              {payment === "UNPAID" && <p className="mt-1.5 text-xs text-neutral-500">尚未付款，卡片照樣可以用</p>}
            </div>

            {payment === "TRANSFER" && (
              <Field
                label="轉帳末五碼"
                hint="（選填）"
                inputMode="numeric"
                maxLength={20}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            )}

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={`${fieldId}-note`} hint="（選填）">
                備註
              </FieldLabel>
              <textarea
                id={`${fieldId}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                rows={2}
                placeholder="例如：朋友介紹優惠、分兩次付款"
                className={cn(fieldControlClass(), "py-3")}
              />
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
};

const BuyCard = ({
  student,
  variant = "header",
}: {
  student: BuyableStudent;
  /**
   * "header" —— 桌面學生頁首的動作按鈕群。
   * "cta"    —— 手機課卡分頁底部固定的滿寬主按鈕。
   */
  variant?: "header" | "cta";
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size={variant === "header" ? "md" : "lg"}
        className={variant === "header" ? undefined : "w-full shadow-lg"}
        onClick={() => setIsDrawerOpen(true)}
      >
        ＋ 購買課卡
      </Button>
      <BuyCardDialog student={student} open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
};

export default BuyCard;
