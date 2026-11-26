import { useId } from "react";
import { Check, Info, Minus, Plus } from "lucide-react";
import { useGetCardsQuery } from "@/store/slices/cards";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import DanceStyleDot from "@/components/DanceStyleDot";
import { FieldError } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { NoDanceStylesNotice } from "@/features/lessons/newLesson/DanceStyleSelect";
import { GROUP_CARD } from "@/features/lessons/newLesson/grouped";
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

/**
 * 一組設定（Apple 設定頁的做法，跟新增課程同一套 `GROUP_CARD`）：上方小標、
 * 白色群組裡細線分隔的列、下方註解。抽屜窄，一律單欄（不用 `GroupedSection` 的桌面兩欄）。
 */
const FormGroup = ({
  title,
  titleId,
  footer,
  error,
  invalid,
  role,
  children,
}: {
  title: string;
  titleId?: string;
  footer?: React.ReactNode;
  error?: string;
  /** 群組外框標紅（錯誤寫在下面）。 */
  invalid?: boolean;
  role?: "radiogroup" | "group";
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-1.5">
    <h3 id={titleId} className="px-4 text-[13px] text-ink-3">
      {title}
    </h3>
    <div
      role={role}
      aria-labelledby={role ? titleId : undefined}
      className={cn(GROUP_CARD, (invalid || error) && "ring-1 ring-danger-500")}
    >
      {children}
    </div>
    {error && (
      <div className="px-4">
        <FieldError>{error}</FieldError>
      </div>
    )}
    {footer && <div className="px-4 text-[13px] leading-relaxed text-ink-3">{footer}</div>}
  </section>
);

/** 單選的一列：整列可點，選到的右邊一個 ✓（同 `CheckRow`，但語意是 radio）。 */
const RadioRow = ({
  checked,
  disabled = false,
  onSelect,
  leading,
  hint,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  leading?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={checked}
    aria-disabled={disabled || undefined}
    onClick={() => !disabled && onSelect()}
    className={cn(
      "flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left outline-none focus-visible:bg-primary-50",
      disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-neutral-50 active:bg-neutral-100"
    )}
  >
    {leading}
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={cn("text-[15px]", disabled ? "text-ink-3" : "text-ink", checked && "font-medium")}>
        {children}
      </span>
      {hint && <span className="text-[13px] leading-relaxed text-ink-3">{hint}</span>}
    </span>
    <Check
      aria-hidden="true"
      strokeWidth={2.5}
      className={cn("size-5 shrink-0 text-primary-700", !checked && "invisible")}
    />
  </button>
);

/**
 * 課卡方案表單的欄位。狀態全在 `useCardForm`，這裡只負責長相——
 * 桌面右側抽屜和手機底部抽屜都渲染這一份。
 */
const CardFormFields = ({ form }: { form: CardFormState }) => {
  const { values, errors, name, issuedCount, setValue, setKind, setName, resetName } = form;
  const id = useId();

  return (
    <div className="flex flex-col gap-7">
      {issuedCount > 0 && (
        <p className="flex items-start gap-2 px-4 text-[13px] leading-relaxed text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-primary-700" aria-hidden />
          <span>
            改了只套用在<b className="font-semibold text-ink">之後的購買</b>。學生手上已經買的 {issuedCount}{" "}
            張，堂數和價格都照當時的算，不會跟著變。
          </span>
        </p>
      )}

      <FormGroup title="這張卡給誰買？" titleId={`${id}-kind`} role="radiogroup">
        {KIND_OPTIONS.map((option) => (
          <RadioRow
            key={option.value}
            checked={values.kind === option.value}
            onSelect={() => setKind(option.value)}
            hint={option.description}
          >
            {option.title}
          </RadioRow>
        ))}
      </FormGroup>

      <DanceStyleField
        value={values.danceStyleId}
        required={values.kind === "practice"}
        error={errors.danceStyleId}
        onChange={(styleId) => setValue("danceStyleId", styleId)}
      />

      <section className="flex flex-col gap-1.5">
        <h3 className="px-4 text-[13px] text-ink-3">堂數與價格</h3>
        <div className={cn(GROUP_CARD, (errors.sessions || errors.price) && "ring-1 ring-danger-500")}>
          <SessionsStepper
            labelId={`${id}-sessions`}
            value={values.sessions}
            invalid={!!errors.sessions}
            onChange={(next) => setValue("sessions", next)}
          />
          <label className="flex min-h-12 items-center gap-3 px-4">
            <span className="shrink-0 text-[15px] text-ink">總價</span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-1">
              <span className="text-[17px] text-ink-3">$</span>
              <input
                value={values.price}
                inputMode="numeric"
                aria-invalid={errors.price ? true : undefined}
                onChange={(e) => setValue("price", e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="w-28 min-w-0 bg-transparent text-right text-[17px] font-semibold tabular-nums text-ink outline-none placeholder:text-ink-3"
              />
            </span>
          </label>
          <PerSessionRow form={form} />
        </div>
        {(errors.sessions || errors.price) && (
          <div className="flex flex-col gap-0.5 px-4">
            <FieldError>{errors.sessions}</FieldError>
            <FieldError>{errors.price}</FieldError>
          </div>
        )}
      </section>

      <PriceLadder form={form} />

      <FormGroup
        title="名稱"
        error={errors.name}
        footer={
          <span className="flex items-center justify-between gap-2">
            <span>學生在 LINE 上看到的就是這個名字</span>
            {values.nameEdited && (
              <Button variant="link" onClick={resetName} className="min-h-9 text-[13px] font-semibold">
                改回自動名稱
              </Button>
            )}
          </span>
        }
      >
        <input
          value={name}
          aria-label="名稱"
          aria-invalid={errors.name ? true : undefined}
          onChange={(e) => setName(e.target.value)}
          className="min-h-12 w-full bg-transparent px-4 text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
      </FormGroup>
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
  const id = useId();
  // 封存的舞種不提供選擇，除非這張卡本來就掛著它。
  const current = value !== null ? byId.get(value) : undefined;
  const choices = current?.archivedAt ? [...styles, current] : styles;

  if (!isLoading && choices.length === 0) {
    return required ? <NoDanceStylesNotice label="用在哪個舞種？" /> : null;
  }

  return (
    <FormGroup
      title="用在哪個舞種？"
      titleId={`${id}-style`}
      role="radiogroup"
      error={error}
      footer={required ? "複習卡一定要指定舞種。" : "一般方案的舞種只是分組用，不限制能用在哪種課。"}
    >
      {choices.map((style) => (
        <RadioRow
          key={style.id}
          checked={value === style.id}
          onSelect={() => onChange(style.id)}
          leading={<DanceStyleDot style={style} />}
        >
          {danceStyleMeta(style).label}
        </RadioRow>
      ))}
      <RadioRow
        checked={value === null && !required}
        disabled={required}
        onSelect={() => onChange(null)}
        leading={<DanceStyleDot style={null} />}
      >
        不限舞種
      </RadioRow>
    </FormGroup>
  );
};

const SessionsStepper = ({
  labelId,
  value,
  invalid,
  onChange,
}: {
  labelId: string;
  value: string;
  invalid: boolean;
  onChange: (next: string) => void;
}) => {
  const count = Number(value) || 0;
  const step = (delta: number) => onChange(String(Math.min(99, Math.max(1, count + delta))));
  const button =
    "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary-700 outline-none hover:bg-primary-50 focus-visible:ring-[3px] focus-visible:ring-primary-300";
  return (
    <div className="flex min-h-12 items-center gap-3 pr-1.5 pl-4">
      <span id={labelId} className="shrink-0 text-[15px] text-ink">
        堂數
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-1 items-center justify-end gap-0.5">
        <button type="button" aria-label="少一堂" onClick={() => step(-1)} className={button}>
          <Minus className="size-4" />
        </button>
        <input
          value={value}
          inputMode="numeric"
          aria-label="堂數"
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className="w-12 min-w-0 bg-transparent text-center text-[17px] font-semibold tabular-nums text-ink outline-none"
        />
        <span className="text-[15px] text-ink-3">堂</span>
        <button type="button" aria-label="多一堂" onClick={() => step(1)} className={button}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
};

/** 群組最後一列：這個方案換算成每堂多少（價格、堂數都填了才出現）。 */
const PerSessionRow = ({ form }: { form: CardFormState }) => {
  const price = Number(form.values.price);
  const sessions = Number(form.values.sessions);
  if (!(price > 0 && sessions > 0)) return null;
  return (
    <div className="flex min-h-12 items-center gap-3 px-4">
      <span className="shrink-0 text-[15px] text-ink">每堂</span>
      <span className="flex-1 text-right text-[17px] font-semibold tabular-nums text-primary-800">
        ${formatMoney(perSessionPrice({ price, sessions }))}
      </span>
    </div>
  );
};

/**
 * 跟同舞種其他一般方案比每堂多少。定價時真正在比的是每堂價，
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
  if (siblings.length === 0) return null;

  const rows = [
    ...siblings.map((card) => ({ key: card.id, label: card.name, per: perSessionPrice(card), me: false })),
    { key: "me", label: `${name || "這個方案"}（這張）`, per: current, me: true },
  ].sort((a, b) => b.per - a.per);
  const max = Math.max(...rows.map((row) => row.per), 1);

  return (
    <FormGroup title="跟同舞種的其他方案比" footer="堂數越多，每堂通常越便宜。">
      {rows.map((row) => (
        <div key={row.key} className="grid min-h-12 grid-cols-[minmax(0,1fr)_96px] items-center gap-3 px-4 py-2">
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className={cn("truncate text-[15px]", row.me ? "font-semibold text-ink" : "text-ink-2")}>
              {row.label}
            </span>
            <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-band">
              <span
                className={`block h-full rounded-full ${row.me ? "bg-primary-700" : "bg-neutral-300"}`}
                style={{ width: `${Math.round((row.per / max) * 100)}%` }}
              />
            </span>
          </span>
          <span
            className={cn(
              "text-right text-[13px] tabular-nums",
              row.me ? "font-semibold text-ink" : "text-ink-2"
            )}
          >
            每堂 ${formatMoney(row.per)}
          </span>
        </div>
      ))}
    </FormGroup>
  );
};

export default CardFormFields;
