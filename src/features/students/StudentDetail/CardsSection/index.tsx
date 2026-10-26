import { useCallback, useEffect, useMemo, useState } from "react";
import {
  StudentCardWithCard,
  StudentWithDetail,
} from "@/store/slices/students";
import StudentCard from "./StudentCard";
import CardDetailDialog from "./CardDetailDialog";
import EndedCardsTable from "./EndedCardsTable";
import EmptyCards from "./EmptyCards";
import { isCardEnded } from "./cardStatus";
import EmptyState from "@/components/EmptyState";

const SectionHeading = ({ title, hint }: { title: string; hint: string }) => (
  <h3 className="m-0 text-[15px] font-bold text-neutral-900">
    {title}
    <span className="ml-1.5 text-[13px] font-medium text-neutral-600">{hint}</span>
  </h3>
);

/**
 * 課卡分頁：有效課卡的摘要卡網格、已結束的卡的表格、一份詳情對話框。
 * 網格依自己的寬度排欄（手機一欄、分割檢視兩欄、寬螢幕更多），不靠呼叫端傳欄數。
 */
const CardsSection = ({
  student,
  studentCards,
  isPublic,
}: {
  student: StudentWithDetail;
  studentCards: StudentCardWithCard[];
  isPublic?: boolean;
}) => {
  // 詳情對話框：記住選到的 id，從最新的 studentCards 找卡——mutation 後內容才會跟著更新。
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // 轉換鏈的跳轉目標：捲過去並短暫高亮。
  const [focusCardId, setFocusCardId] = useState<number | null>(null);

  const selectedCard = useMemo(
    () => studentCards.find((card) => card.id === selectedId) ?? null,
    [studentCards, selectedId]
  );

  const openCard = useCallback((card: StudentCardWithCard) => {
    setSelectedId(card.id);
    setDialogOpen(true);
  }, []);

  const jumpToCard = useCallback((studentCardId: number) => {
    setFocusCardId(studentCardId);
  }, []);

  useEffect(() => {
    if (focusCardId === null) return;
    document
      .getElementById(`student-card-${focusCardId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setFocusCardId(null), 1600);
    return () => clearTimeout(timer);
  }, [focusCardId]);

  const activeCards = useMemo(() => studentCards.filter((card) => !isCardEnded(card)), [studentCards]);
  const endedCards = useMemo(() => studentCards.filter((card) => isCardEnded(card)), [studentCards]);
  const remaining = activeCards.reduce((sum, card) => sum + card.remainingSessions, 0);

  if (studentCards.length === 0) {
    return (
      <div className="@container">
        <EmptyCards student={student} isPublic={isPublic} />
      </div>
    );
  }

  return (
    <div className="@container flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionHeading
          title="有效課卡"
          hint={activeCards.length === 0 ? "沒有" : `${activeCards.length} 張 · 剩 ${remaining} 堂`}
        />
        {activeCards.length > 0 ? (
          <div className="grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {activeCards.map((studentCard) => (
              <StudentCard
                key={studentCard.id}
                studentCard={studentCard}
                highlighted={focusCardId === studentCard.id}
                onOpen={openCard}
              />
            ))}
          </div>
        ) : (
          <EmptyState kind="inline" title={`課卡都用完了${isPublic ? "" : "，可以幫學生續卡"}`} />
        )}
      </section>

      {endedCards.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading title="已結束" hint={`${endedCards.length} 張`} />
          <EndedCardsTable studentCards={endedCards} highlightedId={focusCardId} onOpen={openCard} />
        </section>
      )}

      <CardDetailDialog
        studentCard={selectedCard}
        studentName={student.name}
        danceLevels={student.danceLevels}
        open={dialogOpen && selectedCard !== null}
        onClose={() => setDialogOpen(false)}
        isPublic={isPublic}
        onJumpToCard={isPublic ? undefined : jumpToCard}
      />
    </div>
  );
};

export default CardsSection;
