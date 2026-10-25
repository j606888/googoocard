"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { formatMoney } from "@/lib/money";
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

// Same key LiffStudentGate remembers the picked student under — cleared on
// every persona switch so one persona's choice doesn't leak into the next.
const LAST_STUDENT_KEY = "liff:lastStudentId";

const StudentBadges = ({ s }: { s: SimStudent }) => (
  <span className="flex flex-wrap gap-1">
    <span
      className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
        s.returning ? "bg-neutral-100 text-neutral-600" : "bg-blue-100 text-blue-800"
      }`}
    >
      {s.returning ? "舊生" : "新學員"}
    </span>
    <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
      可用卡 {s.usableCards}
    </span>
    {s.unpaidAmount > 0 && (
      <span className="rounded-full bg-warning-100 px-1.5 py-0.5 text-[11px] font-bold text-warning-800">
        未付 ${formatMoney(s.unpaidAmount)}
      </span>
    )}
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
  const [page, setPage] = useState<PageKey>("checkin");
  const [newName, setNewName] = useState("新同學");
  const [closed, setClosed] = useState(false);
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

  const open = (next: MockLineUser, nextPage: PageKey = page) => {
    try {
      localStorage.removeItem(LAST_STUDENT_KEY);
    } catch {}
    setPersona(next);
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

  const src = useMemo(() => {
    if (!data) return null;
    return page === "checkin"
      ? `/liff/checkin?key=${encodeURIComponent(data.checkinKey)}`
      : `/liff/${page}`;
  }, [data, page]);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">LINE 模擬器</h1>
        {data && <span className="text-sm text-neutral-500">{data.classroomName}</span>}
        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-800">
          測試環境限定
        </span>
        <button
          type="button"
          onClick={load}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" /> 重新整理身分
        </button>
      </header>

      {error && <p className="p-6 text-center text-neutral-600">{error}</p>}

      {data && (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 lg:flex-row lg:items-start">
          {/* ---------- Personas ---------- */}
          <aside className="flex w-full flex-col gap-4 lg:w-80 lg:shrink-0">
            <section className="flex flex-col gap-2 rounded-xl bg-white p-3">
              <h2 className="font-semibold">全新的 LINE</h2>
              <p className="text-xs text-neutral-500">沒來過的人掃門口 QR → 「第一次來嗎？」</p>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="LINE 顯示名稱"
                  className="min-w-0 flex-1 rounded bg-neutral-100 px-2 py-1.5 text-sm focus:outline-primary-500"
                />
                <button
                  type="button"
                  onClick={() => open({ userId: newMockLineUserId(), name: newName.trim() || "新同學" }, "checkin")}
                  className="rounded-lg bg-primary-700 px-3 py-1.5 text-sm font-medium text-white cursor-pointer"
                >
                  開啟
                </button>
              </div>
            </section>

            <section className="flex flex-col gap-1 rounded-xl bg-white p-3">
              <h2 className="mb-1 font-semibold">已綁 LINE（{data.lineAccounts.length}）</h2>
              {data.lineAccounts.length === 0 && (
                <p className="text-xs text-neutral-500">還沒有。用上面的「全新的 LINE」登記，或從下面模擬綁定。</p>
              )}
              {data.lineAccounts.map((account) => {
                const active = persona?.userId === account.lineUserId;
                return (
                  <button
                    key={account.lineUserId}
                    type="button"
                    onClick={() => open({ userId: account.lineUserId, name: account.students[0].name })}
                    className={`flex flex-col gap-1.5 rounded-lg px-2 py-2 text-left cursor-pointer ${
                      active ? "bg-primary-50 ring-1 ring-primary-300" : "hover:bg-neutral-50"
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
                            {s.name} <span className="font-mono text-xs text-neutral-400">#{s.number}</span>
                          </span>
                          <StudentBadges s={s} />
                        </span>
                      </span>
                    ))}
                  </button>
                );
              })}
            </section>

            <section className="flex flex-col gap-1 rounded-xl bg-white p-3">
              <h2 className="font-semibold">未綁 LINE（{data.unbound.length}）</h2>
              <p className="mb-1 text-xs text-neutral-500">「模擬綁定」＝ 代替傳綁定碼，給他一個測試用的 LINE。</p>
              <ul className="flex max-h-72 flex-col overflow-y-auto">
                {data.unbound.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-2 py-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                    <button
                      type="button"
                      onClick={() => bindUnbound(s)}
                      className="shrink-0 rounded-lg border border-neutral-300 px-2 py-1 text-xs cursor-pointer hover:bg-neutral-50"
                    >
                      模擬綁定
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </aside>

          {/* ---------- Phone ---------- */}
          <main className="flex flex-col items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-white p-1">
              {PAGES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={!persona}
                  onClick={() => persona && open(persona, p.key)}
                  className={`rounded-md px-3 py-1.5 text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                    page === p.key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

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
                  className="rounded p-1 text-neutral-500 hover:bg-neutral-100 cursor-pointer disabled:opacity-40"
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
                    <button
                      type="button"
                      onClick={() => open(persona)}
                      className="rounded-lg bg-primary-700 px-3 py-1.5 font-medium text-white cursor-pointer"
                    >
                      重新開啟
                    </button>
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

          {/* ---------- Teacher side ---------- */}
          <aside className="flex w-full flex-col gap-2 rounded-xl bg-white p-3 text-sm lg:w-64 lg:shrink-0">
            <h2 className="font-semibold">對照老師端</h2>
            <p className="text-xs leading-relaxed text-neutral-500">
              另開分頁看自助簽到、新學員、未付的徽章，點名完成後的「今日收款」，以及待處理的「可能重複」。
            </p>
            <a href="/lessons" target="_blank" className="text-primary-700 underline">
              課程與點名
            </a>
            <a href="/income" target="_blank" className="text-primary-700 underline">
              收入（未付款）
            </a>
            <a href="/students" target="_blank" className="text-primary-700 underline">
              學生（合併、未綁定 LINE）
            </a>
            <a href="/cards" target="_blank" className="text-primary-700 underline">
              課卡（體驗課卡）
            </a>
          </aside>
        </div>
      )}
    </div>
  );
};

export default LineSimulator;
