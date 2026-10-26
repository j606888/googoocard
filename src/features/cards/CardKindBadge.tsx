import StatusTag, { type StatusTone } from "@/components/StatusTag";
import type { CardKind } from "./cardInsights";

const KIND_STYLE: Record<CardKind, { label: string; tone: StatusTone }> = {
  general: { label: "一般", tone: "neutral" },
  practice: { label: "複習", tone: "warning" },
  trial: { label: "體驗", tone: "positive" },
};

/** 方案種類的小標籤。列表上一般方案不顯示（大多數都是），只標複習／體驗。 */
export const CardKindBadge = ({ kind, label }: { kind: CardKind; label?: string }) => (
  <StatusTag tone={KIND_STYLE[kind].tone}>{label ?? KIND_STYLE[kind].label}</StatusTag>
);
