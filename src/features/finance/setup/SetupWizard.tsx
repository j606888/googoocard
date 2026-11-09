"use client";

// 開帳精靈 /finance/setup：左邊（手機在上面）是八步的進度，右邊是這一步要做的事。
// 第 1–5 步做完會依 GET /finance/setup 自動打勾；第 6、7 步（期初現金、還沒付的錢）是開帳草稿，
// 看過就打勾（OpeningDraftProvider）；步驟可以自由跳，只有第 8 步「預覽並開帳」要等前面都做完，按下去才一次送出。
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import Select from "@/components/Select";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetLessonQuery, useGetLessonStudentsQuery } from "@/store/slices/lessons";
import { useGetLocationsQuery } from "@/store/slices/locations";
import {
  useGetFinanceSettingsQuery,
  useGetFinanceSetupQuery,
  useSetLessonLocationMutation,
  type ChecklistKey,
  type SetupResponse,
} from "@/store/slices/finance";
import BranchSettings from "../BranchSettings";
import LessonSplitPanel from "../LessonSplitPanel";
import StrayReceivers from "../StrayReceivers";
import VenueSettings, { NoVenueFeeToggle } from "../VenueSettings";
import { financeErrorText } from "../financeUi";
import { useFinanceRole } from "../useCanSettle";
import { OpeningCashStep, OpeningConfirmStep, OpeningDraftProvider, OpeningPayablesStep, useOpeningDraft } from "../v2/Opening";
import { FinanceCard, FinanceShell } from "../v2/ui";
import { StepIllustration } from "./illustrations";
import { SETUP_STEPS, setupStepHref } from "./steps";

type Item = SetupResponse["items"][number];
type SetupLesson = SetupResponse["lessons"][number];

export default function SetupWizard() {
  return (
    <FinanceShell title="開帳設定" guide="setup" crumb={{ href: "/finance/settings", label: "財務設定" }} noRecord>
      <OpeningDraftProvider>
        <WizardBody />
      </OpeningDraftProvider>
    </FinanceShell>
  );
}

function WizardBody() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, isLoading } = useGetFinanceSetupQuery();
  const { isLoading: roleLoading } = useGetFinanceSettingsQuery();
  const { canSettle } = useFinanceRole();
  const { draft, markVisited } = useOpeningDraft();
  const topRef = useRef<HTMLDivElement>(null);

  const rawStep = params.get("step");
  const requested = rawStep && rawStep in SETUP_STEPS ? (rawStep as ChecklistKey) : null;

  // 一進來就已經開過帳 → 回總覽（開帳後要改設定請到設定頁）。只看第一次載入，做到一半不會被踢走。
  // 網址沒帶步驟時，把「第一個還沒做完的步驟」寫進網址釘住：之後這步做完、資料重抓，也不會自己跳到下一步，
  // 只有按上一步／下一步或點左邊清單才換。
  // 第 6、7 步伺服器只知道開帳了沒，看過了沒以畫面上的草稿為準。
  const visited = draft?.visited;
  const items = useMemo<Item[] | null>(
    () =>
      data
        ? data.items.map((i) => ((i.key === "cash" || i.key === "payables") && !i.done ? { ...i, done: !!visited?.[i.key] } : i))
        : null,
    [data, visited],
  );
  // 開帳了就一律回總覽——不只第一次載入：剛按完開帳時，總覽的守門可能還拿著舊資料把人送回這裡，
  // 那時草稿已清掉，若只看第一次就會被釘在第 6 步（2026-11-10 實走遇到）。
  useEffect(() => {
    if (!data || !items || !draft) return;
    if (data.items.find((i) => i.key === "opening")?.done) {
      router.replace("/finance");
      return;
    }
    if (!requested) {
      const first = items.find((i) => !i.done) ?? items[0];
      if (first) router.replace(setupStepHref(first.key), { scroll: false });
    }
  }, [data, items, draft, requested, router]);

  if (isLoading || roleLoading) return <Skeleton className="h-[480px] w-full max-w-5xl rounded-2xl" />;
  if (!data || !items) return <EmptyState kind="page" title="這間教室還沒開財務" />;
  if (!canSettle) return <EmptyState kind="page" title="只有可以結算的人能做開帳設定" />;

  const index = Math.max(0, items.findIndex((i) => i.key === (requested ?? (items.find((i) => !i.done) ?? items[0]).key)));
  const item = items[index];
  const meta = SETUP_STEPS[item.key];

  const go = (key: ChecklistKey) => {
    if (item.key === "cash" || item.key === "payables") markVisited(item.key);
    router.replace(setupStepHref(key), { scroll: false });
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const prev = items[index - 1];
  const next = items[index + 1];
  // 收款人整理不能跳過：沒改記完就往下走，期初現金會算錯人（使用者以為「確認」就是下一步而漏掉）。
  const mustFinish = item.key === "receivers";
  const pendingBefore = items.slice(0, index).filter((i) => !i.done);

  return (
    <div ref={topRef} className="grid scroll-mt-4 gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <StepRail items={items} current={index} onPick={go} />
      <MobileProgress items={items} current={index} />

      <div className="flex min-w-0 max-w-3xl flex-col gap-5">
        <header className="flex items-center gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="hidden text-[13px] font-medium text-neutral-500 lg:block">
              第 {index + 1} 步，共 {items.length} 步
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 className="text-xl font-bold text-neutral-900">{meta.title}</h2>
              {item.done ? <StatusTag tone="positive"><Check className="size-3" strokeWidth={3} />完成</StatusTag> : <StatusTag tone="warning">還沒完成</StatusTag>}
            </div>
            {!item.done && item.detail && <p className="text-sm font-medium text-warning-950">{item.detail}</p>}
            <p className="text-[15px] leading-relaxed text-neutral-700">{meta.purpose}</p>
          </div>
          <StepIllustration step={item.key} className="hidden w-36 shrink-0 sm:block" />
        </header>

        <Notes notes={meta.notes} more={meta.more} />

        <StepContent
          item={item}
          lessons={data.lessons}
          blocker={
            item.key === "opening" && pendingBefore.length > 0 ? (
              <PendingBlocker items={pendingBefore} onPick={go} />
            ) : null
          }
        />

        {/* 貼在畫面底部，不用捲到最下面才按得到「下一步」。手機墊在底部導覽列上方（約 5rem 含外距）；App 裡沒有網頁導覽列，貼底（flush-bottom） */}
        <footer
            data-in-app="flush-bottom"
            className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 py-3 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            {prev ? (
              <Button variant="secondary" onClick={() => go(prev.key)}>上一步</Button>
            ) : (
              <span />
            )}
            {next && (
              <div className="flex items-center gap-3">
                {!item.done && (
                  <span className={cn("hidden text-[13px] sm:inline", mustFinish ? "font-medium text-warning-900" : "text-neutral-500")}>
                    {mustFinish ? "每一筆都確認改記後才能下一步" : "可以先跳過，之後再回來"}
                  </span>
                )}
                <Button onClick={() => go(next.key)} disabled={mustFinish && !item.done}>
                  下一步：{SETUP_STEPS[next.key].short}
                  <ChevronRight />
                </Button>
              </div>
            )}
          </footer>
      </div>
    </div>
  );
}

