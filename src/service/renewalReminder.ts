import prisma from "@/lib/prisma";
import { buildRenewalReminderFlex, pushMessage } from "@/lib/line";
import { findExhaustedRenewableCard } from "@/service/studentTag";

/** 同一位學生兩次續卡推播的最小間隔。 */
export const RENEWAL_REMINDER_COOLDOWN_DAYS = 14;

const NEEDS_RENEWAL_TAG = "Needs Renewal";

/**
 * 哪些教室會收到續卡推播——opt-in 白名單，逗號分隔的教室 id。
 *
 * **未設定 = 一間都不開**（fail-closed：部署當下不會突然開始發訊息給學生）。
 * 教室層級的正式開關（`Classroom` 欄位 + 老師端 UI）見 docs/roadmap.md 的 backlog；
 * 在那之前用環境變數，不重新部署就能開關一間教室。
 */
export function enabledClassroomIds(): number[] {
  return (process.env.RENEWAL_REMINDER_CLASSROOM_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export type RenewalCandidate = {
  studentId: number;
  studentName: string;
  classroomId: number;
  lineUserId: string;
  cardName: string;
  studentCardId: number;
};

/**
 * 這一輪該推播的名單（冷卻期內的已剔除）。dry-run 與實跑共用同一份判定。
 */
export async function collectRenewalCandidates(now: Date): Promise<RenewalCandidate[]> {
  const classroomIds = enabledClassroomIds();
  if (classroomIds.length === 0) return [];

  // 預篩：拿「Needs Renewal」tag 當索引。這個 tag 由 refreshNeedsRenewalTag()
  // 在點名／購卡／轉卡時維護，也就是所有會翻轉它的事件，所以拿來縮小範圍是準的；
  // 真正的判定留給下面的逐人複驗。
  // 封存的教室要自己擋掉——cron 沒有 apiRoute 的 membership 檢查幫忙。
  const students = await prisma.student.findMany({
    where: {
      classroomId: { in: classroomIds },
      classroom: { deletedAt: null },
      lineUserId: { not: null },
      studentTags: {
        some: { tag: { name: NEEDS_RENEWAL_TAG } },
      },
    },
    select: { id: true, name: true, classroomId: true, lineUserId: true },
  });
  if (students.length === 0) return [];

  // 冷卻：一次 groupBy 拿到每個人最後一次推播時間，不要在迴圈裡逐人查。
  const cooldownStart = new Date(
    now.getTime() - RENEWAL_REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  );
  const lastSent = await prisma.renewalReminder.groupBy({
    by: ["studentId"],
    where: { studentId: { in: students.map((s) => s.id) } },
    _max: { sentAt: true },
  });
  const inCooldown = new Set(
    lastSent
      .filter((r) => r._max.sentAt !== null && r._max.sentAt > cooldownStart)
      .map((r) => r.studentId),
  );

  const candidates: RenewalCandidate[] = [];
  for (const student of students) {
    if (inCooldown.has(student.id)) continue;
    // 複驗：擋掉 tag 漂移，順便拿到是哪一張卡用完（訊息與紀錄都要）。
    const card = await findExhaustedRenewableCard(student.id);
    if (!card) continue;
    candidates.push({
      studentId: student.id,
      studentName: student.name,
      classroomId: student.classroomId,
      lineUserId: student.lineUserId!,
      cardName: card.card.name,
      studentCardId: card.id,
    });
  }
  return candidates;
}

export type RenewalReminderResult = {
  scanned: number;
  sent: number;
  failed: number;
};

/**
 * 推播並記錄。`pushMessage` 回傳 true 才寫 RenewalReminder——推失敗不該把
 * 冷卻期燒掉，下一輪還要再試。
 *
 * 已知取捨：`Student.lineUserId` 不是 unique，一個 LINE 帳號綁多位學生時會收到
 * 多則。這是對的——每則訊息指名的是哪一位學生要續卡。
 */
export async function sendRenewalReminders(now: Date): Promise<RenewalReminderResult> {
  const candidates = await collectRenewalCandidates(now);
  let sent = 0;
  let failed = 0;

  for (const c of candidates) {
    const ok = await pushMessage(c.lineUserId, [
      buildRenewalReminderFlex({ name: c.studentName, cardName: c.cardName }),
    ]);
    if (!ok) {
      failed += 1;
      continue;
    }
    await prisma.renewalReminder.create({
      data: { studentId: c.studentId, studentCardId: c.studentCardId, sentAt: now },
    });
    sent += 1;
  }

  return { scanned: candidates.length, sent, failed };
}
