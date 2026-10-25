import { z } from "zod";
import { apiRoute, parseBody } from "@/lib/apiRoute";
import { notFound } from "@/lib/apiError";
import { isLineMockEnabled } from "@/lib/lineMock";
import type { LineMessage } from "@/lib/line";
import { handleLineEvent } from "@/service/lineBot";

const schema = z
  .object({
    lineUserId: z.string().min(1),
    text: z.string().optional(),
    postback: z.string().optional(),
  })
  .refine((b) => (b.text === undefined) !== (b.postback === undefined), "text or postback");

// LINE 模擬器的聊天室：把一則文字或 postback 交給真正的 bot（src/service/lineBot.ts），
// 回覆收下來直接回傳，不打 LINE API。只在模擬模式開放。
export const POST = apiRoute(async ({ request }) => {
  if (!isLineMockEnabled()) throw notFound("Route");
  const { lineUserId, text, postback } = await parseBody(request, schema);

  const messages: LineMessage[] = [];
  const source = { type: "user", userId: lineUserId };
  const event =
    postback !== undefined
      ? { type: "postback", replyToken: "sim", source, postback: { data: postback } }
      : { type: "message", replyToken: "sim", source, message: { type: "text", id: "sim", text } };
  await handleLineEvent(event, async (reply) => {
    messages.push(...reply);
  });
  return { messages };
});
