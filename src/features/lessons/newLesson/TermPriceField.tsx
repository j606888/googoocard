import { formatMoney } from "@/lib/money";
import { isValidTermPrice, isValidTermSessions, termPerSession } from "@/lib/termEnrollment";
import { cn } from "@/lib/utils";
import { useRowPad } from "./grouped";

/**
 * 報名整期：開關＋整期價＋堂數，下面寫「每堂 $320」。新增課程（分組清單風格）與課程設定抽屜共用，
 * `variant` 只換外觀。
 */
export type TermDraft = { enabled: boolean; price: string; sessions: string };

export const emptyTermDraft: TermDraft = { enabled: false, price: "", sessions: "" };

export const termDraftFrom = (lesson: { termPrice?: number | null; termSessions?: number | null } | null | undefined): TermDraft =>
  lesson?.termPrice != null && lesson?.termSessions != null
    ? { enabled: true, price: String(lesson.termPrice), sessions: String(lesson.termSessions) }
    : emptyTermDraft;

/** 表單 → API；`undefined` = 開了但數字不對（讓表單擋）。 */
export const parseTermDraft = (
  draft: TermDraft
): { termPrice: number | null; termSessions: number | null } | undefined => {
  if (!draft.enabled) return { termPrice: null, termSessions: null };
  const price = Number(draft.price);
  const sessions = Number(draft.sessions);
  if (draft.price.trim() === "" || !isValidTermPrice(price) || !isValidTermSessions(sessions)) return undefined;
  return { termPrice: price, termSessions: sessions };
};

export const termSummary = (draft: TermDraft) => {
  const parsed = parseTermDraft(draft);
  if (!draft.enabled) return "不開放";
  if (!parsed || parsed.termPrice === null || parsed.termSessions === null) return "開放";
  return `$${formatMoney(parsed.termPrice)} / ${parsed.termSessions} 堂（每堂 $${formatMoney(
    Math.round(termPerSession(parsed.termPrice, parsed.termSessions))
  )}）`;
};

const NumberInput = ({
  value,
  onChange,
  label,
  prefix,
  suffix,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
}) => {
  const pad = useRowPad();
  return (
  <label className={cn("flex min-h-12 items-center gap-3", pad)}>
    <span className="shrink-0 text-[15px] text-neutral-900">{label}</span>
    <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-[15px]">
      {prefix && <span className="text-neutral-500">{prefix}</span>}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        aria-label={label}
        aria-invalid={Boolean(invalid)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-24 min-w-0 [appearance:textfield] bg-transparent text-right tabular-nums text-neutral-900 outline-none placeholder:text-neutral-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          invalid && "text-danger-700"
        )}
        placeholder="0"
      />
      {suffix && <span className="text-neutral-500">{suffix}</span>}
    </span>
  </label>
  );
};

const TermPriceField = ({
  draft,
  onChange,
  toggle,
  kind,
  periodCount,
  lockedReason,
}: {
  draft: TermDraft;
  onChange: (draft: TermDraft) => void;
  /** 開關的外觀由呼叫端給（新增課程用 iOS 風格的 ToggleSwitch）。 */
  toggle: (checked: boolean, onToggle: (checked: boolean) => void) => React.ReactNode;
  kind: string;
  /** 已經排的時段數——超過堂數時提醒（伺服器也會擋）。 */
  periodCount?: number;
  /** 有值 = 已有人報名，整期價與堂數鎖住（伺服器回 TERM_LOCKED），只顯示不能改。 */
  lockedReason?: string;
}) => {
  const parsed = parseTermDraft(draft);
  const ongoing = kind === "ongoing";
  const pad = useRowPad();
  if (lockedReason) {
    return (
      <div className={cn("flex min-h-12 items-center gap-3 py-2", pad)}>
        <span className="flex-1">
          <span className="block text-[15px] text-neutral-900">報名整期</span>
          <span className="block text-[13px] text-neutral-500">{lockedReason}</span>
        </span>
        <span className="shrink-0 tabular-nums text-[15px] text-neutral-500">{termSummary(draft)}</span>
      </div>
    );
  }
  return (
    <>
      <div className={cn("flex min-h-12 items-center gap-3 py-2", pad)}>
        <span className="flex-1">
          <span className="block text-[15px] text-neutral-900">報名整期</span>
          <span className="block text-[13px] text-neutral-500">
            {ongoing ? "持續開課的課沒有固定堂數，不能報整期。" : "一次付一期；請假、曠課都照收，不退費。"}
          </span>
        </span>
        {!ongoing && toggle(draft.enabled, (enabled) => onChange({ ...draft, enabled }))}
      </div>
      {draft.enabled && !ongoing && (
        <>
          <NumberInput
            label="整期價"
            prefix="$"
            value={draft.price}
            invalid={draft.price !== "" && !isValidTermPrice(Number(draft.price))}
            onChange={(price) => onChange({ ...draft, price })}
          />
          <NumberInput
            label="堂數"
            suffix="堂"
            value={draft.sessions}
            invalid={draft.sessions !== "" && !isValidTermSessions(Number(draft.sessions))}
            onChange={(sessions) => onChange({ ...draft, sessions })}
          />
          <div className={cn("flex min-h-12 items-center gap-3 text-[15px]", pad)}>
            <span className="flex-1 text-neutral-900">每堂</span>
            <span className="tabular-nums text-neutral-500">
              {parsed?.termPrice != null && parsed.termSessions
                ? `$${formatMoney(Math.round(termPerSession(parsed.termPrice, parsed.termSessions)))}`
                : "—"}
            </span>
          </div>
          {parsed?.termSessions != null && periodCount !== undefined && periodCount !== parsed.termSessions && (
            <p
              className={cn(
                "py-2.5 text-[13px]",
                pad === "px-0" ? "rounded-lg px-3" : "px-4",
                periodCount > parsed.termSessions ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-900"
              )}
            >
              {periodCount > parsed.termSessions
                ? `整期 ${parsed.termSessions} 堂，但排了 ${periodCount} 堂——時段不能比堂數多。`
                : `整期 ${parsed.termSessions} 堂，目前排了 ${periodCount} 堂。`}
            </p>
          )}
        </>
      )}
    </>
  );
};

export default TermPriceField;
