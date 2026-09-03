import { useEffect, useState } from "react";
import Drawer from "@/components/Drawer";
import { useGetCardsQuery, useUpdateCardMutation } from "@/store/slices/cards";
import { DanceType } from "@prisma/client";
import CardFormFields, { CardFormErrors, CardFormValues } from "./CardFormFields";
import { DANCE_TYPE_REQUIRED } from "./NewCard";

const validationErrors = {
  cardName: "請輸入課卡名稱",
  price: "請輸入數字",
  sessions: "請輸入數字",
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

  const [values, setValues] = useState<CardFormValues>({
    cardName: "",
    price: "",
    sessions: "",
    isPracticeCard: false,
    danceType: null,
  });
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [updateCard, { isLoading }] = useUpdateCardMutation();

  const setValue = <K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const clearError = (key: keyof CardFormErrors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined }));

  const handleSubmit = async () => {
    const { cardName, price, sessions, isPracticeCard, danceType } = values;
    const nextErrors: CardFormErrors = validateForm({ cardName, price, sessions });
    if (isPracticeCard && !danceType) {
      nextErrors.danceType = DANCE_TYPE_REQUIRED;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    await updateCard({
      id: cardId,
      name: cardName,
      price: Number(price),
      sessions: Number(sessions),
      isPracticeCard,
      danceType: danceType as DanceType | null,
    });
    onClose();
  };

  const handleClose = () => {
    onClose();
    setErrors({});
  };

  useEffect(() => {
    if (card) {
      setValues({
        cardName: card.name,
        price: card.price.toString(),
        sessions: card.sessions.toString(),
        isPracticeCard: card.isPracticeCard,
        danceType: card.danceType ?? null,
      });
    }
  }, [card]);

  return (
    <Drawer
      title="編輯課卡"
      open={!!cardId}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitText="儲存"
    >
      <form className="mb-6 flex flex-col gap-4">
        <CardFormFields
          values={values}
          errors={errors}
          onChange={setValue}
          onErrorClear={clearError}
        />
      </form>
    </Drawer>
  );
};

export default EditCard;
