"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import StatusTag from "@/components/StatusTag";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";
import ChatPane from "./ChatPane";
import {
  MOCK_CLOSE_MESSAGE,
  MOCK_FRAME_PREFIX,
  newMockLineUserId,
  type MockLineUser,
} from "@/lib/lineMock";

type SimStudent = {
  id: number;
  number: number;
  name: string;
  avatarUrl: string;
  returning: boolean;
  usableCards: number;
  unpaidAmount: number;
};

type SimData = {
  classroomName: string;
  checkinKey: string;
  lineAccounts: { lineUserId: string; students: SimStudent[] }[];
  unbound: SimStudent[];
};

const PAGES = [
  { key: "checkin", label: "自助簽到（門口 QR）" },
  { key: "cards", label: "我的課卡" },
  { key: "buy", label: "買卡" },
] as const;
type PageKey = (typeof PAGES)[number]["key"];
// A LIFF path under /liff — one of PAGES, or anything a chat button opens
// (e.g. "cards?switch=1").
type LiffPath = PageKey | (string & {});

// Same key LiffStudentGate remembers the picked student under — cleared on
// every persona switch so one persona's choice doesn't leak into the next.
const LAST_STUDENT_KEY = "liff:lastStudentId";

const StudentBadges = ({ s }: { s: SimStudent }) => (
  <span className="flex flex-wrap gap-1">
    <StatusTag tone={s.returning ? "neutral" : "positive"}>{s.returning ? "舊生" : "新學員"}</StatusTag>
    <StatusTag tone="neutral">可用卡 {s.usableCards}</StatusTag>
    {s.unpaidAmount > 0 && <StatusTag tone="danger">未付 ${formatMoney(s.unpaidAmount)}</StatusTag>}
  </span>
);

/**
 * /dev/line：左邊挑一個 LINE 身分，中間的「手機」用那個身分打開 LIFF 頁。
 * 手機是 iframe，身分放在 iframe 的 name（src/lib/liffClient.ts 讀它、換成假 LIFF）。
 */
