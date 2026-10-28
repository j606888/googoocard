import type { StatusTone } from "@/components/StatusTag";
import { PREPAID_CATEGORY } from "../mockData";
import type { Transaction, Transfer } from "../types";

/** 類別標籤：收入綠、支出橘、預收課卡只描邊。 */
export function categoryTone(tx: Transaction): StatusTone {
  if (tx.category === PREPAID_CATEGORY) return "outline";
  return tx.amount < 0 ? "warning" : "positive";
}

export function transferStatus(transfer: Transfer): { label: string; tone: StatusTone } {
  return transfer.confirmed
    ? { label: "已確認收到", tone: "positive" }
    : { label: `等${transfer.receiver}確認`, tone: "warning" };
}
