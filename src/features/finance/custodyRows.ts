import type { Buckets } from "@/domains/finance/ledger";
import { formatMoney } from "@/lib/money";

// 保管中的表格列（spec §7.1）。純函式：Buckets + 名字 → 依固定順序排好的列。

export type NameMaps = {
  /** 這位保管人自己的名字（「{名字}自己的」） */
  self: string;
  teachers: Record<number, string>;
  locations: Record<number, string>;
  venues: Record<number, string>;
  users: Record<number, string>;
  /** packId → 場地名稱與每次的價值（price / sessions） */
  packs: Record<number, { venue: string; unitValue: number }>;
};

export type CustodyTone = "locked" | "owed" | "mine" | "fund" | "pack" | "peer";
/** `key` is stable and unique within one custodian's table. */
export type CustodyRow = { key: string; label: string; amount: number; tone: CustodyTone };

const idsOf = (rec: Record<number, number>) => Object.keys(rec).map(Number).sort((a, b) => a - b);

const SELF_PART_LABELS = [
  ["share", "分潤"],
  ["rent", "場租"],
  ["expiry", "過期收入"],
] as const;

/** 「（分潤 911＋場租 600）」：兩種以上來源、而且還沒領走任何一部分（來源加總＝自己的）才標。 */
function selfDetail(b: Buckets): string {
  // 舊的結算快照沒有 selfParts
  const parts = b.selfParts;
  if (!parts) return "";
  const shown = SELF_PART_LABELS.filter(([k]) => Math.round(parts[k]) !== 0);
  const sum = parts.share + parts.rent + parts.expiry;
  if (shown.length < 2 || Math.abs(sum - b.self) >= 0.5) return "";
  return `（${shown.map(([k, label]) => `${label} ${formatMoney(parts[k])}`).join("＋")}）`;
}

/**
 * 順序：預收 → 待付老師 → 自己的 → 公積金 → 場地包 → 待付場地 → 欠／欠我 → 未分配。
 * 四捨五入到元後為 0 的列不顯示（預收除外）。
 */
export function custodyRows(b: Buckets, names: NameMaps): CustodyRow[] {
  const rows: CustodyRow[] = [{ key: "prepaid", label: "預收（學生還沒上的卡）", amount: b.prepaid, tone: "locked" }];
  const add = (key: string, label: string, amount: number, tone: CustodyTone) => {
    if (Math.round(amount) !== 0) rows.push({ key, label, amount, tone });
  };
  for (const id of idsOf(b.teachers)) add(`teacher:${id}`, `待付 ${names.teachers[id] ?? "老師"}`, b.teachers[id], "owed");
  add("self", `${names.self}自己的${selfDetail(b)}`, b.self, "mine");
  for (const id of idsOf(b.funds)) add(`fund:${id}`, `${names.locations[id] ?? "分部"}公積金`, b.funds[id], "fund");
  for (const id of idsOf(b.packs)) {
    const pack = names.packs[id];
    const unused = pack && pack.unitValue > 0 ? Math.round(-b.packs[id] / pack.unitValue) : null;
    const detail =
      pack && unused !== null
        ? `${pack.venue} ${unused >= 0 ? `剩 ${unused} 次` : `超用 ${-unused} 次`}`
        : pack?.venue;
    add(`pack:${id}`, detail ? `場地包（${detail}）` : "場地包", b.packs[id], "pack");
  }
  for (const id of idsOf(b.venues)) add(`venue:${id}`, `待付 ${names.venues[id] ?? "場地"}`, b.venues[id], "owed");
  for (const id of idsOf(b.peers)) {
    const name = names.users[id] ?? "成員";
    if (b.peers[id] > 0) add(`peer:${id}`, `欠 ${name}`, b.peers[id], "owed");
    else add(`peer:${id}`, `${name}欠我`, b.peers[id], "peer");
  }
  add("unallocated", "未分配", b.unallocated, "owed");
  return rows;
}