const LineSimulator = () => {
  const [data, setData] = useState<SimData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<MockLineUser | null>(null);
  const [page, setPage] = useState<LiffPath>("checkin");
  const [newName, setNewName] = useState("新同學");
  const [closed, setClosed] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [lessonNote, setLessonNote] = useState<string | null>(null);
  // Bumped to remount the iframe (re-open the LIFF page from scratch).
  const [openCount, setOpenCount] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/dev/line-sim");
    if (!res.ok) {
      setError(res.status === 401 ? "請先登入老師帳號" : "載入失敗");
      return;
    }
    setError(null);
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === MOCK_CLOSE_MESSAGE) setClosed(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const open = (next: MockLineUser, nextPage: LiffPath = page) => {
    try {
      localStorage.removeItem(LAST_STUDENT_KEY);
    } catch {}
    setPersona({ ...next, isFriend });
    setPage(nextPage);
    setClosed(false);
    setOpenCount((n) => n + 1);
  };

  const bindUnbound = async (s: SimStudent) => {
    const res = await fetch("/api/dev/line-sim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: s.id }),
    });
    if (!res.ok) return;
    const { lineUserId } = await res.json();
    await load();
    open({ userId: lineUserId, name: s.name });
  };

  const createTodayLesson = async () => {
    setLessonNote("建立中…");
    const res = await fetch("/api/dev/line-sim/today-lesson", { method: "POST" });
    if (!res.ok) {
      setLessonNote("建立失敗");
      return;
    }
    const lesson: { id: number; name: string } = await res.json();
    setLessonNote(`已建立「${lesson.name}」`);
    if (persona) open(persona);
  };

  const toggleFriend = (next: boolean) => {
    setIsFriend(next);
    if (persona) {
      setPersona({ ...persona, isFriend: next });
      setClosed(false);
      setOpenCount((n) => n + 1);
    }
  };

  const src = useMemo(() => {
    if (!data) return null;
    // Self check-in is opened from the wall QR, which carries the classroom key.
    return page === "checkin"
      ? `/liff/checkin?key=${encodeURIComponent(data.checkinKey)}`
      : `/liff/${page}`;
  }, [data, page]);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">LINE 模擬器</h1>
        {data && <span className="text-sm text-neutral-500">{data.classroomName}</span>}
        <StatusTag tone="warning">測試環境限定</StatusTag>
        <Button type="button" variant="ghost" size="sm" onClick={load} className="ml-auto text-neutral-600">
          <RefreshCw className="h-4 w-4" /> 重新整理身分
        </Button>
      </header>

      {error && <p className="p-6 text-center text-neutral-600">{error}</p>}

      {data && (
        <div className="mx-auto flex max-w-[1600px] flex-col flex-wrap gap-6 p-4 lg:flex-row lg:items-start">
          {/* ---------- Personas ---------- */}
          <aside className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
            <section className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3">
              <h2 className="font-semibold">全新的 LINE</h2>
              <p className="text-xs text-neutral-500">沒來過的人掃門口 QR → 「第一次來嗎？」</p>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="LINE 顯示名稱"
                  aria-label="LINE 顯示名稱"
                  className={cn(fieldControlClass(), "h-9 min-w-0 flex-1 rounded-lg px-3 text-sm")}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => open({ userId: newMockLineUserId(), name: newName.trim() || "新同學" }, "checkin")}
                >
                  開啟
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-3">
              <h2 className="mb-1 font-semibold">已綁 LINE（{data.lineAccounts.length}）</h2>
              {data.lineAccounts.length === 0 && (
                <EmptyState kind="inline" title="還沒有。" description="用上面的「全新的 LINE」登記，或從下面模擬綁定。" />
              )}
              {data.lineAccounts.map((account) => {
                const active = persona?.userId === account.lineUserId;
                return (
                  <button
                    key={account.lineUserId}
                    type="button"
                    onClick={() => open({ userId: account.lineUserId, name: account.students[0].name })}
                    className={`flex flex-col gap-1.5 rounded-xl px-2 py-2 text-left cursor-pointer ${
                      active ? "bg-primary-100 ring-1 ring-primary-300" : "hover:bg-neutral-50"
                    }`}
                  >
                    {account.students.length > 1 && (
                      <span className="text-[11px] text-neutral-500">同一個 LINE 綁了 {account.students.length} 位</span>
                    )}
                    {account.students.map((s) => (
                      <span key={s.id} className="flex items-start gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-sm font-medium">
                            {s.name} <span className="font-mono text-xs text-neutral-500">#{s.number}</span>
                          </span>
                          <StudentBadges s={s} />
                        </span>
                      </span>
                    ))}
                  </button>
                );
              })}
            </section>

            <section className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-3">
              <h2 className="font-semibold">未綁 LINE（{data.unbound.length}）</h2>
              <p className="mb-1 text-xs text-neutral-500">「模擬綁定」＝ 代替傳綁定碼，給他一個測試用的 LINE。</p>
              <ul className="flex max-h-72 flex-col overflow-y-auto">
                {data.unbound.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-2 py-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => bindUnbound(s)}
                      className="shrink-0 px-2.5 text-xs"
                    >
                      模擬綁定
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          </aside>

          {/* ---------- Phone ---------- */}
          <main className="flex flex-col items-center gap-3">
            <div className="flex gap-1 rounded-xl bg-white p-1">
              {PAGES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={!persona}
                  onClick={() => persona && open(persona, p.key)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                    page.split("?")[0] === p.key
                      ? "bg-primary-900 font-semibold text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={isFriend}
                onChange={(e) => toggleFriend(e.target.checked)}
                className="h-4 w-4 accent-primary-700"
              />
              這個 LINE 已加官方帳號好友（關掉可看簽到完成後的「加好友」提示）
            </label>

            <div className="overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-white shadow-xl">
              {/* LINE's LIFF header bar */}
              <div className="flex h-11 w-[375px] items-center gap-2 border-b border-neutral-200 bg-white px-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {persona ? `googoocard · ${persona.name}` : "googoocard"}
                </span>
                <button
                  type="button"
                  aria-label="關閉"
                  disabled={!persona}
                  onClick={() => setClosed(true)}
                  className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 cursor-pointer disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative h-[720px] w-[375px]">
                {!persona && (
                  <p className="flex h-full items-center justify-center px-8 text-center text-sm text-neutral-500">
                    從左邊挑一個 LINE 身分
                  </p>
                )}
                {persona && closed && (
                  <div className="flex h-full flex-col items-center justify-center gap-3 bg-neutral-50 text-sm text-neutral-600">
                    <p>LIFF 視窗已關閉</p>
                    <Button type="button" size="sm" onClick={() => open(persona)}>
                      重新開啟
                    </Button>
                  </div>
                )}
                {persona && !closed && src && (
                  <iframe
                    key={openCount}
                    // liffClient reads this to swap in the fake LIFF for this persona.
                    name={MOCK_FRAME_PREFIX + JSON.stringify(persona)}
                    src={src}
                    title="LIFF"
                    className="h-full w-full"
                    onLoad={load}
                  />
                )}
              </div>
            </div>
          </main>

          {/* ---------- Chat with the official account ---------- */}
          <section className="flex flex-col items-center gap-3">
            <p className="flex h-[38px] items-center text-sm font-medium text-neutral-600">聊天室（Rich Menu）</p>
            {persona ? (
              <ChatPane key={persona.userId} persona={persona} onOpenLiff={(path) => open(persona, path)} />
            ) : (
              <p className="w-[395px] rounded-2xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500">
                從左邊挑一個 LINE 身分
              </p>
            )}
          </section>

          {/* ---------- Teacher side ---------- */}
          <aside className="flex w-full flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-sm lg:w-64 lg:shrink-0">
            <h2 className="font-semibold">測試資料</h2>
            <p className="text-xs leading-relaxed text-neutral-500">
              一堂今天的課：這個整點起兩個時段，掛一般卡和體驗課卡（沒有就建測試卡）。
            </p>
            <Button type="button" size="sm" onClick={createTodayLesson}>
              建一堂今天的測試課
            </Button>
            {lessonNote && <p className="text-xs text-neutral-600">{lessonNote}</p>}

            <h2 className="mt-3 font-semibold">對照老師端</h2>
            <p className="text-xs leading-relaxed text-neutral-500">
              另開分頁看自助簽到、新學員、未付的徽章，點名完成後的「今日收款」，以及待處理的「可能重複」。
            </p>
            <a href="/lessons" target="_blank" className="text-primary-700 underline-offset-4 hover:underline">
              課程與點名
            </a>
            <a href="/income" target="_blank" className="text-primary-700 underline-offset-4 hover:underline">
              收入（未付款）
            </a>
            <a href="/students" target="_blank" className="text-primary-700 underline-offset-4 hover:underline">
              學生（合併、未綁定 LINE）
            </a>
            <a href="/cards" target="_blank" className="text-primary-700 underline-offset-4 hover:underline">
              課卡（體驗課卡）
            </a>
          </aside>
        </div>
      )}
    </div>
  );
};

export default LineSimulator;
