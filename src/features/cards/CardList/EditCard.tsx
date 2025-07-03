import { useEffect, useState } from "react";
import Drawer from "@/components/Drawer";
import { useGetCardsQuery, useUpdateCardMutation } from "@/store/slices/cards";
import InputField from "@/components/InputField";

const validationErrors = {
  cardName: "Must provide a name",
  price: "Must be a number",
  sessions: "Must be a number",
};

const validateForm = (data: {
  cardName: string;
  price: string;
  sessions: string;
}) => {
  const errors: { cardName?: string; price?: string; sessions?: string } = {};
  if (!data.cardName) {
    errors.cardName = validationErrors.cardName;
  }
  if (!data.price) {
    errors.price = validationErrors.price;
  }
  if (!data.sessions) {
    errors.sessions = validationErrors.sessions;
  }
  return errors;
};

const EditCard = ({
  cardId,
  onClose,
}: {
  cardId: number;
  onClose: () => void;
}) => {
  const { data: cards } = useGetCardsQuery();
  const card = cards?.activeCards.find((card) => card.id === cardId);

  const [cardName, setCardName] = useState("");
  const [price, setPrice] = useState("");
  const [sessions, setSessions] = useState("");
  const [errors, setErrors] = useState<{
    cardName?: string;
    price?: string;
    sessions?: string;
  }>({});
  const [updateCard, { isLoading }] = useUpdateCardMutation();

  const handleSubmit = async () => {
    const errors = validateForm({ cardName, price, sessions });
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }
    await updateCard({
      id: cardId,
      name: cardName,
      price: Number(price),
      sessions: Number(sessions),
    });
    onClose();
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
    onClose();
    setErrors({});
  };

  useEffect(() => {
    if (card) {
      setCardName(card.name);
      setPrice(card.price.toString());
      setSessions(card.sessions.toString());
    }
  }, [card]);

  return (
    <>
      <Drawer
        title="Edit Card"
        open={!!cardId}
        onClose={handleClose}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        submitText="Update"
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
    </>
  );
};

export default EditCard;
