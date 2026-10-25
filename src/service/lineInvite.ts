import prisma from "@/lib/prisma";
import { bindDeepLink, generateRandomKey } from "@/lib/line";

type BindableStudent = { id: number; lineUserId: string | null; lineBindKey: string | null };

/**
 * A student's LINE binding deep link, creating the one-time `lineBindKey` on
 * first use. Shared by the student-detail copy button and the「未綁定 LINE」
 * invite list so both hand out the same link.
 */
export async function studentBindLink(student: BindableStudent) {
  if (student.lineUserId) return { bound: true as const };

  let key = student.lineBindKey;
  if (!key) {
    key = generateRandomKey();
    await prisma.student.update({ where: { id: student.id }, data: { lineBindKey: key } });
  }
  return { bound: false as const, key, deepLink: bindDeepLink(key) };
}

/** The message a teacher pastes into a LINE chat to invite a student to bind. */
export function lineInviteMessage(studentName: string, deepLink: string) {
  return `${studentName}你好，教室改用 LINE 報到囉！點這個連結、送出訊息綁定一次，之後就能自己簽到、看課卡剩幾堂：\n${deepLink}`;
}
