import { Info, Minus, Plus } from "lucide-react";
import { useGetCardsQuery } from "@/store/slices/cards";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { cn } from "@/lib/utils";
import { FieldError, fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { NoDanceStylesNotice } from "@/features/lessons/newLesson/DanceStyleSelect";
import { cardKind, CardKind, perSessionPrice } from "../cardInsights";
import type { CardFormState } from "./useCardForm";

const KIND_OPTIONS: { value: CardKind; title: string; description: string }[] = [
  {
    value: "general",
    title: "所有學生",
    description: "一般方案。任何學生都買得到。",
  },
  {
    value: "practice",
    title: "已上過這個舞種的學生",
    description:
      "複習卡。只有取得該舞種資格的學生買得到，也只能用在不超過他已完成階級的課。",
  },
  {
    value: "trial",
    title: "來體驗的新同學",
    description: "體驗課卡。老師在體驗課的課程頁登記時用，學生端不會看到。",
  },
];

const sectionTitle = "text-[15px] font-bold text-neutral-900";
const fieldLabel = "text-sm font-medium text-neutral-900";
/** A boxed control whose real input sits inside (prefix, stepper buttons). */
const boxedControl = (error?: string) =>
  cn(
    fieldControlClass(!!error),
    "flex items-center h-12 focus-within:border-primary-700 focus-within:ring-[3px] focus-within:ring-primary-100"
  );

/**
 * 課卡方案表單的欄位。狀態全在 `useCardForm`，這裡只負責長相——
 * 桌面右側抽屜和手機底部抽屜都渲染這一份。
 */
const CardFormFields = ({ form }: { form: CardFormState }) => {
  const { values, errors, name, issuedCount, setValue, setKind, setName, resetName } = form;

  return (
    <div className="flex flex-col gap-7">
      {issuedCount > 0 && (
        <div className="flex gap-3 items-start rounded-2xl bg-primary-50 px-4 py-3.5">
          <Info className="w-4.5 h-4.5 shrink-0 mt-0.5 text-primary-700" aria-hidden />
          <p className="text-[13px] leading-relaxed text-neutral-700">
            改了只套用在<b>之後的購買</b>。學生手上已經買的 {issuedCount}{" "}
            張，堂數和價格都照當時的算，不會跟著變。
          </p>
        </div>
      )}

      <fieldset className="flex flex-col gap-2.5">
        <legend className={`${sectionTitle} mb-2.5`}>這張卡給誰買？</legend>
        <div role="radiogroup" aria-label="這張卡給誰買" className="flex flex-col gap-2.5">
          {KIND_OPTIONS.map((option) => {
            const selected = values.kind === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setKind(option.value)}
                className={`flex gap-3 items-start w-full text-left px-4 py-3.5 rounded-xl border transition-colors cursor-pointer ${
                  selected
                    ? "border-primary-700 bg-primary-50 ring-1 ring-primary-700"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <span
                  className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                    selected ? "border-primary-700" : "border-neutral-400"
                  }`}
                >
                  {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary-700" />}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold text-neutral-900">{option.title}</span>
                  <span className="text-[13px] leading-relaxed text-neutral-600">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <DanceStyleField
        value={values.danceStyleId}
        required={values.kind === "practice"}
        error={errors.danceStyleId}
        onChange={(id) => setValue("danceStyleId", id)}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className={`${sectionTitle} mb-2.5`}>堂數與價格</legend>
        <div className="grid grid-cols-2 gap-3">
          <SessionsStepper
            value={values.sessions}
            error={errors.sessions}
            onChange={(next) => setValue("sessions", next)}
          />
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>總價</span>
            <span className={cn(boxedControl(errors.price), "gap-1.5")}>
              <span className="text-neutral-500">$</span>
              <input
                value={values.price}
                inputMode="numeric"
                aria-invalid={errors.price ? true : undefined}
                onChange={(e) => setValue("price", e.target.value.replace(/\D/g, ""))}
                className="flex-1 min-w-0 bg-transparent text-[17px] font-semibold outline-none"
              />
            </span>
            <FieldError>{errors.price}</FieldError>
          </label>
        </div>
        <PriceLadder form={form} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5">
          <span className={sectionTitle}>名稱</span>
          <input
            value={name}
            aria-invalid={errors.name ? true : undefined}
            onChange={(e) => setName(e.target.value)}
            className={cn(fieldControlClass(!!errors.name), "h-12")}
          />
        </label>
        <FieldError>{errors.name}</FieldError>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-neutral-500">學生在 LINE 上看到的就是這個名字</span>
          {values.nameEdited && (
            <Button variant="link" onClick={resetName} className="min-h-9 text-xs font-semibold">
              改回自動名稱
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const DanceStyleField = ({
  value,
  required,
  error,
  onChange,
}: {
  value: number | null;
  required: boolean;
  error?: string;
  onChange: (id: number | null) => void;
}) => {
  const { styles, byId, isLoading } = useDanceStyles();
  // 封存的舞種不提供選擇，除非這張卡本來就掛著它。
  const current = value !== null ? byId.get(value) : undefined;
  const choices = current?.archivedAt ? [...styles, current] : styles;

  if (!isLoading && choices.length === 0) {
    return required ? <NoDanceStylesNotice label="用在哪個舞種？" /> : null;
  }

  const chip = (selected: boolean, disabled = false) =>
    `flex items-center gap-2 min-h-11 px-3.5 rounded-xl border text-sm font-medium transition-colors ${
      disabled
        ? "border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed"
        : selected
          ? "border-primary-700 ring-1 ring-primary-700 bg-primary-50 text-neutral-900 cursor-pointer"
          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 cursor-pointer"
    }`;

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className={`${sectionTitle} mb-2.5`}>用在哪個舞種？</legend>
      <div role="radiogroup" aria-label="舞種" className="flex flex-wrap gap-2">
        {choices.map((style) => {
          const meta = danceStyleMeta(style);
          return (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={value === style.id}
              onClick={() => onChange(style.id)}
              className={chip(value === style.id)}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-disabled={required}
          onClick={() => !required && onChange(null)}
          className={chip(value === null && !required, required)}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
          不限舞種
        </button>
      </div>
      {required ? (
        <span className="text-xs text-neutral-500">複習卡一定要指定舞種。</span>
      ) : (
        <span className="text-xs text-neutral-500">一般方案的舞種只是分組用，不限制能用在哪種課。</span>
      )}
      <FieldError>{error}</FieldError>
    </fieldset>
  );
};

const SessionsStepper = ({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (next: string) => void;
}) => {
  const count = Number(value) || 0;
  const step = (delta: number) => onChange(String(Math.min(99, Math.max(1, count + delta))));
  const button =
    "w-11 h-full flex items-center justify-center bg-neutral-50 text-neutral-700 hover:bg-neutral-100 cursor-pointer";
  return (
    <div className="flex flex-col gap-1.5">
      <span id="card-sessions-label" className={fieldLabel}>
        堂數
      </span>
      <div
        role="group"
        aria-labelledby="card-sessions-label"
        className={cn(boxedControl(error), "px-0 overflow-hidden")}
      >
        <button type="button" aria-label="少一堂" onClick={() => step(-1)} className={button}>
          <Minus className="w-4 h-4" />
        </button>
        <input
          value={value}
          inputMode="numeric"
          aria-label="堂數"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className="flex-1 min-w-0 text-center text-[17px] font-semibold outline-none"
        />
        <button type="button" aria-label="多一堂" onClick={() => step(1)} className={button}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
};

/**
 * 單堂價 ＋ 跟同舞種其他一般方案的比較。定價時真正在比的是單堂價，
 * 不該等送出、回到列表才看得出「16 堂反而比 8 堂貴」。
 */
const PriceLadder = ({ form }: { form: CardFormState }) => {
  const { values, name, editingId } = form;
  const { data } = useGetCardsQuery();
  const price = Number(values.price);
  const sessions = Number(values.sessions);
  if (!(price > 0 && sessions > 0)) return null;

  const current = perSessionPrice({ price, sessions });
  // 只跟同舞種的一般方案比；不限舞種常常混著私人課之類的不同產品。
  const siblings =
    values.kind === "general" && values.danceStyleId !== null
      ? (data?.activeCards ?? []).filter(
          (card) =>
            card.id !== editingId &&
            cardKind(card) === "general" &&
            (card.danceStyleId ?? null) === values.danceStyleId
        )
      : [];
  const rows = [
    ...siblings.map((card) => ({ key: card.id, label: card.name, per: perSessionPrice(card), me: false })),
    { key: "me", label: `${name || "這個方案"}（這張）`, per: current, me: true },
  ].sort((a, b) => b.per - a.per);
  const max = Math.max(...rows.map((row) => row.per), 1);

  return (
    <div className="rounded-2xl border border-neutral-200 overflow-hidden">
      <div className="flex items-baseline justify-between px-4 py-3 bg-primary-50">
        <span className="text-[13px] text-primary-900">單堂</span>
        <span className="text-[22px] font-bold text-primary-900">${current.toLocaleString()}</span>
      </div>
      {siblings.length > 0 && (
        <div className="px-4 py-3 flex flex-col gap-2">
          <span className="text-xs text-neutral-500">跟同舞種的其他方案比（堂數越多，單堂通常越便宜）</span>
          {rows.map((row) => (
            <div
              key={row.key}
              className={`grid grid-cols-[minmax(0,1fr)_88px] gap-2.5 items-center text-[13px] ${
                row.me ? "font-bold text-neutral-900" : "text-neutral-700"
              }`}
            >
              <span className="flex flex-col gap-1 min-w-0">
                <span className="truncate">{row.label}</span>
                <span className="block h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${row.me ? "bg-primary-700" : "bg-neutral-300"}`}
                    style={{ width: `${Math.round((row.per / max) * 100)}%` }}
                  />
                </span>
              </span>
              <span className="text-right">單堂 ${row.per.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CardFormFields;
