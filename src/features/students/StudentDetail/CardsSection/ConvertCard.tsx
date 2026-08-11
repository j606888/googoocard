import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import InputField from "@/components/InputField";
import RoundCheckbox from "@/components/RoundCheckbox";
import {
  StudentCardWithCard,
  useConvertStudentCardMutation,
} from "@/store/slices/students";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { canBuyCard } from "@/domains/qualification";
import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";
import { DanceType } from "@prisma/client";

// 課卡轉換 — 用於淘汰舊卡種（Level 1 升級成 Level 2、複習卡折抵成 Level 2）。
// 舊卡會被停用並自動寫上備註，新卡繼承舊卡的剩餘價值，不產生新營收。
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
  const [sessions, setSessions] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // 只能轉成仍啟用的卡種，且不能轉成自己。
  const cardOptions = useMemo(
    () => (cards?.activeCards ?? []).filter((card) => card.id !== studentCard.cardId),
    [cards, studentCard.cardId]
  );

  useEffect(() => {
    if (open) {
      setTargetCardId(null);
      setSessions(String(studentCard.remainingSessions));
      setNote("");
      setError("");
    }
  }, [open, studentCard.remainingSessions]);

  const blockedReason = (card: Card): string | null => {
    const decision = canBuyCard(card, danceQualifications ?? []);
    if (decision.allowed) return null;
    if (decision.reason === "NOT_QUALIFIED" && card.danceType) {
      return `未具備 ${danceTypeLabel(card.danceType)} 複習資格`;
    }
    return "複習卡未設定舞種，請先至課卡頁設定";
  };

  const handleSubmit = async () => {
    if (!targetCardId) {
      setError("請選擇要轉換成哪一種卡");
      return;
    }
    const parsed = parseInt(sessions);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError("轉換後堂數至少 1 堂");
      return;
    }
    try {
      await convertStudentCard({
        id: studentCard.studentId,
        studentCardId: studentCard.id,
        targetCardId,
        sessions: parsed,
        note: note.trim() || undefined,
      }).unwrap();
      toast.success("已完成轉換");
      onClose();
    } catch {
      toast.error("轉換失敗");
    }
  };

  return (
    <Drawer
      title="轉換卡片"
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="確認轉換"
      isLoading={isLoading}
    >
      <div className="mb-4 rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-sm">
        <p className="font-medium text-neutral-900">{studentCard.card.name}</p>
        <p className="text-xs text-neutral-500 mt-1">
          剩餘 {studentCard.remainingSessions} / {studentCard.totalSessions} 堂 · 轉換後這張卡會停用
        </p>
      </div>

      <div className="mb-4">
        <p className="font-medium mb-2">轉換成</p>
        <div className="flex flex-wrap gap-2">
          {cardOptions.map((card) => {
            const reason = blockedReason(card);
            return (
              <div
                key={card.id}
                className={`flex flex-col gap-1 px-4 py-3 border-1 border-neutral-200 rounded-sm ${
                  reason ? "opacity-50 cursor-not-allowed bg-neutral-50" : "cursor-pointer"
                } ${targetCardId === card.id ? "bg-primary-100 border-primary-500" : ""}`}
                onClick={() => {
                  if (reason) return;
                  setTargetCardId(card.id);
                  setError("");
                }}
              >
                <div className="flex gap-2 items-center">
                  <RoundCheckbox isChecked={targetCardId === card.id} />
                  <p>{card.name}</p>
                  {card.isPracticeCard && card.danceType && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${DANCE_TYPE_META[card.danceType].badge}`}
                    >
                      {danceTypeLabel(card.danceType)}
                    </span>
                  )}
                </div>
                {reason && <p className="text-xs text-danger-500">{reason}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <InputField
          label="轉換後堂數"
          value={sessions}
          onChange={(e) => {
            setSessions(e.target.value);
            setError("");
          }}
          type="number"
        />
        <p className="text-xs text-neutral-500 mt-1">
          等堂升級就維持 {studentCard.remainingSessions} 堂；複習卡折抵請改成折算後的堂數。
        </p>
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium">新卡備註</label>
        <textarea
          className="w-full p-2 rounded bg-neutral-100 focus:outline-primary-500 text-sm"
          rows={2}
          value={note}
          placeholder={`由「${studentCard.card.name}」剩餘 ${studentCard.remainingSessions} 堂轉換而來。`}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-xs text-neutral-500 mt-1">留白就用上面的預設文字。</p>
      </div>

      {error && <p className="text-danger-500 text-sm">{error}</p>}
    </Drawer>
  );
};

export default ConvertCard;
