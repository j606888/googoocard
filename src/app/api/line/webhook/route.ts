import { NextRequest, NextResponse } from "next/server";
import { LineMenuMode } from "@prisma/client";
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

/** Remembered default menu (老師/學生) for accounts bound to both. */
async function getMenuMode(lineUserId: string): Promise<LineMenuMode> {
  const account = await prisma.lineAccount.findUnique({ where: { lineUserId } });
  return account?.menuMode ?? LineMenuMode.TEACHER;
}
async function setMenuMode(lineUserId: string, menuMode: LineMenuMode): Promise<void> {
  await prisma.lineAccount.upsert({
    where: { lineUserId },
    update: { menuMode },
    create: { lineUserId, menuMode },
  });
}
/** Remember which student this account last selected (in LIFF or on bind). */
async function setSelectedStudent(lineUserId: string, selectedStudentId: number): Promise<void> {
  await prisma.lineAccount.upsert({
    where: { lineUserId },
    update: { selectedStudentId },
    create: { lineUserId, selectedStudentId },
  });
}
/**
 * The student to show in the menu: the account's LIFF-selected student when it's
 * still bound here, otherwise the first bound student (stable by id).
 */
async function currentStudent(lineUserId: string) {
  const account = await prisma.lineAccount.findUnique({ where: { lineUserId } });
  if (account?.selectedStudentId != null) {
    const selected = await prisma.student.findFirst({
      where: { id: account.selectedStudentId, lineUserId },
    });
    if (selected) return selected;
  }
  return prisma.student.findFirst({ where: { lineUserId }, orderBy: { id: "asc" } });
}

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
      await setMenuMode(lineUserId, LineMenuMode.TEACHER);
      await replyMessage(replyToken, [
        textMessage(`綁定成功，${user.name}！傳任何訊息即可叫出選單。`),
        buildMenuFlex({ showSwitch: await isStudent(lineUserId) }),
      ]);
      return;
    }

    const student = await prisma.student.findUnique({ where: { lineBindKey: key } });
    if (student) {
      // One LINE account can bind multiple students across DIFFERENT classrooms,
      // but only one per classroom. If this account already has another student
      // in the same classroom, auto-rebind: release the old one, bind the new.
      // Consuming the one-time lineBindKey keeps re-sending the same key idempotent.
      const previous = await prisma.student.findFirst({
        where: { lineUserId, classroomId: student.classroomId, id: { not: student.id } },
      });
      if (previous) {
        await prisma.student.update({
          where: { id: previous.id },
          data: { lineUserId: null },
        });
      }
      await prisma.student.update({
        where: { id: student.id },
        data: { lineUserId, lineBindKey: null },
      });
      await setMenuMode(lineUserId, LineMenuMode.STUDENT);
      await setSelectedStudent(lineUserId, student.id);
      await replyMessage(replyToken, [
        textMessage(
          previous
            ? `綁定成功，已將本教室的綁定從「${previous.name}」切換為「${student.name}」！🎉`
            : `綁定成功，${student.name}！🎉`,
        ),
        buildStudentMenuFlex({
          name: student.name,
          showSwitch: await isTeacher(lineUserId),
          showStudentSwitch: (await prisma.student.count({ where: { lineUserId } })) > 1,
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
 * null to pick the default. For accounts bound to BOTH a teacher and a student,
 * the default follows the remembered `menuMode` (set on switch / bind) so a
 * switch to the student menu sticks across messages. Each menu exposes a switch
 * button only when the account holds the other identity; the student menu also
 * offers「切換學生」when the account is bound to more than one student.
 */
async function sendMenu(
  replyToken: string,
  lineUserId: string,
  requested: string | null,
): Promise<void> {
  // A LINE account may be bound to multiple students (across classrooms). The
  // flex menu reflects one student for the title; real multi-student switching
  // happens in LIFF via the「切換學生」button.
  const [teacher, student, studentCount] = await Promise.all([
    prisma.user.findUnique({ where: { lineUserId } }),
    currentStudent(lineUserId),
    prisma.student.count({ where: { lineUserId } }),
  ]);
  const isBoth = !!teacher && !!student;
  const studentMenu = () =>
    buildStudentMenuFlex({
      name: student!.name,
      showSwitch: isBoth,
      showStudentSwitch: studentCount > 1,
    });

  if (requested === SWITCH_TO_STUDENT && student) {
    await setMenuMode(lineUserId, LineMenuMode.STUDENT);
    await replyMessage(replyToken, [studentMenu()]);
    return;
  }
  if (requested === SWITCH_TO_TEACHER && teacher) {
    await setMenuMode(lineUserId, LineMenuMode.TEACHER);
    await replyMessage(replyToken, [buildMenuFlex({ showSwitch: isBoth })]);
    return;
  }

  // Default: for both-bound accounts follow the remembered mode; otherwise the
  // only identity they have.
  if (isBoth) {
    const mode = await getMenuMode(lineUserId);
    await replyMessage(replyToken, [
      mode === LineMenuMode.STUDENT ? studentMenu() : buildMenuFlex({ showSwitch: true }),
    ]);
    return;
  }
  if (teacher) {
    await replyMessage(replyToken, [buildMenuFlex({ showSwitch: false })]);
    return;
  }
  if (student) {
    await replyMessage(replyToken, [studentMenu()]);
    return;
  }

  await replyMessage(replyToken, [
    textMessage("無法辨識此綁定碼。請使用最新的綁定連結，或聯絡老師。"),
  ]);
}
