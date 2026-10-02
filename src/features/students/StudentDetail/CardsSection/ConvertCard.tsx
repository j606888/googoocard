import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, Minus, Plus } from "lucide-react";
import Drawer from "@/components/Drawer";
import ConfirmDialog from "@/components/ConfirmDialog";
import CardSerial from "@/components/CardSerial";
import {
  StudentCardWithCard,
  useConvertStudentCardMutation,
} from "@/store/slices/students";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { canBuyCard } from "@/domains/qualification";
import {
  listValueOf,
  residualValueOf,
  suggestConversion,
} from "@/domains/cardConversion";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatDate } from "@/lib/utils";
import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";
import { DanceType } from "@prisma/client";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const formatExact = (exact: number, isExact: boolean) =>
  isExact ? String(Math.round(exact)) : exact.toFixed(2);

/** 比較表的差異小標籤：多 → 綠、少 → 紅、持平 → 灰。 */
const DeltaChip = ({ delta, format }: { delta: number; format: (n: number) => string }) => {
  const tone =
    delta > 0
      ? "bg-primary-100 text-primary-900"
      : delta < 0
        ? "bg-danger-50 text-danger-700"
        : "bg-neutral-100 text-neutral-600";
  const label = delta > 0 ? `+${format(delta)}` : delta < 0 ? `−${format(-delta)}` : "±0";
  return <span className={`text-[11px] font-semibold px-1.5 py-px rounded-full ${tone}`}>{label}</span>;
};

