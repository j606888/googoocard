import Drawer from "@/components/Drawer";
import CardFormFields from "./CardFormFields";
import { CardFormTarget, useCardForm } from "./useCardForm";

export const FORM_TITLE = { new: "新增方案", edit: "編輯方案", duplicate: "複製成新方案" } as const;
export const SUBMIT_TEXT = {
  new: "建立方案",
  edit: "儲存，之後的購買用新設定",
  duplicate: "建立方案",
} as const;

/**
 * 手機版的方案表單外殼（底部抽屜）。桌面版在 `CardSheet` 裡就地換成表單，
 * 不另開彈窗。呼叫端在 `target` 換掉時要給新的 `key`，狀態才會重設。
 */
const CardFormDrawer = ({
  target,
  onClose,
  onSaved,
}: {
  target: CardFormTarget;
  onClose: () => void;
  onSaved?: (cardId: number) => void;
}) => {
  const form = useCardForm(target);

  const handleSubmit = async () => {
    const id = await form.submit();
    if (id === null) return;
    onSaved?.(id);
    onClose();
  };

  return (
    <Drawer
      open
      title={FORM_TITLE[target.mode]}
      subtitle={target.mode === "new" ? undefined : target.card.name}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={form.isLoading}
      submitText={SUBMIT_TEXT[target.mode]}
      secondaryText="取消"
    >
      <form className="mb-6" onSubmit={(e) => e.preventDefault()}>
        <CardFormFields form={form} />
      </form>
    </Drawer>
  );
};

export default CardFormDrawer;
