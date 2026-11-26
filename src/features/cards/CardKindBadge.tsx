import type { CardKind } from "./cardInsights";

const KIND_LABEL: Record<CardKind, string> = {
  general: "一般",
  practice: "複習",
  trial: "體驗",
};

/**
 * 方案種類的小標籤：淡底深字、不靠顏色分辨（字本身就說了是哪一種）。
 * 列表上一般方案不顯示（大多數都是），只標複習／體驗。
 */
export const CardKindBadge = ({ kind, label }: { kind: CardKind; label?: string }) => (
  <span className="inline-flex h-5.5 shrink-0 items-center whitespace-nowrap rounded-md bg-band px-1.5 text-xs font-semibold text-ink-2">
    {label ?? KIND_LABEL[kind]}
  </span>
);
