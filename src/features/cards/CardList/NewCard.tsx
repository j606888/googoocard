import { Plus } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import { useCreateCardMutation } from "@/store/slices/cards";
import InputField from "@/components/InputField";

const CardValidationErrors = {
  cardName: "Must provide a name",
  price: "Must be a number",
  priceTooHigh: "Price must be less than 30000",
  sessions: "Must be a number",
  sessionsTooHigh: "Sessions must be less than 100",
};

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

const NewCard = () => {
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
    await createCard({ name: cardName, price: Number(price), sessions: Number(sessions) });
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

  return (
    <>
      <button className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600">
        <Plus className="w-4 h-4" />
        <span className="font-medium" onClick={() => setOpen(true)}>
          New Card
        </span>
      </button>
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
    </>
  );
};

export default NewCard;