// 課卡轉換 —— 把還沒用完的卡換成教室裡的另一種卡（含複習卡）。
// 舊卡的剩餘價值整筆帶到新卡，預設堂數依新卡牌價換算後四捨五入，老師可以改；
// 換算規則在 src/domains/cardConversion，與 API 的預設值共用。
// 舊卡會停用並標記「已轉換 → 新卡」，新卡標記「來自舊卡」，不產生新營收。
const ConvertCard = ({
  studentCard,
  danceQualifications,
  open,
  onClose,
}: {
  studentCard: StudentCardWithCard;
  danceQualifications: DanceType[];
  open: boolean;
  onClose: () => void;
}) => {
  const { data: cards } = useGetCardsQuery();
  const [convertStudentCard, { isLoading }] = useConvertStudentCardMutation();
  const [targetCardId, setTargetCardId] = useState<number | null>(null);
  // null = 用建議堂數；老師一動手就變成字串，直到按「還原建議」。
  const [sessionsOverride, setSessionsOverride] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sourceSerial = formatCardSerial(studentCard.serialNumber);
  const residualValue = residualValueOf(studentCard);

  // 只能轉成仍啟用的卡種，且不能轉成自己。
  const cardOptions = useMemo(
    () => (cards?.activeCards ?? []).filter((card) => card.id !== studentCard.cardId),
    [cards, studentCard.cardId]
  );

  useEffect(() => {
    if (open) {
      setTargetCardId(null);
      setSessionsOverride(null);
      setNote("");
      setError("");
      setConfirmOpen(false);
    }
  }, [open]);

  const blockedReason = (card: Card): string | null => {
    const decision = canBuyCard(card, danceQualifications ?? []);
    if (decision.allowed) return null;
    if (decision.reason === "NOT_QUALIFIED" && card.danceType) {
      return `未具備 ${danceTypeLabel(card.danceType)} 複習資格`;
    }
    return "複習卡未設定舞種，請先至課卡頁設定";
  };

  const suggestionFor = (card: Card) =>
    suggestConversion({ residualValue, targetPrice: card.price, targetSessions: card.sessions });

  const target = cardOptions.find((card) => card.id === targetCardId) ?? null;
  const suggestion = target ? suggestionFor(target) : null;
  const sessionsText = sessionsOverride ?? (suggestion ? String(suggestion.suggested) : "");
  const sessions = parseInt(sessionsText);
  const sessionsValid = Number.isInteger(sessions) && sessions >= 1;
  const isEdited = !!suggestion && sessionsValid && sessions !== suggestion.suggested;
  const targetListValue =
    target && sessionsValid ? listValueOf(sessions, target.price, target.sessions) : 0;
  // 比換算值的「無條件進位」還多才算加贈 —— 4.29 給 5 堂是取整誤差，不提醒。
  const isOverGiving =
    !!suggestion && sessionsValid && sessions > Math.ceil(suggestion.exact - 1e-9);
  const defaultNote = `由 ${sourceSerial}「${studentCard.card.name}」剩餘 ${studentCard.remainingSessions} 堂轉換而來。`;

  const setSessions = (value: number) => {
    if (value < 1) return;
    setSessionsOverride(String(value));
    setError("");
  };

  const handleSubmit = () => {
    if (!target) {
      setError("請選擇要轉換成哪一種卡");
      return;
    }
    if (!sessionsValid) {
      setError("轉換後堂數至少 1 堂");
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!target || !sessionsValid) return;
    try {
      await convertStudentCard({
        id: studentCard.studentId,
        studentCardId: studentCard.id,
        targetCardId: target.id,
        sessions,
        note: note.trim() || undefined,
      }).unwrap();
      toast.success("已完成轉換");
      setConfirmOpen(false);
      onClose();
    } catch {
      toast.error("轉換失敗");
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Drawer
        title="轉換卡片"
        open={open}
        onClose={onClose}
        onSubmit={handleSubmit}
        submitText="確認轉換"
        isLoading={isLoading}
      >
        <div className="flex flex-col gap-6 text-sm">
          {/* 要轉換的卡 */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-neutral-500">要轉換的卡</p>
            <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  <CardSerial serialNumber={studentCard.serialNumber} />
                  <span className="font-semibold text-neutral-900 truncate">
                    {studentCard.card.name}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  {studentCard.totalSessions} 堂 · {money(studentCard.finalPrice)} ·{" "}
                  {formatDate(studentCard.createdAt)} 購買
                </p>
              </div>
              <div className="text-right leading-none shrink-0">
                <div className="flex items-baseline gap-0.5 justify-end">
                  <span className="text-2xl font-bold text-primary-700">
                    {studentCard.remainingSessions}
                  </span>
                  <span className="text-sm text-neutral-500">/{studentCard.totalSessions}</span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">剩餘堂數</div>
              </div>
            </div>
            <p className="text-xs text-neutral-600">
              剩餘價值 <strong className="text-neutral-900">{money(residualValue)}</strong>
              ，會整筆帶到新卡。
            </p>
          </section>

          {/* 轉換成 */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-neutral-500">轉換成</p>
            {cardOptions.length === 0 && (
              <p className="text-neutral-500">教室裡沒有其他啟用中的卡種。</p>
            )}
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="轉換成">
              {cardOptions.map((card) => {
                const reason = blockedReason(card);
                const selected = targetCardId === card.id;
                const s = suggestionFor(card);
                return (
                  <button
                    key={card.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!!reason}
                    onClick={() => {
                      setTargetCardId(card.id);
                      setSessionsOverride(null);
                      setError("");
                    }}
                    className={`flex items-center gap-3 w-full rounded-xl border p-3 text-left transition-colors ${
                      reason
                        ? "border-neutral-200 bg-neutral-50 opacity-60 cursor-not-allowed"
                        : selected
                          ? "border-primary-500 bg-primary-50 cursor-pointer"
                          : "border-neutral-200 bg-white hover:border-primary-300 cursor-pointer"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                        selected ? "border-primary-700" : "border-neutral-300"
                      }`}
                    >
                      {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary-700" />}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-neutral-900">{card.name}</span>
                        {card.isPracticeCard && card.danceType && (
                          <span
                            className={`text-[11px] font-medium px-2 py-px rounded-full ${DANCE_TYPE_META[card.danceType].badge}`}
                          >
                            {danceTypeLabel(card.danceType)} 複習
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {card.sessions} 堂 · {money(card.price)}
                      </span>
                      {reason && <span className="text-xs text-danger-700">{reason}</span>}
                    </span>
                    {!reason && (
                      <span className="shrink-0 text-right leading-tight">
                        <span className="block text-[11px] text-neutral-500">約可換</span>
                        <span className="block font-semibold text-neutral-900">
                          {formatExact(s.exact, s.isExact)} 堂
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {target && suggestion && (
            <section className="flex flex-col gap-4">
              {/* 前後比較 */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-neutral-500">轉換前後比較</p>
                <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                  <div className="grid grid-cols-[72px_1fr_20px_1fr] items-center px-3.5 py-2 bg-neutral-50 border-b border-neutral-200 text-[11px] text-neutral-500">
                    <span />
                    <span>舊卡剩餘</span>
                    <span />
                    <span>新卡</span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr_20px_1fr] items-center px-3.5 py-3 border-b border-neutral-100">
                    <span className="text-xs text-neutral-500">堂數</span>
                    <span className="font-semibold">{studentCard.remainingSessions} 堂</span>
                    <span className="text-neutral-400" aria-hidden>→</span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-bold text-primary-700">
                        {sessionsValid ? `${sessions} 堂` : "—"}
                      </span>
                      {sessionsValid && (
                        <DeltaChip
                          delta={sessions - studentCard.remainingSessions}
                          format={(n) => String(n)}
                        />
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr_20px_1fr] items-center px-3.5 py-3">
                    <span className="text-xs text-neutral-500">卡片價值</span>
                    <span className="font-semibold">{money(residualValue)}</span>
                    <span className="text-neutral-400" aria-hidden>→</span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold">
                        {sessionsValid ? money(targetListValue) : "—"}
                      </span>
                      {sessionsValid && (
                        <DeltaChip delta={targetListValue - residualValue} format={money} />
                      )}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500">
                  新卡價值以 {target.name} 的牌價計；入帳仍沿用舊卡剩餘 {money(residualValue)}
                  ，不會重複計入營收。
                </p>
              </div>

              {/* 新卡堂數 */}
              <div className="flex flex-col gap-2">
                <label htmlFor="convert-sessions" className="text-xs font-medium text-neutral-700">
                  新卡堂數
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-xl border border-neutral-300 overflow-hidden">
                    <button
                      type="button"
                      aria-label="減少一堂"
                      disabled={!sessionsValid || sessions <= 1}
                      onClick={() => setSessions(sessions - 1)}
                      className="w-11 h-11 flex items-center justify-center bg-neutral-50 text-neutral-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      id="convert-sessions"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={sessionsText}
                      onChange={(e) => {
                        setSessionsOverride(e.target.value);
                        setError("");
                      }}
                      className="w-16 h-11 border-x border-neutral-200 text-center text-base font-semibold text-neutral-900 outline-none focus:bg-primary-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      aria-label="增加一堂"
                      onClick={() => setSessions(sessionsValid ? sessions + 1 : suggestion.suggested)}
                      className="w-11 h-11 flex items-center justify-center bg-neutral-50 text-neutral-700 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {isEdited && (
                    <button
                      type="button"
                      onClick={() => setSessionsOverride(null)}
                      className="py-2 text-xs text-primary-700 underline underline-offset-2 cursor-pointer"
                    >
                      還原建議 {suggestion.suggested} 堂
                    </button>
                  )}
                </div>

                {suggestion.isExact ? (
                  <div
                    role="status"
                    className="flex gap-2.5 rounded-xl border border-primary-300 bg-primary-50 px-3.5 py-3 text-xs leading-relaxed text-primary-900"
                  >
                    <CircleCheck className="w-4 h-4 shrink-0 mt-px" />
                    <span>
                      剩餘價值 {money(residualValue)} 依新卡價格（{money(target.price)} /{" "}
                      {target.sessions} 堂）換算為 {formatExact(suggestion.exact, true)} 堂，剛好整除。
                    </span>
                  </div>
                ) : (
                  <div
                    role="status"
                    className="flex gap-2.5 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-3 text-xs leading-relaxed text-warning-900"
                  >
                    <CircleAlert className="w-4 h-4 shrink-0 mt-px" />
                    <span>
                      <span className="block font-semibold">堂數無法整除，已取整數</span>
                      剩餘價值 {money(residualValue)} 依新卡價格（{money(target.price)} /{" "}
                      {target.sessions} 堂）換算為 {formatExact(suggestion.exact, false)}{" "}
                      堂，系統以四捨五入預設為 <strong>{suggestion.suggested} 堂</strong>
                      ，可以手動調整。
                    </span>
                  </div>
                )}

                {isOverGiving && (
                  <p role="status" className="text-xs leading-relaxed text-danger-700">
                    比建議多給 {sessions - suggestion.suggested} 堂；以牌價計，新卡比舊卡剩餘價值多{" "}
                    {money(targetListValue - residualValue)}。確定是補償或加碼再送出。
                  </p>
                )}
              </div>

              {/* 新卡備註 */}
              <div className="flex flex-col gap-2">
                <label htmlFor="convert-note" className="text-xs font-medium text-neutral-700">
                  新卡備註
                </label>
                <textarea
                  id="convert-note"
                  className="w-full p-2.5 rounded-xl bg-neutral-100 focus:outline-primary-500 text-sm"
                  rows={2}
                  maxLength={500}
                  value={note}
                  placeholder={defaultNote}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="text-[11px] text-neutral-500">留白就用上面的預設文字。</p>
              </div>
            </section>
          )}

          <div className="flex flex-col gap-1">
            {error && <p className="text-danger-700">{error}</p>}
            <p className="text-xs text-neutral-500 text-center">
              轉換後 {sourceSerial} 會停用，並標記「已轉換」
            </p>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        title="確認轉換？"
        message={
          target && sessionsValid
            ? `${sourceSerial}「${studentCard.card.name}」剩 ${studentCard.remainingSessions} 堂 → 「${target.name}」${sessions} 堂。舊卡會停用並標記已轉換，轉換後無法復原。`
            : ""
        }
        confirmLabel="確認轉換"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        isLoading={isLoading}
      />
    </>
  );
};

export default ConvertCard;
