/**
 * 新增課程時「順手建一張課卡」那個精簡表單用的驗證（`newLesson/CardSelect`）。
 * 課卡頁自己的方案表單在 `CardForm/useCardForm.ts`，規則同一套上限。
 */
export const cardValidationForm = (data: { cardName: string; price: string; sessions: string }) => {
  const errors: { cardName?: string; price?: string; sessions?: string } = {};
  if (!data.cardName) errors.cardName = "請輸入課卡名稱";
  if (!data.price) errors.price = "請輸入數字";
  if (!data.sessions) errors.sessions = "請輸入數字";
  if (Number(data.price) > 30000) errors.price = "金額必須小於 30000";
  if (Number(data.sessions) > 100) errors.sessions = "堂數必須小於 100";
  return errors;
};
