import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature, replyMessage, type LineWebhookEvent } from "@/lib/line";
import { handleLineEvent } from "@/service/lineBot";

// LINE's webhook verification (and real events) are POST requests.
// We must read the RAW body to validate the signature, so no JSON parsing first.
// What each event does lives in src/service/lineBot.ts.
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
  await Promise.all(
    events.map((event) =>
      event.replyToken
        ? handleLineEvent(event, (messages) => replyMessage(event.replyToken!, messages))
        : Promise.resolve()
    )
  );

  return NextResponse.json({ ok: true });
}
