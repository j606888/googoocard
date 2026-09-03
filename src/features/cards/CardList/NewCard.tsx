import { Plus } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import { useCreateCardMutation } from "@/store/slices/cards";
import { DanceType } from "@prisma/client";
import CardFormFields, { CardFormErrors, CardFormValues } from "./CardFormFields";

const CardValidationErrors = {
  cardName: "請輸入課卡名稱",
  price: "請輸入數字",
  priceTooHigh: "金額必須小於 30000",
  sessions: "請輸入數字",
  sessionsTooHigh: "堂數必須小於 100",
};

/** 複習卡沒選舞種時的前端訊息。API 端的契約字串是 PRACTICE_CARD_REQUIRES_DANCE_TYPE。 */
export const DANCE_TYPE_REQUIRED = "請選擇舞種";

export const cardValidationForm = (data: { cardName: string; price: string; sessions: string }) => {
  const errors: { cardName?: string; price?: string; sessions?: string } = {};
  if (!data.cardName) {
    errors.cardName = CardValidationErrors.cardName;
  }
  if (!data.price) {
    errors.price = CardValidationErrors.price;
  }
  if (!data.sessions) {
    errors.sessions = CardValidationErrors.sessions;
  }
  if (Number(data.price) > 30000) {
    errors.price = CardValidationErrors.priceTooHigh;
  }
  if (Number(data.sessions) > 100) {
    errors.sessions = CardValidationErrors.sessionsTooHigh;
  }
  return errors;
};

const EMPTY_FORM: CardFormValues = {
  cardName: "",
  price: "",
  sessions: "",
  isPracticeCard: false,
  danceType: null,
};

const NewCard = () => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CardFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<CardFormErrors>({});

  const [createCard, { isLoading }] = useCreateCardMutation();

  const setValue = <K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const clearError = (key: keyof CardFormErrors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined }));

  const handleSubmit = async () => {
    const { cardName, price, sessions, isPracticeCard, danceType } = values;
    const nextErrors: CardFormErrors = cardValidationForm({ cardName, price, sessions });
    if (isPracticeCard && !danceType) {
      nextErrors.danceType = DANCE_TYPE_REQUIRED;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    await createCard({
      name: cardName,
      price: Number(price),
      sessions: Number(sessions),
      isPracticeCard,
      danceType: danceType as DanceType | null,
    });
    setValues(EMPTY_FORM);
    setOpen(false);
  };

  const handleClose = () => {
    setOpen(false);
    setErrors({});
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 whitespace-nowrap bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600"
      >
        <Plus className="w-4 h-4 shrink-0" />
        <span className="font-medium">新增課卡</span>
      </button>
      <Drawer
        title="新增課卡"
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        isLoading={isLoading}
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
    </>
  );
};

export default NewCard;
