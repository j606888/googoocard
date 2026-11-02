import type { Buckets } from "@/domains/finance/ledger";

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
  add("self", `${names.self}自己的`, b.self, "mine");
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
