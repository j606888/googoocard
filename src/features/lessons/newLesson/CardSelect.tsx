import { useEffect, useState } from "react";
import { useGetCardsQuery } from "@/store/slices/cards";
import MultiSelect from "@/components/MultiSelect";
import { FieldLabel } from "@/components/Field";
import CardFormDrawer from "@/features/cards/CardForm/CardFormDrawer";
import { cardMatchesLesson } from "@/domains/qualification";
import { toast } from "sonner";

const NewCard = ({ selectedCardIds, onChange, danceStyleId, error }: { selectedCardIds: number[], onChange: (value: number[]) => void, danceStyleId: number | null, error?: string }) => {
  const { data: cards } = useGetCardsQuery();
  const [open, setOpen] = useState(false);

  // Candidate cards: all active cards, plus disabled cards that students still
  // hold unused (activeHolders > 0) so those cards can be attached to a lesson
  // and consumed at attendance — and any already-selected card so its chip keeps
  // its label when editing a lesson.
  const candidateCards = [
    ...(cards?.activeCards ?? []),
    ...(cards?.expiredCards ?? []).filter(
      (card) => card.activeHolders > 0 || selectedCardIds.includes(card.id)
    ),
  ];

  // Practice cards of another dance style can't be attached to this lesson.
  const matchingCards = candidateCards.filter((card) =>
    cardMatchesLesson(card, danceStyleId)
  );

  const cardOptions = matchingCards.map((card) => ({
    label: card.expiredAt ? `${card.name}（已停用）` : card.name,
    value: card.id,
  }));

  useEffect(() => {
    // No style yet (styles still loading, or none chosen): nothing to check
    // against, and pruning now would drop a cloned lesson's practice cards.
    if (!cards || danceStyleId === null) return;
    const validIds = selectedCardIds.filter((id) => {
      const card = candidateCards.find((c) => c.id === id);
      return !card || cardMatchesLesson(card, danceStyleId);
    });
    if (validIds.length !== selectedCardIds.length) {
      toast.info("已移除與舞種不符的複習卡");
      onChange(validIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [danceStyleId, cards, selectedCardIds]);

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>課卡</FieldLabel>
      <MultiSelect
        options={cardOptions}
        values={selectedCardIds}
        placeholder="選擇課卡"
        newOptionLabel="新增課卡"
        newOptionOnClick={() => {
          setOpen(true);
        }}
        onChange={(values) => {
          onChange(values as number[]);
        }}
        error={error}
      />
      {open && (
        <CardFormDrawer
          target={{ mode: "new", danceStyleId }}
          onClose={() => setOpen(false)}
          onSaved={(cardId) => onChange([...selectedCardIds, cardId])}
        />
      )}
    </div>
  );
};

export default NewCard;
