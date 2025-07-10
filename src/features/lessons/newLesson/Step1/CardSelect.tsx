import { useState } from "react";
import Drawer from "@/components/Drawer";
import { useCreateCardMutation, useGetCardsQuery } from "@/store/slices/cards";
import InputField from "@/components/InputField";
import MultiSelect from "@/components/MultiSelect";
import { cardValidationForm } from "@/features/cards/CardList/NewCard";

const NewCard = ({ selectedCardIds, onChange, error }: { selectedCardIds: number[], onChange: (value: number[]) => void, error?: string }) => {
  const { data: cards } = useGetCardsQuery();
  const [open, setOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [price, setPrice] = useState("");
  const [sessions, setSessions] = useState("");
  const [errors, setErrors] = useState<{ cardName?: string; price?: string; sessions?: string }>({});

  const [createCard, { isLoading }] = useCreateCardMutation();

  const handleSubmit = async () => {
    const errors = cardValidationForm({ cardName, price, sessions });
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }
    const card = await createCard({ name: cardName, price: Number(price), sessions: Number(sessions) });
    if (card.data) {
      onChange([...selectedCardIds, card.data.id]);
    }
    setCardName("");
    setPrice("");
    setSessions("");
    setOpen(false);
  };

  const handleCardNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardName(e.target.value);
    if (errors.cardName) {
      setErrors((prev) => ({ ...prev, cardName: undefined }));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, "");
    setPrice(onlyDigits);

    if (errors.price && onlyDigits) {
      setErrors((prev) => ({ ...prev, price: undefined }));
    }
  };

  const handleSessionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, "");
    setSessions(onlyDigits);
    if (errors.sessions && onlyDigits) {
      setErrors((prev) => ({ ...prev, sessions: undefined }));
    }
  };

  const handleClose = () => {
    setOpen(false);
    setErrors({});
  };

  const cardOptions = cards?.activeCards?.map((card) => ({
    label: card.name,
    value: card.id,
  })) || [];

  return (
    <div className="flex flex-col gap-1">
      <label className="block font-medium mb-1">Cards</label>
      <MultiSelect
        options={cardOptions}
        values={selectedCardIds}
        placeholder="Select cards"
        newOptionLabel="New card"
        newOptionOnClick={() => {
          setOpen(true);
        }}
        onChange={(values) => {
          onChange(values as number[]);
        }}
        error={error}
      />
      <Drawer
        title="New Card"
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      >
        <form className="mb-6">
          <InputField
            label="Card Name"
            value={cardName}
            placeholder="E.g. 初階6堂"
            onChange={handleCardNameChange}
            error={errors.cardName}
          />
          <div className="flex gap-4">
            <InputField
              label="Price"
              value={price}
              onChange={handlePriceChange}
              error={errors.price}
              type="number"
            />
            <InputField
              label="Sessions"
              value={sessions}
              onChange={handleSessionsChange}
              error={errors.sessions}
              type="number"
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
};

export default NewCard;
