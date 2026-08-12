// 一次性批次轉換：Bailamore（classroomId 3）淘汰複習卡與初階卡，換成進階卡。
//
//   複習卡(12)  → 進階單堂(9)，堂數 = ceil(剩餘 / 3)   （3:1 無條件進位）
//   初階6堂(6)  → 進階6堂(8)，堂數 = 剩餘堂數           （1:1 帶走）
//
// 新卡的 finalPrice 一律是舊卡的剩餘價值（單堂價 × 剩餘堂數），並標記
// origin = CONVERSION，所以課卡營收統計不會重複認列。實際寫入邏輯直接呼叫
// `src/service/studentCardConversion.ts` 的 performConversion —— 與後台單張
// 轉換走完全同一份程式碼。
//
// 用法（在專案根目錄）:
//   npx tsx scripts/convert-bailamore-cards.mts            # dry run，只印計畫
//   npx tsx scripts/convert-bailamore-cards.mts --apply    # 實際寫入
//
// （副檔名是 .mts 而非 .ts —— 專案沒設 "type": "module"，tsx 會把 .ts 當 CJS
//   處理而不支援 top-level await。）
//
// 重跑安全：只挑 expiredAt IS NULL 且 convertedToId IS NULL 的卡，已經轉過的
// 不會再被選到。

import { readFileSync } from "node:fs";

const CLASSROOM_ID = 3;

const PLANS = [
  {
    label: "複習卡 → 進階單堂",
    sourceCardId: 12,
    targetCardId: 9,
    sessionsFor: (remaining: number) => Math.ceil(remaining / 3),
  },
  {
    label: "初階6堂 → 進階6堂",
    sourceCardId: 6,
    targetCardId: 8,
    sessionsFor: (remaining: number) => remaining,
  },
];

const apply = process.argv.includes("--apply");

// --- production DATABASE_URL（沿用 scripts/deploy-migrations.mjs 的做法） ---
function prodUrl() {
  const text = readFileSync(new URL("../.env.production", import.meta.url), "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trimStart();
    if (line.startsWith("#")) continue;
    const m = line.match(/^DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const url = process.env.DATABASE_URL ?? prodUrl();
if (!url) {
  console.error("✋ 找不到 DATABASE_URL（環境變數或 .env.production）");
  process.exit(1);
}
const host = (url.match(/@([^:/?]+)/) ?? [])[1] ?? "(unknown host)";
console.log(`\n▶ 目標資料庫: ${host}`);
console.log(`▶ 模式: ${apply ? "APPLY（會實際寫入）" : "DRY RUN（不寫入）"}\n`);

// PrismaClient 在 import 時就會讀 DATABASE_URL，所以要先設好再動態載入。
process.env.DATABASE_URL = url;
const { default: prisma } = await import("@/lib/prisma");
const { performConversion, residualValueOf } = await import(
  "@/service/studentCardConversion"
);

// --- 安全檢查：四張卡必須都屬於 Bailamore ---
const cardIds = [...new Set(PLANS.flatMap((p) => [p.sourceCardId, p.targetCardId]))];
const cards = await prisma.card.findMany({ where: { id: { in: cardIds } } });

for (const id of cardIds) {
  const card = cards.find((c) => c.id === id);
  if (!card) {
    console.error(`✋ 中止：找不到 card id ${id}`);
    process.exit(1);
  }
  if (card.classroomId !== CLASSROOM_ID) {
    console.error(
      `✋ 中止：card ${id}「${card.name}」屬於 classroom ${card.classroomId}，不是 ${CLASSROOM_ID}`
    );
    process.exit(1);
  }
  console.log(`  ✓ card ${id} 「${card.name}」 classroom ${card.classroomId}`);
}
console.log("");

// --- 收集要轉換的卡 ---
type Row = {
  plan: (typeof PLANS)[number];
  sourceCard: Awaited<ReturnType<typeof loadHolders>>[number];
  sessions: number;
  residual: number;
};

async function loadHolders(sourceCardId: number) {
  return prisma.studentCard.findMany({
    where: {
      cardId: sourceCardId,
      remainingSessions: { gt: 0 },
      expiredAt: null,
      convertedToId: null,
      student: { classroomId: CLASSROOM_ID },
    },
    include: { card: { select: { name: true } }, student: { select: { name: true } } },
    orderBy: { id: "asc" },
  });
}

const rows: Row[] = [];
for (const plan of PLANS) {
  for (const sourceCard of await loadHolders(plan.sourceCardId)) {
    const sessions = plan.sessionsFor(sourceCard.remainingSessions);
    rows.push({ plan, sourceCard, sessions, residual: residualValueOf(sourceCard) });
  }
}

if (rows.length === 0) {
  console.log("沒有需要轉換的課卡（可能已經全部轉換過了）。");
  await prisma.$disconnect();
  process.exit(0);
}

console.table(
  rows.map((r) => ({
    scId: r.sourceCard.id,
    學生: r.sourceCard.student.name,
    來源卡: r.sourceCard.card.name,
    剩餘: `${r.sourceCard.remainingSessions}/${r.sourceCard.totalSessions}`,
    原價: r.sourceCard.finalPrice,
    轉換為: cards.find((c) => c.id === r.plan.targetCardId)!.name,
    新堂數: r.sessions,
    帶走金額: r.residual,
  }))
);

for (const plan of PLANS) {
  const sub = rows.filter((r) => r.plan === plan);
  console.log(
    `${plan.label}: ${sub.length} 張，帶走 $${sub.reduce((s, r) => s + r.residual, 0).toLocaleString()}`
  );
}
console.log(
  `合計: ${rows.length} 張，帶走 $${rows.reduce((s, r) => s + r.residual, 0).toLocaleString()}\n`
);

if (!apply) {
  console.log("這是 dry run，沒有寫入任何資料。確認無誤後加上 --apply 執行。\n");
  await prisma.$disconnect();
  process.exit(0);
}

// --- 實際執行 ---
const mapping: { scId: number; student: string; newScId: number }[] = [];
const failures: { scId: number; student: string; error: string }[] = [];

for (const row of rows) {
  const targetCard = cards.find((c) => c.id === row.plan.targetCardId)!;
  try {
    const created = await performConversion({
      sourceCard: row.sourceCard,
      targetCard,
      sessions: row.sessions,
      actorUserId: null,
    });
    mapping.push({
      scId: row.sourceCard.id,
      student: row.sourceCard.student.name,
      newScId: created.id,
    });
    console.log(
      `  ✓ ${row.sourceCard.student.name}: #${row.sourceCard.id} → #${created.id} (${row.sessions} 堂 / $${row.residual})`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ scId: row.sourceCard.id, student: row.sourceCard.student.name, error: message });
    console.error(`  ✗ ${row.sourceCard.student.name}: #${row.sourceCard.id} 失敗 — ${message}`);
  }
}

console.log(`\n完成 ${mapping.length} / ${rows.length} 張。`);
if (failures.length > 0) {
  console.log("\n失敗清單:");
  console.table(failures);
}
console.log("\n舊卡 → 新卡 對照表（回滾用，請保留）:");
console.table(mapping);

await prisma.$disconnect();
