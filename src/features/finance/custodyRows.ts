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
/**
 * 保管中的四組（依序顯示，各有小標）：要留著（預收）→ 已先付（場地包）→
 * 這個月要付出去或領走的（待付、自己的、要轉給對方、未分配）→ 公積金。
 */
export type CustodyGroup = "keep" | "prepaidOut" | "outgoing" | "fund";
export const CUSTODY_GROUP_ORDER: CustodyGroup[] = ["keep", "prepaidOut", "outgoing", "fund"];
export const CUSTODY_GROUP_LABELS: Record<CustodyGroup, string> = {
  keep: "要留著",
  prepaidOut: "已先付",
  outgoing: "這個月要付出去或領走的",
  fund: "公積金",
};
/** `key` is stable and unique within one custodian's table. `hint` 是列下方的灰色小字。 */
export type CustodyRow = {
  key: string;
  label: string;
  amount: number;
  tone: CustodyTone;
  group: CustodyGroup;
  hint?: string;
};

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

const GROUP_OF: Record<CustodyTone, CustodyGroup> = {
  locked: "keep",
  pack: "prepaidOut",
  owed: "outgoing",
  mine: "outgoing",
  peer: "outgoing",
  fund: "fund",
};

/**
 * 順序依組：預收 → 場地包 → 待付老師 → 自己的 → 待付場地 → 要轉給／會轉給你 → 未分配 → 公積金。
 * 四捨五入到元後為 0 的列不顯示（預收除外）。
 */
export function custodyRows(b: Buckets, names: NameMaps): CustodyRow[] {
  const rows: CustodyRow[] = [
    { key: "prepaid", label: "預收（學生還沒上的卡）", amount: b.prepaid, tone: "locked", group: "keep" },
  ];
  const add = (key: string, label: string, amount: number, tone: CustodyTone, hint?: string) => {
    if (Math.round(amount) === 0) return;
    const row: CustodyRow = { key, label, amount, tone, group: GROUP_OF[tone] };
    if (hint) row.hint = hint;
    rows.push(row);
  };
  for (const id of idsOf(b.packs)) {
    const pack = names.packs[id];
    const unused = pack && pack.unitValue > 0 ? Math.round(-b.packs[id] / pack.unitValue) : null;
    const detail =
      pack && unused !== null
        ? `${pack.venue} ${unused >= 0 ? `剩 ${unused} 次` : `超用 ${-unused} 次`}`
        : pack?.venue;
    add(`pack:${id}`, detail ? `場地包（${detail}）` : "場地包", b.packs[id], "pack");
  }
  for (const id of idsOf(b.teachers)) add(`teacher:${id}`, `待付 ${names.teachers[id] ?? "老師"}`, b.teachers[id], "owed");
  add("self", `${names.self}自己的${selfDetail(b)}`, b.self, "mine");
  for (const id of idsOf(b.venues)) add(`venue:${id}`, `待付 ${names.venues[id] ?? "場地"}`, b.venues[id], "owed");
  for (const id of idsOf(b.peers)) {
    const name = names.users[id] ?? "成員";
    if (b.peers[id] > 0) add(`peer:${id}`, `要轉給 ${name}`, b.peers[id], "owed");
    else add(`peer:${id}`, `${name} 會轉給你`, b.peers[id], "peer", `這筆錢在 ${name} 手上，所以從你的總額扣掉`);
  }
  add("unallocated", "未分配", b.unallocated, "owed");
  for (const id of idsOf(b.funds)) add(`fund:${id}`, `${names.locations[id] ?? "分部"}公積金`, b.funds[id], "fund");
  return rows;
}