/** 桌面左側：八步清單，可以點任一步。 */
function StepRail({ items, current, onPick }: { items: Item[]; current: number; onPick: (k: ChecklistKey) => void }) {
  const done = items.filter((i) => i.done).length;
  return (
    <nav aria-label="開帳步驟" className="sticky top-4 hidden flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-3 lg:flex">
      <div className="flex flex-col gap-2 px-2 pt-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-neutral-900">開帳進度</span>
          <span className="text-[13px] tabular-nums text-neutral-500">{done} / {items.length}</span>
        </div>
        <ProgressBar value={done / items.length} />
      </div>
      <ol className="flex flex-col gap-0.5">
        {items.map((it, i) => {
          const active = i === current;
          return (
            <li key={it.key}>
              <button
                type="button"
                onClick={() => onPick(it.key)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  active ? "bg-primary-50 font-semibold text-neutral-900" : "text-neutral-700 hover:bg-neutral-50",
                )}
              >
                <StepDot done={it.done} n={i + 1} active={active} />
                <span className={cn("min-w-0 flex-1", it.done && !active && "text-neutral-500")}>{SETUP_STEPS[it.key].short}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** 手機：上方一條進度。 */
function MobileProgress({ items, current }: { items: Item[]; current: number }) {
  const done = items.filter((i) => i.done).length;
  return (
    <div className="flex flex-col gap-2 lg:hidden">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-semibold text-neutral-900">第 {current + 1} 步，共 {items.length} 步</span>
        <span className="tabular-nums text-neutral-500">完成 {done} / {items.length}</span>
      </div>
      <ol className="grid grid-flow-col gap-1" aria-hidden>
        {items.map((it, i) => (
          <li
            key={it.key}
            className={cn(
              "h-1.5 rounded-full",
              it.done ? "bg-primary-600" : i === current ? "bg-primary-300" : "bg-neutral-200",
            )}
          />
        ))}
      </ol>
    </div>
  );
}

function StepDot({ done, n, active }: { done: boolean; n: number; active: boolean }) {
  if (done) {
    return (
      <span aria-label="完成" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-600 text-white">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
        active ? "bg-primary-900 text-white" : "border-[1.5px] border-neutral-300 text-neutral-600",
      )}
    >
      {n}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
      <div className="h-full rounded-full bg-primary-600 transition-[width] duration-300" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

function Notes({ notes, more }: { notes: string[]; more?: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="flex gap-3 rounded-xl bg-neutral-50 px-4 py-3">
      <Lightbulb className="mt-1 size-4 shrink-0 text-warning-700" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1 text-sm font-semibold text-neutral-900">
          要注意
          {more && more.length > 0 && (
            <InfoTip label="更多說明">
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {more.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </InfoTip>
          )}
        </span>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-[15px] leading-relaxed text-neutral-800">
          {notes.map((n) => <li key={n}>{withBold(n)}</li>)}
        </ul>
      </div>
    </div>
  );
}

/** 「**粗體**」→ <b>。 */
function withBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <b key={i} className="font-semibold text-neutral-900">{part}</b> : part));
}

function PendingBlocker({ items, onPick }: { items: Item[]; onPick: (k: ChecklistKey) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-semibold text-warning-950">
        <AlertTriangle className="size-4" aria-hidden />前面還有 {items.length} 步沒做完，做完才能開帳
      </span>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.key}>
            <Button size="sm" variant="secondary" onClick={() => onPick(i.key)}>
              {SETUP_STEPS[i.key].short}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepContent({
  item,
  lessons,
  blocker,
}: {
  item: Item;
  lessons: SetupLesson[];
  blocker: React.ReactNode;
}) {
  switch (item.key) {
    case "branches":
      return <Panel><BranchSettings /></Panel>;
    case "lessonBranches":
      return <Panel><LessonBranches lessons={lessons} /></Panel>;
    case "venues":
      return <VenuesStep />;
    case "rules":
      return <LessonRules lessons={lessons} />;
    case "receivers":
      return <Panel><StrayReceivers /></Panel>;
    case "cash":
      return <OpeningCashStep />;
    case "payables":
      return <OpeningPayablesStep />;
    case "opening":
      return <OpeningConfirmStep blocker={blocker} />;
  }
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <FinanceCard className={cn("px-4 py-4 lg:px-5", className)}>{children}</FinanceCard>;
}

/** 第 2 步：沒標分部的課排前面，每門課直接選分部。 */
function LessonBranches({ lessons }: { lessons: SetupLesson[] }) {
  const { data: locData } = useGetLocationsQuery();
  const [setLocation] = useSetLessonLocationMutation();
  const locations = (locData?.locations ?? []).filter((l) => !l.archivedAt);
  if (lessons.length === 0) return <p className="text-sm text-neutral-500">沒有進行中的課，這步不用做。</p>;
  if (locData && locations.length === 0) return <p className="text-sm text-neutral-500">還沒有分部，請先完成第 1 步。</p>;
  const sorted = [...lessons].sort((a, b) => Number(a.locationId != null) - Number(b.locationId != null));
  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {sorted.map((l) => (
        <li key={l.id} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Link href={`/lessons/${l.id}`} className="truncate text-sm font-medium text-neutral-900 hover:underline">
              {l.name}
            </Link>
            {l.locationId == null && <StatusTag tone="warning">還沒標</StatusTag>}
          </span>
          <div className="sm:w-48 sm:shrink-0">
            <Select
              size="sm"
              aria-label={`${l.name} 的分部`}
              value={l.locationId ?? undefined}
              placeholder="選分部"
              options={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
              onChange={async (v) => {
                try {
                  await setLocation({ id: l.id, locationId: v }).unwrap();
                } catch (e) {
                  toast.error(financeErrorText(e, "存不了，請再試一次"));
                }
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 第 3 步：先問要不要場地費，要的話才顯示場地設定。 */
function VenuesStep() {
  const { data: settings } = useGetFinanceSettingsQuery();
  return (
    <div className="flex flex-col gap-4">
      <Panel className="py-2">
        <NoVenueFeeToggle />
      </Panel>
      {!settings?.noVenueFee && (
        <Panel>
          <VenueSettings />
        </Panel>
      )}
    </div>
  );
}

/** 第 4 步：每門進行中的課一列，點開就在這裡設規則（跟課程頁的分帳分頁同一個元件）。 */
function LessonRules({ lessons }: { lessons: SetupLesson[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  if (lessons.length === 0) return <Panel><p className="text-sm text-neutral-500">沒有進行中的課，這步不用做。</p></Panel>;
  const sorted = [...lessons].sort((a, b) => Number(a.hasRule) - Number(b.hasRule));
  return (
    <FinanceCard className="overflow-hidden">
      <ul className="flex flex-col divide-y divide-neutral-100">
        {sorted.map((l) => {
          const open = openId === l.id;
          return (
            <li key={l.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : l.id)}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-neutral-50 lg:px-5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{l.name}</span>
                {l.hasRule ? <StatusTag tone="positive">已設定</StatusTag> : <StatusTag tone="warning">還沒設</StatusTag>}
                <ChevronDown className={cn("size-4 shrink-0 text-neutral-500 transition-transform", open && "rotate-180")} aria-hidden />
              </button>
              {open && (
                <div className="border-t border-neutral-100">
                  <LessonRuleInline id={l.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </FinanceCard>
  );
}

function LessonRuleInline({ id }: { id: number }) {
  const { data: lesson } = useGetLessonQuery(id);
  const { data: students } = useGetLessonStudentsQuery({ id });
  if (!lesson) return <Skeleton className="m-4 h-24 rounded-xl" />;
  return <LessonSplitPanel lesson={lesson} students={students ?? []} ruleOnly />;
}
