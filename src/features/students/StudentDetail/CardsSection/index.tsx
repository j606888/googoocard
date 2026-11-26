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
import { Band } from "../ProfilePanels";

const SectionHeading = ({ title, hint }: { title: string; hint: string }) => (
  <div className="flex items-baseline justify-between gap-3">
    <h3 className="m-0 text-[17px] font-semibold text-ink">{title}</h3>
    <span className="text-[13px] tabular-nums text-ink-3">{hint}</span>
  </div>
);

/**
 * 課卡分頁：有效課卡一張一列（整列寬、細線分隔）、已結束的卡的精簡清單、一份詳情對話框。
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
    <div className="@container flex flex-col">
      <section className="flex flex-col gap-1">
        <SectionHeading
          title="有效課卡"
          hint={activeCards.length === 0 ? "沒有" : `${activeCards.length} 張 · 共剩 ${remaining} 堂`}
        />
        {activeCards.length > 0 ? (
          <ul className="m-0 p-0 list-none divide-y divide-line border-b border-line">
            {activeCards.map((studentCard) => (
              <li key={studentCard.id}>
                <StudentCard
                  studentCard={studentCard}
                  highlighted={focusCardId === studentCard.id}
                  onOpen={openCard}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState kind="inline" title="沒有有效課卡" />
        )}
      </section>

      {endedCards.length > 0 && (
        <>
          <Band />
          <section className="flex flex-col gap-1 lg:mt-9">
            <SectionHeading title="已結束" hint={`${endedCards.length} 張`} />
            <EndedCardsTable studentCards={endedCards} highlightedId={focusCardId} onOpen={openCard} />
          </section>
        </>
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
