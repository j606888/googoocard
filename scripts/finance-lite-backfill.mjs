// 財務輕量版（docs/finance-lite.md §2、§11）：替轉換日前就有的卡補上分部。
//
//   node --env-file=.env scripts/finance-lite-backfill.mjs --classroom=3 --money=2 --before=2026-12-01
//   …確認預覽沒問題，再加 --yes 寫入。
//
// - 只動「錢的分部」還是 null 的卡（已經設過的不碰），而且是 --before 那天（台北 00:00）之前建的卡。
// - 錢的分部 → --money（例：高雄，因為轉換日前所有卡錢都在 Sean 那裡）。
// - 卡的分部 → 這張卡上過最多課的開課分部；沒上過課 → 跟錢的分部一樣。
// 用哪個資料庫看 DATABASE_URL；預設不寫入，只印預覽。

import { PrismaClient } from "@prisma/client";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const classroomId = Number(args.classroom);
const moneyLocationId = Number(args.money);
const before = typeof args.before === "string" ? new Date(`${args.before}T00:00:00+08:00`) : null;
const write = args.yes === true;

if (!classroomId || !moneyLocationId || !before || Number.isNaN(before.getTime())) {
  console.error("用法：--classroom=<id> --money=<分部 id> --before=YYYY-MM-DD [--yes]");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL).host;
    } catch {
      return "(unknown)";
    }
  })();
  console.log(`資料庫：${host}`);

  const locations = await prisma.location.findMany({ where: { classroomId }, select: { id: true, name: true } });
  const name = (id) => locations.find((l) => l.id === id)?.name ?? `#${id}`;
  if (!locations.some((l) => l.id === moneyLocationId)) throw new Error(`分部 ${moneyLocationId} 不在教室 ${classroomId}`);

  const cards = await prisma.studentCard.findMany({
    where: { student: { classroomId }, moneyLocationId: null, createdAt: { lt: before } },
    select: {
      id: true,
      attendanceRecords: { select: { lessonPeriod: { select: { lesson: { select: { locationId: true } } } } } },
    },
  });

  const plan = cards.map((c) => {
    const counts = new Map();
    for (const r of c.attendanceRecords) {
      const loc = r.lessonPeriod.lesson.locationId;
      if (loc) counts.set(loc, (counts.get(loc) ?? 0) + 1);
    }
    const home = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? moneyLocationId;
    return { id: c.id, home };
  });

  const byHome = new Map();
  for (const p of plan) byHome.set(p.home, (byHome.get(p.home) ?? 0) + 1);
  console.log(`要補的卡：${plan.length} 張，錢的分部全部 → ${name(moneyLocationId)}`);
  for (const [home, n] of byHome) console.log(`  卡的分部 ${name(home)}：${n} 張`);

  if (!write) {
    console.log("預覽而已，沒有寫入。確認後加 --yes。");
  } else {
    for (const [home] of byHome) {
      const ids = plan.filter((p) => p.home === home).map((p) => p.id);
      await prisma.studentCard.updateMany({
        where: { id: { in: ids }, moneyLocationId: null },
        data: { moneyLocationId, homeLocationId: home },
      });
    }
    console.log("已寫入。");
  }
} finally {
  await prisma.$disconnect();
}
