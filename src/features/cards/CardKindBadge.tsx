import type { CardKind } from "./cardInsights";

const KIND_STYLE: Record<CardKind, { label: string; className: string }> = {
  general: { label: "一般", className: "bg-neutral-100 text-neutral-700" },
  practice: { label: "複習", className: "bg-warning-100 text-warning-900" },
  trial: { label: "體驗", className: "bg-primary-100 text-primary-900" },
};

/** 方案種類的小標籤。列表上一般方案不顯示（大多數都是），只標複習／體驗。 */
export const CardKindBadge = ({ kind, label }: { kind: CardKind; label?: string }) => (
  <span
    className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${KIND_STYLE[kind].className}`}
  >
    {label ?? KIND_STYLE[kind].label}
  </span>
);
