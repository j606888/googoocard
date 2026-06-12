import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyLineSignature,
  replyMessage,
  buildMenuFlex,
  textMessage,
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
  if (event.type !== "message" || event.message?.type !== "text") return;
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  if (!replyToken || !lineUserId) return;

  // Already a bound teacher? Any message brings up the teacher menu.
  const teacher = await prisma.user.findUnique({ where: { lineUserId } });
  if (teacher) {
    await replyMessage(replyToken, [buildMenuFlex()]);
    return;
  }

  // Already a bound student? Acknowledge for now (student menu TBD).
  const boundStudent = await prisma.student.findUnique({ where: { lineUserId } });
  if (boundStudent) {
    await replyMessage(replyToken, [
      textMessage(`Hi ${boundStudent.name}，你已綁定 googoocard 🎉`),
    ]);
    return;
  }

  // Not bound — treat the message text as a one-time binding key.
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
        buildMenuFlex(),
      ]);
      return;
    }

    const student = await prisma.student.findUnique({ where: { lineBindKey: key } });
    if (student) {
      await prisma.student.update({
        where: { id: student.id },
        data: { lineUserId, lineBindKey: null },
      });
      await replyMessage(replyToken, [
        textMessage(`綁定成功，${student.name}！🎉`),
      ]);
      return;
    }
  }

  await replyMessage(replyToken, [
    textMessage("無法辨識此綁定碼。請使用最新的綁定連結，或聯絡老師。"),
  ]);
}
