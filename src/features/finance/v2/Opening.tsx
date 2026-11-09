"use client";

// 開帳（docs/finance-v2/04 §3；feedback 07 #12）：在開帳精靈裡是第 7–9 步（期初現金 → 還沒付的錢 → 預覽並開帳）。
// 三步填的東西（轉換日、現金算法、實際金額、還沒付的錢）是同一份草稿，放在 OpeningDraftProvider，
// 存到 sessionStorage（重新整理不會不見），最後按「開帳」才一次送出（POST /finance/opening）。
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Select from "@/components/Select";
import { fieldControlClass } from "@/components/Field";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoTip from "@/components/InfoTip";
import { cn } from "@/lib/utils";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { useGetLocationsQuery } from "@/store/slices/locations";
import {
  useGetFinanceSettingsQuery,
  useGetFinanceTeachersQuery,
  useGetFinanceVenuesQuery,
  useReassignStrayReceiversMutation,
  useRestoreStrayReceiversMutation,
} from "@/store/slices/finance";
import {
  useGetMoneyAccountsQuery,
  useGetOpeningQuery,
  useOpenLedgerMutation,
  usePreviewOpeningMutation,
  type MoneyAccountView,
  type OpeningPreviewView,
  type OpeningState,
} from "@/store/slices/ledger";
import type { OpeningParams } from "@/service/ledger/opening";
import { financeErrorText, todayKey } from "../financeUi";
import { useFinanceRole } from "../useCanSettle";
import { AddAccountDrawer } from "./Accounts";
import { Amount, FinanceCard, FinanceShell, useIsOwner } from "./ui";

type Payable = OpeningParams["payables"][number];
type Method = OpeningParams["method"];
type PreviewCard = OpeningPreviewView["cards"][number];

/** 開帳草稿。`visited`：第 6、7 步看過了沒（精靈左側打勾用；伺服器只知道開帳了沒）。 */
export type OpeningDraft = {
  date: string;
  method: Method;
  cash: Record<number, string>;
  payables: Payable[];
  visited: { cash?: boolean; payables?: boolean };
};

type Ctx = {
  draft: OpeningDraft | null;
  update: (patch: Partial<OpeningDraft>) => void;
  setPayables: (f: (p: Payable[]) => Payable[]) => void;
  markVisited: (k: "cash" | "payables") => void;
  clear: () => void;
  state: OpeningState | undefined;
  params: OpeningParams | null;
  result: OpeningPreviewView | null;
  previewing: boolean;
  refresh: () => void;
  /** 有用到試算結果的畫面掛上這個，草稿一改就自動重算（不必每一步都算）。 */
  watch: () => () => void;
};

const OpeningCtx = createContext<Ctx | null>(null);

function useOpening(): Ctx {
  const c = useContext(OpeningCtx);
  if (!c) throw new Error("useOpening must be inside <OpeningDraftProvider>");
  return c;
}

/** 精靈左側用：草稿（還沒載入是 null）＋把第 6、7 步標成看過。 */
export function useOpeningDraft(): { draft: OpeningDraft | null; markVisited: (k: "cash" | "payables") => void } {
  const c = useOpening();
  return { draft: c.draft, markVisited: c.markVisited };
}

const storageKey = (classroomId: number) => `finance-opening-draft:${classroomId}`;

function readStored(key: string): OpeningDraft | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as OpeningDraft) : null;
  } catch {
    return null;
  }
}

