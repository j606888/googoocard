import { useState } from "react";
import { Card, useCreateCardMutation, useUpdateCardMutation } from "@/store/slices/cards";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { autoCardName, cardKind, CardKind, kindFlags } from "../cardInsights";

export interface CardFormValues {
  /** 只在 `nameEdited` 時有意義；沒改過就用自動名稱。 */
  name: string;
  nameEdited: boolean;
  price: string;
  sessions: string;
  kind: CardKind;
  danceStyleId: number | null;
}

export interface CardFormErrors {
  name?: string;
  price?: string;
  sessions?: string;
  danceStyleId?: string;
}

/**
 * 表單要開在哪個方案上：
 * - `new` — 全新方案，可以預先帶舞種（從某個舞種群組的「＋ 加一個方案」進來）。
 * - `edit` — 改既有方案。
 * - `duplicate` — 以既有方案為底建一個新的（名稱另外加「（複製）」）。
 */
export type CardFormTarget =
  | { mode: "new"; danceStyleId?: number | null }
  | { mode: "edit"; card: Card }
  | { mode: "duplicate"; card: Card };

const MAX_PRICE = 30000;
const MAX_SESSIONS = 100;

const initialValues = (target: CardFormTarget): CardFormValues => {
  if (target.mode === "new") {
    return {
      name: "",
      nameEdited: false,
      price: "",
      sessions: "",
      kind: "general",
      danceStyleId: target.danceStyleId ?? null,
    };
  }
  const { card } = target;
  return {
    name: target.mode === "duplicate" ? `${card.name}（複製）` : card.name,
    nameEdited: true,
    price: String(card.price),
    sessions: String(card.sessions),
    kind: cardKind(card),
    danceStyleId: card.danceStyleId ?? null,
  };
};

export const validateCardForm = (
  values: CardFormValues,
  name: string
): CardFormErrors => {
  const errors: CardFormErrors = {};
  if (!name.trim()) errors.name = "請輸入方案名稱";
  if (!values.price) errors.price = "請輸入價格";
  else if (Number(values.price) > MAX_PRICE) errors.price = `價格必須小於 ${MAX_PRICE}`;
  if (!values.sessions || Number(values.sessions) < 1) errors.sessions = "至少 1 堂";
  else if (Number(values.sessions) > MAX_SESSIONS) errors.sessions = `堂數必須小於 ${MAX_SESSIONS}`;
  if (values.kind === "practice" && !values.danceStyleId) {
    // API 端的契約字串是 PRACTICE_CARD_REQUIRES_DANCE_TYPE。
    errors.danceStyleId = "複習卡要指定舞種";
  }
  return errors;
};

/**
 * 新增／編輯／複製課卡方案共用的狀態機。桌面的右側抽屜與手機的底部抽屜
 * 只是兩個外殼，欄位、驗證、送出都在這裡（docs/ui-responsive.md 規則 2）。
 */
export function useCardForm(target: CardFormTarget) {
  const [values, setValues] = useState<CardFormValues>(() => initialValues(target));
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [createCard, { isLoading: isCreating }] = useCreateCardMutation();
  const [updateCard, { isLoading: isUpdating }] = useUpdateCardMutation();
  const { byId } = useDanceStyles();

  const styleName =
    values.danceStyleId !== null ? byId.get(values.danceStyleId)?.name ?? null : null;
  const autoName = autoCardName({
    styleName,
    kind: values.kind,
    sessions: Number(values.sessions) || 0,
  });
  const name = values.nameEdited ? values.name : autoName;

  const setValue = <K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    const errorKey = key === "nameEdited" ? "name" : key;
    if (errorKey in errors) setErrors((prev) => ({ ...prev, [errorKey]: undefined }));
  };

  const setKind = (kind: CardKind) =>
    setValues((prev) => ({
      ...prev,
      kind,
      // 體驗課通常就是一堂；從體驗課換回來時清掉，讓老師自己填。
      sessions: kind === "trial" ? "1" : prev.kind === "trial" ? "" : prev.sessions,
    }));

  const setName = (next: string) => {
    setValues((prev) => ({ ...prev, name: next, nameEdited: true }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const resetName = () => setValues((prev) => ({ ...prev, name: "", nameEdited: false }));

  /** 送出成功回傳方案 id，驗證不過或失敗回 `null`。 */
  const submit = async (): Promise<number | null> => {
    const nextErrors = validateCardForm(values, name);
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return null;
    }
    const body = {
      name: name.trim(),
      price: Number(values.price),
      sessions: Number(values.sessions),
      danceStyleId: values.danceStyleId,
      ...kindFlags(values.kind),
    };
    const result =
      target.mode === "edit"
        ? await updateCard({ id: target.card.id, ...body })
        : await createCard(body);
    return "data" in result && result.data ? result.data.id : null;
  };

  return {
    mode: target.mode,
    /** 編輯時已經發出幾張——表單上要講清楚改了不會影響它們。 */
    issuedCount: target.mode === "edit" ? target.card.purchasedCount : 0,
    editingId: target.mode === "edit" ? target.card.id : null,
    values,
    errors,
    name,
    autoName,
    setValue,
    setKind,
    setName,
    resetName,
    submit,
    isLoading: isCreating || isUpdating,
  };
}

export type CardFormState = ReturnType<typeof useCardForm>;
