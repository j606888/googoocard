import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyLineSignature,
  replyMessage,
  buildMenuFlex,
  buildStudentMenuFlex,
  textMessage,
  SWITCH_TO_STUDENT,
  SWITCH_TO_TEACHER,
  type LineWebhookEvent,
} from "@/lib/line";

// LINE's webhook verification (and real events) are POST requests.
// We must read the RAW body to validate the signature, so no JSON parsing first.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    console.warn("[line] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: LineWebhookEvent[] = [];
  try {
    events = JSON.parse(rawBody).events ?? [];
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // The console "Verify" button sends an empty events array — just 200 it.
  await Promise.all(events.map(handleEvent));

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineWebhookEvent): Promise<void> {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  if (!replyToken || !lineUserId) return;

  // Menu identity-switch buttons send a postback instead of a chat message.
  if (event.type === "postback") {
    await sendMenu(replyToken, lineUserId, event.postback?.data ?? null);
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") return;

  // A binding key always takes priority, even if this LINE account is already
  // bound to something else. Teacher and student bindings live on separate
  // tables (User.lineUserId / Student.lineUserId), so one LINE account can be
  // both — e.g. a teacher binding their own student profile via the link.
  const key = event.message.text?.trim() ?? "";
  if (key) {
    const user = await prisma.user.findUnique({ where: { randomKey: key } });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lineUserId, randomKey: null },
      });
      await replyMessage(replyToken, [
        textMessage(`綁定成功，${user.name}！傳任何訊息即可叫出選單。`),
        buildMenuFlex({ showSwitch: await isStudent(lineUserId) }),
      ]);
      return;
    }

    const student = await prisma.student.findUnique({ where: { lineBindKey: key } });
    if (student) {
      // One LINE account can bind multiple students (different classrooms), so
      // binding another one is allowed. Consuming the one-time lineBindKey makes
      // re-sending the same key idempotent.
      await prisma.student.update({
        where: { id: student.id },
        data: { lineUserId, lineBindKey: null },
      });
      await replyMessage(replyToken, [
        textMessage(`綁定成功，${student.name}！🎉`),
        buildStudentMenuFlex({
          name: student.name,
          showSwitch: await isTeacher(lineUserId),
        }),
      ]);
      return;
    }
  }

  // Not a binding key — show the menu for whatever this account is bound to.
  await sendMenu(replyToken, lineUserId, null);
}

async function isTeacher(lineUserId: string): Promise<boolean> {
  return (await prisma.user.findUnique({ where: { lineUserId } })) !== null;
}

async function isStudent(lineUserId: string): Promise<boolean> {
  return (await prisma.student.findFirst({ where: { lineUserId } })) !== null;
}

/**
 * Reply with the appropriate menu. `requested` is a switch postback value, or
 * null to pick the default (teacher menu wins when an account is both). Each
 * menu exposes a switch button only when the account holds the other identity.
 */
async function sendMenu(
  replyToken: string,
  lineUserId: string,
  requested: string | null,
): Promise<void> {
  // A LINE account may be bound to multiple students (across classrooms). The
  // flex menu is a stopgap before the Rich Menu + LIFF identity picker, so it
  // just reflects the first student; LIFF handles real multi-student switching.
  const [teacher, student] = await Promise.all([
    prisma.user.findUnique({ where: { lineUserId } }),
    prisma.student.findFirst({ where: { lineUserId } }),
  ]);
  const isBoth = !!teacher && !!student;

  if (requested === SWITCH_TO_STUDENT && student) {
    await replyMessage(replyToken, [
      buildStudentMenuFlex({ name: student.name, showSwitch: isBoth }),
    ]);
    return;
  }
  if (requested === SWITCH_TO_TEACHER && teacher) {
    await replyMessage(replyToken, [buildMenuFlex({ showSwitch: isBoth })]);
    return;
  }

  // Default: teacher menu wins, student menu otherwise.
  if (teacher) {
    await replyMessage(replyToken, [buildMenuFlex({ showSwitch: isBoth })]);
    return;
  }
  if (student) {
    await replyMessage(replyToken, [
      buildStudentMenuFlex({ name: student.name, showSwitch: false }),
    ]);
    return;
  }

  await replyMessage(replyToken, [
    textMessage("無法辨識此綁定碼。請使用最新的綁定連結，或聯絡老師。"),
  ]);
}