export function OpeningDraftProvider({ children }: { children: ReactNode }) {
  const { data: classrooms } = useGetClassroomsQuery();
  const classroomId = classrooms?.currentClassroomId ?? null;
  const { data: state } = useGetOpeningQuery();
  const { data: maData } = useGetMoneyAccountsQuery();
  const [preview, pv] = usePreviewOpeningMutation();
  const [draft, setDraft] = useState<OpeningDraft | null>(null);
  const [result, setResult] = useState<OpeningPreviewView | null>(null);
  const [watchers, setWatchers] = useState(0);

  // 第一次：sessionStorage 有草稿就接著用，否則已開過帳帶入上次的參數，再不然用建議日。
  useEffect(() => {
    if (draft || !state || classroomId == null) return;
    const stored = readStored(storageKey(classroomId));
    if (stored) return setDraft(stored);
    const p = state.params;
    setDraft({
      date: p?.conversionDate ?? state.suggestedDate ?? todayKey(),
      method: p?.method ?? "CONVENTION",
      cash: Object.fromEntries((p?.cash ?? []).map((c) => [c.moneyAccountId, String(c.amount)])),
      payables: p?.payables ?? [],
      visited: {},
    });
  }, [draft, state, classroomId]);

  useEffect(() => {
    if (!draft || classroomId == null) return;
    try {
      window.sessionStorage.setItem(storageKey(classroomId), JSON.stringify(draft));
    } catch {
      // 無痕模式等存不了：只是重新整理會不見，不影響開帳。
    }
  }, [draft, classroomId]);

  const accounts = useMemo(() => (maData?.accounts ?? []).filter((a) => !a.archivedAt), [maData]);
  const params = useMemo<OpeningParams | null>(
    () =>
      draft?.date
        ? {
            conversionDate: draft.date,
            method: draft.method,
            cash: draft.method === "ACTUAL" ? accounts.map((a) => ({ moneyAccountId: a.id, amount: Number(draft.cash[a.id] || 0) })) : [],
            payables: draft.payables.filter((p) => p.amount !== 0 && p.partyId && p.locationId),
          }
        : null,
    [draft, accounts],
  );

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const refresh = useCallback(async () => {
    const p = paramsRef.current;
    if (!p) return;
    try {
      setResult(await preview(p).unwrap());
    } catch (e) {
      toast.error(financeErrorText(e, "試算失敗"));
    }
  }, [preview]);

  // 草稿改了就重算（稍等一下，打字時不會每個字都算）
  const key = params ? JSON.stringify(params) : "";
  useEffect(() => {
    if (!key || watchers === 0) return;
    const t = setTimeout(refresh, 400);
    return () => clearTimeout(t);
  }, [key, watchers, refresh]);

  const watch = useCallback(() => {
    setWatchers((n) => n + 1);
    return () => setWatchers((n) => n - 1);
  }, []);

  const update = useCallback((patch: Partial<OpeningDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d)), []);
  const value: Ctx = {
    draft,
    update,
    setPayables: (f) => setDraft((d) => (d ? { ...d, payables: f(d.payables) } : d)),
    markVisited: (k) => setDraft((d) => (d && !d.visited[k] ? { ...d, visited: { ...d.visited, [k]: true } } : d)),
    clear: () => {
      try {
        if (classroomId != null) window.sessionStorage.removeItem(storageKey(classroomId));
      } catch {
        // ignore
      }
    },
    state,
    params,
    result,
    previewing: pv.isLoading,
    refresh,
    watch,
  };
  return <OpeningCtx.Provider value={value}>{children}</OpeningCtx.Provider>;
}

function useWatchPreview() {
  const { watch } = useOpening();
  useEffect(() => watch(), [watch]);
}

