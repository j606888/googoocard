"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { MockLineUser } from "@/lib/lineMock";
import { RICH_MENU, RICH_MENU_IMAGE, type RichMenuArea } from "@/lib/lineRichMenu";
import { BotMessage, quickRepliesOf, type FlexAction, type FlexNode } from "./FlexPreview";

type Entry = { from: "me"; text: string } | { from: "bot"; message: FlexNode };

// A LIFF deep link (liff.line.me/<id>/<path>) or a plain /liff/<path> URL → <path>.
const liffPathOf = (uri: string) => uri.match(/liff\.line\.me\/[^/]+\/(.+)$/)?.[1] ?? uri.match(/\/liff\/(.+)$/)?.[1] ?? null;

/**
 * 模擬器的聊天室：跟官方帳號的對話。訊息與 postback 交給真正的 bot
 * （/api/dev/line-sim/bot → src/service/lineBot.ts）；下方是 Rich Menu，點 LIFF 的格子
 * 等於在旁邊那支手機打開 LIFF 頁。
 */
const ChatPane = ({ persona, onOpenLiff }: { persona: MockLineUser; onOpenLiff: (path: string) => void }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  const send = async (shown: string | null, payload: { text: string } | { postback: string }) => {
    if (shown) setEntries((prev) => [...prev, { from: "me", text: shown }]);
    setBusy(true);
    try {
      const res = await fetch("/api/dev/line-sim/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId: persona.userId, ...payload }),
      });
      const { messages = [] } = res.ok ? await res.json() : { messages: [{ type: "text", text: `（bot 錯誤 ${res.status}）` }] };
      setEntries((prev) => [...prev, ...messages.map((message: FlexNode) => ({ from: "bot" as const, message }))]);
    } finally {
      setBusy(false);
    }
  };

  const onAction = (action: FlexAction) => {
    if (action.type === "postback" && action.data) {
      send(action.displayText ?? null, { postback: action.data });
    } else if (action.type === "message" && action.text) {
      send(action.text, { text: action.text });
    } else if (action.type === "uri" && action.uri) {
      const path = liffPathOf(action.uri);
      if (path) onOpenLiff(path);
      else window.open(action.uri, "_blank", "noopener");
    }
  };

  const tapArea = (area: RichMenuArea) => {
    const [kind, target] = area.action.split(":");
    if (kind === "liff") onOpenLiff(target);
    else send(area.label, { postback: `a=${target}` });
  };

  const lastBot = [...entries].reverse().find((e) => e.from === "bot") as { message: FlexNode } | undefined;
  const lastIsBot = entries.at(-1)?.from === "bot";
  const chips = lastIsBot ? quickRepliesOf(lastBot?.message) : [];
  const { width, height } = RICH_MENU.size;

  return (
    <div className="overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-white shadow-xl">
      <div className="flex h-11 w-[375px] items-center border-b border-neutral-200 bg-white px-4">
        <span className="text-sm font-semibold">Googoocard</span>
        <span className="ml-2 text-xs text-neutral-400">官方帳號 · {persona.name}</span>
      </div>
      <div className="flex h-[720px] w-[375px] flex-col bg-[#8cabd9]/25">
        <div ref={scroller} className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
          {entries.length === 0 && (
            <p className="mt-6 text-center text-xs text-neutral-500">點下方選單，或傳「課表」「價目表」「我的課卡」</p>
          )}
          {entries.map((entry, i) =>
            entry.from === "me" ? (
              <div key={i} className="max-w-[80%] self-end rounded-2xl rounded-tr-sm bg-[#06c755] px-3 py-2 text-sm text-white">
                {entry.text}
              </div>
            ) : (
              <div key={i} className="self-start">
                <BotMessage message={entry.message} onAction={onAction} />
              </div>
            )
          )}
          {busy && <p className="text-xs text-neutral-400">…</p>}
        </div>

        {chips.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-2">
            {chips.map((chip, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onAction(chip)}
                className="shrink-0 rounded-full border border-[#06c755] bg-white px-3 py-1 text-xs font-medium text-[#06c755] cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex items-center gap-2 border-t border-neutral-200 bg-white px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            setDraft("");
            send(text, { text });
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="輸入訊息（也可以貼綁定碼）"
            className="min-w-0 flex-1 rounded-full bg-neutral-100 px-3 py-1.5 text-sm focus:outline-primary-500"
          />
          <button type="submit" aria-label="傳送" className="text-[#06c755] cursor-pointer disabled:opacity-40" disabled={busy}>
            <Send className="h-5 w-5" />
          </button>
        </form>

        {/* Rich menu: the real image with tappable areas over it. */}
        {menuOpen && (
          <div className="relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RICH_MENU_IMAGE} alt="Rich Menu" className="absolute inset-0 h-full w-full" />
            {RICH_MENU.areas.map((area) => (
              <button
                key={area.action}
                type="button"
                aria-label={area.label}
                onClick={() => tapArea(area)}
                className="absolute cursor-pointer hover:bg-black/5"
                style={{
                  left: `${(area.bounds.x / width) * 100}%`,
                  top: `${(area.bounds.y / height) * 100}%`,
                  width: `${(area.bounds.width / width) * 100}%`,
                  height: `${(area.bounds.height / height) * 100}%`,
                }}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="border-t border-neutral-200 bg-white py-1.5 text-xs text-neutral-600 cursor-pointer"
        >
          {RICH_MENU.chatBarText} {menuOpen ? "▾" : "▴"}
        </button>
      </div>
    </div>
  );
};

export default ChatPane;