/** /finance/opening：開帳後要換一天重開時用；第一次開帳走 /finance/setup 精靈的第 7–9 步。三步排成一頁。 */
export default function Opening() {
  const { data: state } = useGetOpeningQuery();
  return (
    <FinanceShell title={state?.opened ? "重新開帳" : "開帳"} guide="opening" crumb={{ href: "/finance/settings", label: "財務設定" }}>
      <OpeningDraftProvider>
        <div className="flex max-w-3xl flex-col gap-8">
          <Section title="期初現金"><OpeningCashStep /></Section>
          <Section title="還沒付的錢"><OpeningPayablesStep /></Section>
          <Section title="預覽並開帳"><OpeningConfirmStep /></Section>
        </div>
      </OpeningDraftProvider>
    </FinanceShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

function Locked({ lockDate }: { lockDate: string }) {
  return (
    <FinanceCard className="px-5 py-5 text-sm text-neutral-600">
      已經鎖帳（{lockDate.replaceAll("-", "/")}），不能再重開。期初錯了請用手動分錄更正。
    </FinanceCard>
  );
}

/* ───────── 第 6 步：期初現金 ───────── */

function firstOfMonth(today: string, plus: number) {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + plus, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function OpeningCashStep() {
  useWatchPreview();
  const { draft, update, state, result, refresh } = useOpening();
  const { data: maData } = useGetMoneyAccountsQuery();
  const { data: locData } = useGetLocationsQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const [addFor, setAddFor] = useState<number | null>(null);
  const [openUser, setOpenUser] = useState<number | null>(null);
  const { canSettle } = useFinanceRole();
  const [reassign, reassigning] = useReassignStrayReceiversMutation();
  const [restore, restoring] = useRestoreStrayReceiversMutation();

  if (!draft || !state) return <Skeleton className="h-72 rounded-2xl" />;
  if (state.lockDate) return <Locked lockDate={state.lockDate} />;

  const accounts = (maData?.accounts ?? []).filter((a) => !a.archivedAt);
  const locName = (id: number) => locData?.locations.find((l) => l.id === id)?.name ?? "";
  const userName = (id: number) => settings?.members.find((m) => m.userId === id)?.name ?? `#${id}`;
  const missing = (result?.errors ?? []).filter((e) => e.code === "NO_MONEY_ACCOUNT" && e.userId !== undefined);
  const cards = result?.cards ?? [];
  const custodians = (settings?.members ?? []).filter((m) => m.isCustodian);
  const custodianOptions = custodians.map((m) => ({ value: m.userId, label: m.name }));
  // 舊卡的錢其實已經交給另一位保管人（例：丁丁收的交給 Sean）→ 改記到他名下，鎖帳前都能復原
  const canMove = canSettle && draft.method === "CONVENTION" && custodians.length > 1;
  const busy = reassigning.isLoading || restoring.isLoading;
  const undo = async (cardIds: number[]) => {
    try {
      await restore({ cardIds, dropInIds: [] }).unwrap();
      refresh();
      toast.success("已復原");
    } catch (e) {
      toast.error(financeErrorText(e, "復原失敗"));
    }
  };
  const move = async (cardIds: number[], toUserId: number) => {
    if (cardIds.length === 0) return;
    try {
      const r = await reassign({ moves: [{ toUserId, cardIds, dropInIds: [] }], conversionDate: draft.date }).unwrap();
      refresh();
      toast.success(`已把 ${r.cards} 張舊卡的錢改記到 ${userName(toUserId)} 名下`, {
        action: { label: "復原", onClick: () => void undo(cardIds) },
      });
    } catch (e) {
      toast.error(financeErrorText(e, "改記失敗"));
    }
  };

  // 每個人：名下的資金帳戶＋算在他手上的舊卡
  const people = [...new Set([...accounts.map((a) => a.holderUserId), ...cards.flatMap((c) => (c.holderUserId != null ? [c.holderUserId] : []))])];
  const today = todayKey();
  const quick = [
    { label: "今天", value: today },
    { label: "這個月 1 號", value: firstOfMonth(today, 0) },
    { label: "下個月 1 號", value: firstOfMonth(today, 1) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FinanceCard className="flex flex-col gap-3 px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold text-neutral-900">轉換日：帳本從哪天開始記</span>
          <span className="text-[13px] text-neutral-500">這天（含）以後的事記進帳本，之前的結果算成期初。</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quick.map((q) => (
            <Button
              key={q.label}
              size="sm"
              variant={draft.date === q.value ? "primary" : "secondary"}
              aria-pressed={draft.date === q.value}
              onClick={() => update({ date: q.value })}
            >
              {q.label}
            </Button>
          ))}
          <input aria-label="轉換日（自己選一天）" type="date" value={draft.date} onChange={(e) => update({ date: e.target.value })} className={cn(fieldControlClass(), "h-10 w-44 px-3 text-sm")} />
        </div>
      </FinanceCard>

      <FinanceCard className="flex flex-col gap-3 px-4 py-4 lg:px-5">
        <span className="text-[15px] font-semibold text-neutral-900">那天每個人手上的教室的錢怎麼算</span>
        <div role="radiogroup" aria-label="期初現金怎麼算" className="grid gap-2 sm:grid-cols-2">
          <MethodOption
            checked={draft.method === "CONVENTION"}
            onPick={() => update({ method: "CONVENTION" })}
            title="系統幫我算"
            body="舊卡還沒上完的錢，算在當初收錢的人手上。不用數錢。"
          />
          <MethodOption
            checked={draft.method === "ACTUAL"}
            onPick={() => update({ method: "ACTUAL" })}
            title="我自己填實際金額"
            body="每個帳戶填那天實際有多少；跟舊卡的差額會算進分部公積金（可能是負的）。"
          />
        </div>
      </FinanceCard>

      {missing.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-warning-50 px-4 py-3">
          <span className="text-sm font-semibold text-warning-950">這些人收過錢，但還沒有資金帳戶</span>
          {missing.map((e) => (
            <div key={e.userId} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1">{userName(e.userId!)} · {e.cardIds?.length ?? 0} 張卡</span>
              <Button size="sm" variant="secondary" onClick={() => setAddFor(e.userId!)}>建帳戶</Button>
            </div>
          ))}
          <span className="text-[13px] text-warning-950">要先在財務設定把他勾成保管人。</span>
        </div>
      )}

      <FinanceCard className="overflow-hidden">
        {people.length === 0 && <p className="px-5 py-4 text-sm text-neutral-500">還沒有資金帳戶</p>}
        <ul className="flex flex-col divide-y divide-neutral-100">
          {people.map((uid) => {
            const mine = cards.filter((c) => c.holderUserId === uid);
            const theirAccounts = accounts.filter((a) => a.holderUserId === uid);
            const computed = mine.reduce((s, c) => s + c.deferred, 0);
            const open = openUser === uid;
            return (
              <li key={uid} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-5">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenUser(open ? null : uid)}
                    className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  >
                    <ChevronDown className={cn("size-4 shrink-0 text-neutral-500 transition-transform", open && "rotate-180")} aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-medium text-neutral-900">{userName(uid)}</span>
                      <span className="text-xs text-neutral-500">
                        舊卡 {mine.length} 張{draft.method === "ACTUAL" && computed > 0 && <>，還沒上完 <Amount cents={computed} dollar /></>}
                      </span>
                    </span>
                  </button>
                  {draft.method === "CONVENTION" && <Amount cents={computed} dollar className="text-[15px] font-semibold" />}
                </div>
                {draft.method === "ACTUAL" && theirAccounts.length > 0 && (
                  <div className="flex flex-col gap-2 px-4 pb-3 lg:px-5">
                    {theirAccounts.map((a) => (
                      <CashInput key={a.id} account={a} locName={locName(a.locationId)} value={draft.cash[a.id] ?? ""} onChange={(v) => update({ cash: { ...draft.cash, [a.id]: v } })} />
                    ))}
                  </div>
                )}
                {canMove && mine.length > 0 && custodians.some((m) => m.userId === uid) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-[13px] lg:px-5">
                    <span className="text-neutral-600">這些錢現在在誰手上？</span>
                    <Select
                      size="sm"
                      className="w-40"
                      aria-label={`${userName(uid)} 名下舊卡的錢現在在誰手上`}
                      value={uid}
                      disabled={busy}
                      onChange={(v) => v !== uid && void move(mine.map((c) => c.cardId), v)}
                      options={custodianOptions}
                    />
                  </div>
                )}
                {open && (
                  <CardsByMonth
                    cards={mine}
                    conversionDate={draft.date}
                    userName={userName}
                    moveOptions={canMove && custodians.some((m) => m.userId === uid) ? custodianOptions.filter((o) => o.value !== uid) : []}
                    canUndo={canSettle}
                    busy={busy}
                    onMove={(cardId, to) => void move([cardId], to)}
                    onUndo={(cardId) => void undo([cardId])}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </FinanceCard>

      <AddAccountDrawer open={addFor !== null} onClose={() => { setAddFor(null); refresh(); }} holderUserId={addFor ?? undefined} />
    </div>
  );
}

function MethodOption({ checked, onPick, title, body }: { checked: boolean; onPick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onPick}
      className={cn(
        "flex cursor-pointer gap-3 rounded-xl border-[1.5px] px-4 py-3 text-left transition-colors",
        checked ? "border-primary-700 bg-primary-50" : "border-neutral-200 hover:border-neutral-300",
      )}
    >
      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]", checked ? "border-primary-700" : "border-neutral-400")}>
        {checked && <span className="size-2 rounded-full bg-primary-700" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-neutral-900">{title}</span>
        <span className="text-[13px] leading-relaxed text-neutral-600">{body}</span>
      </span>
    </button>
  );
}

function CashInput({ account, locName, value, onChange }: { account: MoneyAccountView; locName: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="min-w-0 flex-1 truncate text-neutral-700">
        {account.name}
        {locName && <span className="text-neutral-500"> · {locName}</span>}
      </span>
      <input
        aria-label={`${account.name} 期初金額`}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-36 rounded-xl border-[1.5px] border-neutral-300 px-3 text-right tabular-nums"
        placeholder="0"
      />
    </label>
  );
}

/** 卡片明細：學生 · 卡 · 剩幾堂 · 金額。 */
function CardList({ cards, empty, receivable }: { cards: PreviewCard[]; empty: string; receivable?: boolean }) {
  if (cards.length === 0) return <p className="bg-neutral-50 px-4 py-3 text-[13px] text-neutral-500 lg:px-5">{empty}</p>;
  return (
    <ul className="flex flex-col bg-neutral-50 px-4 py-2 lg:px-5">
      {cards.map((c) => (
        <li key={c.cardId} className="flex items-center gap-3 py-1.5 text-[13px]">
          <span className="min-w-0 flex-1 truncate text-neutral-800">
            {c.studentName} <span className="text-neutral-500">· {c.cardName}</span>
          </span>
          <span className="shrink-0 tabular-nums text-neutral-500">剩 {c.sessionsLeft} 堂</span>
          <Amount cents={receivable ? c.receivable : c.deferred} dollar className="w-20 shrink-0 text-right" />
        </li>
      ))}
    </ul>
  );
}

/** YYYY-MM-DD 往前推 n 個月的月份（YYYY-MM）。 */
function monthsBefore(dateKey: string, n: number): string {
  const [y, m] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 期初現金展開某人：舊卡依購買月份分組（新的在上），買超過半年的月份標出來（多半用不完）。 */
function CardsByMonth({
  cards,
  conversionDate,
  userName,
  moveOptions,
  canUndo,
  busy,
  onMove,
  onUndo,
}: {
  cards: PreviewCard[];
  conversionDate: string;
  userName: (id: number) => string;
  /** 單張改記可以選的保管人（不含現在的經手人）；空的就不顯示。 */
  moveOptions: { value: number; label: string }[];
  canUndo: boolean;
  busy: boolean;
  onMove: (cardId: number, toUserId: number) => void;
  onUndo: (cardId: number) => void;
}) {
  const groups = useMemo(() => {
    const byMonth = new Map<string, PreviewCard[]>();
    for (const c of cards) {
      const k = c.purchasedOn.slice(0, 7);
      byMonth.set(k, [...(byMonth.get(k) ?? []), c]);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, list]) => ({
        month,
        cards: [...list].sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || b.deferred - a.deferred),
        paid: list.reduce((s, c) => s + c.price, 0),
        left: list.reduce((s, c) => s + c.deferred, 0),
      }));
  }, [cards]);
  const [openMonths, setOpenMonths] = useState<Set<string> | null>(null);
  if (cards.length === 0) return <p className="bg-neutral-50 px-4 py-3 text-[13px] text-neutral-500 lg:px-5">沒有算在他手上的舊卡</p>;

  const opened = openMonths ?? new Set(cards.length <= 8 ? groups.map((g) => g.month) : []);
  const toggle = (m: string) => {
    const next = new Set(opened);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    setOpenMonths(next);
  };
  const oldBefore = monthsBefore(conversionDate, 6);
  const hasOld = groups.some((g) => g.month < oldBefore);

  return (
    <div className="flex flex-col bg-neutral-50 px-4 py-2 lg:px-5">
      {hasOld && (
        <p className="flex items-center gap-1 text-xs text-neutral-500">
          標「超過半年」的是轉換日前半年以上買的卡，多半用不完
          <InfoTip label="超過半年的卡說明">這些卡會在轉換日後 6 個月到期，到時還沒上完的部分轉成過期收入。</InfoTip>
        </p>
      )}
      <ul className="flex flex-col">
        {groups.map((g) => {
          const [y, m] = g.month.split("-").map(Number);
          const old = g.month < oldBefore;
          const isOpen = opened.has(g.month);
          return (
            <li key={g.month} className="flex flex-col">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(g.month)}
                className={cn(
                  "-mx-2 flex min-h-10 cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 text-left text-[13px]",
                  old ? "text-warning-900 hover:bg-warning-50" : "text-neutral-800 hover:bg-neutral-100",
                )}
              >
                <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", old ? "text-warning-700" : "text-neutral-500", isOpen && "rotate-180")} aria-hidden />
                <span className="font-medium">{y} 年 {m} 月</span>
                {old && <span className="rounded-full bg-warning-100 px-1.5 py-px text-[11px] font-medium text-warning-900">超過半年</span>}
                <span className={cn("tabular-nums", old ? "text-warning-800" : "text-neutral-500")}>
                  · {g.cards.length} 張 · 收 <Amount cents={g.paid} dollar /> · 還剩 <Amount cents={g.left} dollar />
                </span>
              </button>
              {isOpen && (
                <ul className="mb-1 flex flex-col border-l border-neutral-200 pl-3">
                  {g.cards.map((c) => (
                    <li key={c.cardId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1 text-[13px]">
                      <span className="min-w-0 flex-1 break-words text-neutral-800">
                        <span className="tabular-nums text-neutral-500">{c.purchasedOn.slice(5).replace("-", "/")}</span> · {c.studentName}{" "}
                        <span className="text-neutral-500">· {c.cardName}</span>
                        <span className="whitespace-nowrap tabular-nums text-neutral-500">　剩 {c.sessionsLeft} / {c.totalSessions} 堂</span>
                        {c.collectedByUserId != null && (
                          <span className="whitespace-nowrap text-neutral-500">
                            　原本 {userName(c.collectedByUserId)} 收
                            {canUndo && (
                              <Button variant="link" size="sm" className="ml-1.5 text-[13px]" disabled={busy} onClick={() => onUndo(c.cardId)}>
                                復原
                              </Button>
                            )}
                          </span>
                        )}
                      </span>
                      {moveOptions.length > 0 && (
                        <Select
                          size="sm"
                          className="w-28 shrink-0"
                          aria-label={`${c.studentName} ${c.cardName} 改記給誰`}
                          placeholder="改給…"
                          disabled={busy}
                          onChange={(v) => onMove(c.cardId, v)}
                          options={moveOptions}
                        />
                      )}
                      <Amount cents={c.deferred} dollar className="shrink-0 text-right" />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────── 第 7 步：還沒付的錢 ───────── */

export function OpeningPayablesStep() {
  useWatchPreview();
  const { draft, setPayables, state, result } = useOpening();
  const { data: locData } = useGetLocationsQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  if (!draft || !state) return <Skeleton className="h-72 rounded-2xl" />;
  if (state.lockDate) return <Locked lockDate={state.lockDate} />;
  const locations = (locData?.locations ?? []).filter((l) => !l.archivedAt);
  const packs = result?.packs ?? [];

  return (
    <div className="flex flex-col gap-4">
      <FinanceCard className="flex flex-col gap-3 px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold text-neutral-900">次數包</span>
          <span className="text-[13px] text-neutral-500">轉換日以前買的次數包，系統已經算好，記成預付場地費。要改請回第 3 步。</span>
        </div>
        {settings?.noVenueFee ? (
          <p className="text-sm text-neutral-500">這間教室不用場地費。</p>
        ) : !result ? (
          <Skeleton className="h-10 rounded-lg" />
        ) : packs.length === 0 ? (
          <p className="text-sm text-neutral-500">轉換日以前沒有買次數包。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {packs.map((p, i) => (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">{p.venueName}</span>
                <span className="shrink-0 tabular-nums text-neutral-600">
                  還剩 {p.sessions} 次 = <Amount cents={p.amount} dollar className="font-semibold text-neutral-900" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </FinanceCard>

      <FinanceCard className="flex flex-col gap-3 px-4 py-4 lg:px-5">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold text-neutral-900">開帳那天以前，有欠誰錢還沒付嗎？</span>
          <span className="text-[13px] text-neutral-500">例：10 月 Sean 的鐘點費 $4,000 還沒給；丁丁先墊的音響 $2,000。</span>
        </div>
        <dl className="grid gap-1.5 rounded-xl bg-neutral-50 px-4 py-3 text-[13px] leading-relaxed text-neutral-700">
          <div><dt className="inline font-semibold text-neutral-900">加了：</dt><dd className="inline">會出現在下次付款批次，付了就沖掉。</dd></div>
          <div><dt className="inline font-semibold text-neutral-900">不加：</dt><dd className="inline">之後要付，只能另外記一筆支出。</dd></div>
        </dl>
        <PayableRows payables={draft.payables} setPayables={setPayables} locations={locations} />
      </FinanceCard>
    </div>
  );
}

function PayableRows({
  payables,
  setPayables,
  locations,
}: {
  payables: Payable[];
  setPayables: (f: (p: Payable[]) => Payable[]) => void;
  locations: { id: number; name: string }[];
}) {
  const { data: tData } = useGetFinanceTeachersQuery();
  const { data: vData } = useGetFinanceVenuesQuery();
  const { data: settings } = useGetFinanceSettingsQuery();
  const parties = (kind: Payable["kind"]) =>
    kind === "TEACHER"
      ? (tData?.teachers ?? []).map((t) => ({ value: t.id, label: t.name }))
      : kind === "VENUE"
        ? (vData?.venues ?? []).filter((v) => !v.archivedAt).map((v) => ({ value: v.id, label: v.name }))
        : (settings?.members ?? []).map((m) => ({ value: m.userId, label: m.name }));
  const set = (i: number, patch: Partial<Payable>) => setPayables((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="flex flex-col gap-3">
      {payables.map((p, i) => (
        <div key={i} className="grid grid-cols-2 items-center gap-2 border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[110px_minmax(0,1fr)_120px_110px_44px] sm:border-t-0 sm:pt-0">
          <Select size="sm" aria-label="欠誰" value={p.kind} onChange={(v) => set(i, { kind: v, partyId: 0 })} options={[{ value: "TEACHER", label: "老師" }, { value: "VENUE", label: "場地" }, { value: "OWNER", label: "成員代墊" }]} />
          <Select size="sm" aria-label="對象" value={p.partyId || undefined} onChange={(v) => set(i, { partyId: v })} options={parties(p.kind)} placeholder="對象" />
          <Select size="sm" aria-label="分部" value={p.locationId || undefined} onChange={(v) => set(i, { locationId: v })} options={locations.map((l) => ({ value: l.id, label: l.name }))} placeholder="分部" />
          <input aria-label="金額" inputMode="decimal" value={p.amount || ""} onChange={(e) => set(i, { amount: Number(e.target.value) || 0 })} className="h-9 rounded-lg border border-neutral-300 px-2 text-right text-sm tabular-nums" placeholder="0" />
          <Button variant="ghost" size="iconSm" aria-label="刪除" onClick={() => setPayables((ps) => ps.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" className="self-start" onClick={() => setPayables((ps) => [...ps, { kind: "TEACHER", partyId: 0, locationId: locations[0]?.id ?? 0, amount: 0 }])}>
        <Plus className="size-4" />加一筆還沒付的
      </Button>
    </div>
  );
}

/* ───────── 第 8 步：預覽並開帳 ───────── */

/** `blocker`：不是 null 就不能按開帳，顯示在按鈕上方（精靈裡：前面還有步驟沒做完）。 */
export function OpeningConfirmStep({ blocker }: { blocker?: ReactNode }) {
  useWatchPreview();
  const router = useRouter();
  const isOwner = useIsOwner();
  const { draft, state, params, result, previewing, clear } = useOpening();
  const { data: locData } = useGetLocationsQuery();
  const [open, opening] = useOpenLedgerMutation();
  const [confirm, setConfirm] = useState(false);

  if (!draft || !state) return <Skeleton className="h-96 rounded-2xl" />;
  if (state.lockDate) return <Locked lockDate={state.lockDate} />;
  const locName = (id: number) => locData?.locations.find((l) => l.id === id)?.name ?? "";
  const date = draft.date;

  const submit = async () => {
    if (!params) return;
    try {
      await open(params).unwrap();
      clear();
      toast.success(`已開帳：${date.replaceAll("-", "/")}`);
      router.push("/finance");
    } catch (e) {
      toast.error(financeErrorText(e, "開帳失敗"));
      setConfirm(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!result ? <Skeleton className="h-72 rounded-2xl" /> : <OpeningSheet result={result} locName={locName} />}
      {result && <DeferredAndReceivable cards={result.cards} />}

      {(result?.errors ?? []).length > 0 && (
        <p className="text-sm text-danger-700">還有 {result!.errors.length} 個問題要先處理（見「期初現金」）</p>
      )}
      {blocker}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-neutral-500">
          {state.opened ? (
            <>目前從 {state.conversionDate?.replaceAll("-", "/")} 開帳。<Link className="text-primary-800" href="/finance">回總覽</Link></>
          ) : (
            "第一次鎖帳前都可以換一天重開"
          )}
        </span>
        <Button
          disabled={!isOwner || !!blocker || !result || result.errors.length > 0 || previewing}
          onClick={() => setConfirm(true)}
        >
          {state.opened ? "重新開帳" : `從 ${date.replaceAll("-", "/")} 開帳`}
        </Button>
      </div>
      {!isOwner && <p className="text-right text-[13px] text-neutral-500">只有教室擁有者能開帳</p>}

      <ConfirmDialog
        open={confirm}
        title={state.opened ? "重新開帳？" : `從 ${date.replaceAll("-", "/")} 開帳？`}
        message={state.opened ? "帳本會從新的轉換日全部重算（手動分錄保留）。" : "這天以後的事會開始記進帳本。鎖帳前都可以重開。"}
        confirmLabel={state.opened ? "重新開帳" : "開帳"}
        isLoading={opening.isLoading}
        onConfirm={submit}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

/** 預收與應收：一列一個數字，點開看是哪幾張卡。 */
function DeferredAndReceivable({ cards }: { cards: PreviewCard[] }) {
  const [openKey, setOpenKey] = useState<"deferred" | "receivable" | null>(null);
  const deferred = cards.filter((c) => c.deferred !== 0);
  const receivable = cards.filter((c) => c.receivable !== 0);
  const rows = [
    { key: "deferred" as const, label: "預收學費（還欠學生的課）", list: deferred, total: deferred.reduce((s, c) => s + c.deferred, 0) },
    { key: "receivable" as const, label: "應收學費（還沒付的卡）", list: receivable, total: receivable.reduce((s, c) => s + c.receivable, 0) },
  ];
  return (
    <FinanceCard className="overflow-hidden">
      <ul className="flex flex-col divide-y divide-neutral-100">
        {rows.map((r) => {
          const open = openKey === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : r.key)}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-50 lg:px-5"
              >
                <ChevronDown className={cn("size-4 shrink-0 text-neutral-500 transition-transform", open && "rotate-180")} aria-hidden />
                <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900">{r.label}</span>
                <span className="text-[13px] text-neutral-500">{r.list.length} 張</span>
                <Amount cents={r.total} dollar className="w-24 text-right text-sm font-semibold" />
              </button>
              {open && <CardList cards={r.list} empty="沒有" receivable={r.key === "receivable"} />}
            </li>
          );
        })}
      </ul>
    </FinanceCard>
  );
}

function OpeningSheet({ result, locName }: { result: OpeningPreviewView; locName: (id: number) => string }) {
  const locs = result.totals.map((t) => t.locationId);
  const groups: { g: "ASSET" | "LIABILITY" | "EQUITY"; label: string; total: (t: (typeof result.totals)[number]) => number }[] = [
    { g: "ASSET", label: "資產", total: (t) => t.assets },
    { g: "LIABILITY", label: "負債", total: (t) => t.liabilities },
    { g: "EQUITY", label: "權益", total: (t) => t.equity },
  ];
  const labels = (g: string) => [...new Set(result.rows.filter((r) => r.group === g).map((r) => r.label))];
  const cell = (g: string, label: string, loc: number) => result.rows.filter((r) => r.group === g && r.label === label && r.locationId === loc).reduce((s, r) => s + r.amount, 0);
  const td = "px-4 py-2.5 text-right tabular-nums first:text-left";
  if (locs.length === 0) return <FinanceCard className="px-5 py-5 text-sm text-neutral-500">期初都是 0</FinanceCard>;
  return (
    <FinanceCard className="overflow-x-auto py-2" aria-label="期初資產負債表">
      <h3 className="px-5 pb-1 pt-2 text-base font-semibold">{result.conversionDate.replaceAll("-", "/")} 期初資產負債表</h3>
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs text-neutral-500">
            <th scope="col" className="px-4 py-2.5 text-left font-medium">科目</th>
            {locs.map((l) => <th key={l} scope="col" className="px-4 py-2.5 text-right font-medium">{locName(l)}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map(({ g, label, total }) => (
            <Fragment key={g}>
              <tr><td colSpan={locs.length + 1} className="px-4 pb-1 pt-5 text-xs font-semibold text-neutral-600">{label}</td></tr>
              {labels(g).map((l) => (
                <tr key={`${g}-${l}`} className="border-b border-neutral-100">
                  <td className={td}>{l}</td>
                  {locs.map((loc) => <td key={loc} className={td}><Amount cents={cell(g, l, loc)} blankZero /></td>)}
                </tr>
              ))}
              <tr className="border-b border-neutral-100 border-t border-t-neutral-300 bg-neutral-50 font-semibold">
                <td className={td}>{label}合計</td>
                {result.totals.map((t) => <td key={t.locationId} className={td}><Amount cents={total(t)} /></td>)}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </FinanceCard>
  );
}
