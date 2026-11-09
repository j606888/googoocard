"use client";

// 使用教學的示意圖：用假資料畫的小畫面與流程圖（不是截圖——畫面改了也不會過時，也不會露出真的學生與金額）。
import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** 圖框：淺底＋「示意圖」說明。 */
export function Figure({ caption, children, className }: { caption: string; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("flex flex-col gap-2.5 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200/70 sm:p-5", className)}>
      <div className="min-w-0">{children}</div>
      <figcaption className="text-[13px] leading-relaxed text-neutral-500">示意圖｜{caption}</figcaption>
    </figure>
  );
}

const money = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US")}`;

function MiniCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-xl border bg-white px-3.5 py-3", tone === "warn" ? "border-warning-300" : "border-neutral-200")}>
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-lg font-bold tabular-nums text-neutral-900">{value}</span>
      {sub && <span className="text-xs text-neutral-500">{sub}</span>}
    </div>
  );
}

/** 0：總覽回答的三個問題。 */
export function FigThreeQuestions() {
  return (
    <Figure caption="財務總覽最上面的數字，每一張都在回答一個問題；點下去就是那個問題的報表。">
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-neutral-700">① 賺多少？</span>
          <MiniCard label="本月淨利" value="$18,400" sub="毛利 $23,400 · 支出 $5,000" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-neutral-700">② 錢夠不夠？</span>
          <MiniCard label="資金帳戶" value="$96,000" sub="丁丁 $41,000 · Sean $55,000" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-neutral-700">③ 欠誰／誰欠我們？</span>
          <MiniCard label="應付老師與場地" value="$12,600" sub="另有待學生付款 $1,200" />
        </div>
      </div>
    </Figure>
  );
}

function FlowStep({ n, title, children, tone }: { n: number; title: string; children: ReactNode; tone?: "primary" }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1 rounded-xl border bg-white px-3.5 py-3", tone === "primary" ? "border-primary-300" : "border-neutral-200")}>
      <span className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
        <span className="grid size-5 place-items-center rounded-full bg-primary-900 text-[11px] text-white">{n}</span>
        {title}
      </span>
      <span className="text-[13px] leading-relaxed text-neutral-600">{children}</span>
    </div>
  );
}

function Arrow() {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center text-neutral-400">
      <ArrowDown className="size-4 md:hidden" />
      <ArrowRight className="hidden size-4 md:block" />
    </span>
  );
}

/** 錢的一生：賣卡 → 上課 → 分帳 → 發錢。 */
export function FigMoneyFlow() {
  return (
    <Figure caption="以一張 8 堂 $3,200 的卡為例。你只要照平常賣卡、點名；分錄是系統自動記的。">
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <FlowStep n={1} title="學生買卡">
          收到 $3,200 進收款人的<b>資金帳戶</b>；但課還沒上，這筆錢先算<b>預收</b>（欠學生 8 堂課）。
        </FlowStep>
        <Arrow />
        <FlowStep n={2} title="點名上了一堂">
          預收少 $400，<b>收入</b>多 $400。沒付錢的卡也一樣認列，差的記成<b>應收</b>。
        </FlowStep>
        <Arrow />
        <FlowStep n={3} title="照分帳規則分">
          這 $400 依這門課的規則分給老師、場地，剩下的進分部<b>公積金</b>。
        </FlowStep>
        <Arrow />
        <FlowStep n={4} title="付款批次發錢" tone="primary">
          月初建付款批次，付錢的人按「標記已付款」，錢才真的從資金帳戶出去。
        </FlowStep>
      </div>
    </Figure>
  );
}

/** 一堂課怎麼分帳。 */
export function FigSplitExample() {
  const rows: { label: string; rule: string; amount: number; to: string }[] = [
    { label: "場地", rule: "場地費（次數包扣 1 次）", amount: 800, to: "舞蹈教室 A" },
    { label: "老師", rule: "固定金額", amount: 1500, to: "小美老師" },
    { label: "公積金", rule: "剩下的", amount: 1700, to: "台南公積金" },
  ];
  return (
    <Figure caption="一堂 10 個人、每人那一格值 $400 → 這堂收入 $4,000。規則由上往下扣，最後一行永遠是「剩下的」。">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
          <span className="font-semibold">週三 Salsa 初階 · 11/12</span>
          <span className="tabular-nums font-semibold">{money(4000)}</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0">
            <span className="flex flex-col">
              <span className="font-medium">{r.to}</span>
              <span className="text-xs text-neutral-500">{r.label} · {r.rule}</span>
            </span>
            <span className="self-center tabular-nums">{money(r.amount)}</span>
          </div>
        ))}
      </div>
    </Figure>
  );
}

/** 手上的錢 vs 欠的。 */
export function FigCashGap() {
  return (
    <Figure caption="總覽中間那一條：灰色比綠色長，代表已經先用了學生預付的錢——不一定是錯，但要知道。">
      <div className="flex flex-col gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
        <div className="flex items-center text-sm font-semibold">
          手上的錢 vs 欠的
          <span className="ml-auto rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-semibold text-warning-950">差 $8,000</span>
        </div>
        {[
          { label: "手上的錢", v: 96, tone: "bg-primary-600", text: "$96,000" },
          { label: "預收＋應付", v: 104, tone: "bg-neutral-400", text: "$104,000" },
        ].map((b) => (
          <div key={b.label} className="flex items-center gap-3 text-xs">
            <span className="w-20 shrink-0 text-neutral-600">{b.label}</span>
            <span className="h-2.5 flex-1 rounded-full bg-neutral-100">
              <span className={cn("block h-full rounded-full", b.tone)} style={{ width: `${(b.v / 104) * 100}%` }} />
            </span>
            <span className="w-16 text-right tabular-nums">{b.text}</span>
          </div>
        ))}
      </div>
    </Figure>
  );
}

/** 開帳：轉換日前後。 */
export function FigOpening() {
  return (
    <Figure caption="轉換日之前的事，不用一筆一筆補——系統把結果算成「期初」；轉換日（含）之後的每件事才記成分錄。">
      <div className="flex flex-col gap-3">
        <div className="relative flex h-10 items-center">
          <span className="h-1 flex-1 rounded-l-full bg-neutral-300" />
          <span className="h-1 flex-1 rounded-r-full bg-primary-500" />
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="size-4 rounded-full border-[3px] border-white bg-primary-900 shadow" />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px] leading-relaxed">
          <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-neutral-600">
            <b className="text-neutral-900">轉換日以前</b>
            <br />
            舊卡還沒上完的 → 預收
            <br />
            舊卡還沒付的 → 應收
            <br />
            次數包剩的 → 預付場地費
          </div>
          <div className="rounded-xl border border-primary-300 bg-white px-3.5 py-3 text-neutral-600">
            <b className="text-neutral-900">轉換日（含）以後</b>
            <br />
            賣卡、點名、收款、支出、付款……
            <br />
            全部自動記進帳本
          </div>
        </div>
        <div className="text-center text-xs font-semibold text-primary-900">▲ 轉換日：鎖帳以前都可以換一天重開</div>
      </div>
    </Figure>
  );
}

/** 付款批次的一張卡。 */
export function FigPayoutRun() {
  const rows = [
    { name: "小美老師", kind: "老師報酬 · 台南", due: "12,345.50", paid: "12,346", done: true },
    { name: "舞蹈教室 A", kind: "場地費 · 台南", due: "6,400.00", paid: "6,400", done: false },
  ];
  return (
    <Figure caption="付款批次依「誰付」分組。付的人轉完帳，自己按「標記已付款」——這一下才真的把錢記出去。">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm">
        <div className="flex flex-wrap items-baseline gap-2 px-4 pb-2 pt-3">
          <span className="font-semibold">丁丁付</span>
          <span className="text-xs text-neutral-500">從 丁丁的現金（台南）</span>
          <span className="ml-auto font-semibold tabular-nums">$18,746</span>
        </div>
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-neutral-100 px-4 py-2.5">
            <span className="flex flex-col">
              <span className="font-medium text-primary-800">{r.name}</span>
              <span className="text-xs text-neutral-500">{r.kind}</span>
            </span>
            <span className="text-right tabular-nums">
              <span className="block text-xs text-neutral-400">應付 {r.due}</span>
              <span className="font-semibold">{r.paid}</span>
            </span>
            {r.done ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-primary-900">
                <Check className="size-3.5" />已付款
              </span>
            ) : (
              <span className="rounded-lg bg-primary-900 px-2.5 py-1 text-xs font-semibold text-white">標記已付款</span>
            )}
          </div>
        ))}
      </div>
    </Figure>
  );
}

/** 分部往來。 */
export function FigBranches() {
  return (
    <Figure caption="每個分部是自己平衡的一本帳。一個分部的錢付了另一個分部的帳，兩邊就互欠；付款批次會算出一個淨額，轉一筆就兩清。">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <div className="flex-1 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-[13px]">
          <b>高雄</b>
          <br />
          <span className="text-neutral-600">Sean 從高雄的錢，付了台南老師 $3,000</span>
        </div>
        <div className="flex flex-col items-center px-2 text-xs font-semibold text-warning-900">
          台南欠高雄 $3,000
          <ArrowRight className="hidden size-4 rotate-180 sm:block" />
          <ArrowDown className="size-4 rotate-180 sm:hidden" />
        </div>
        <div className="flex-1 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-[13px]">
          <b>台南</b>
          <br />
          <span className="text-neutral-600">分部往來轉平：丁丁轉 $3,000 給 Sean → 兩清</span>
        </div>
      </div>
    </Figure>
  );
}

/** 鎖帳日。 */
export function FigLock() {
  const days = ["10/29", "10/30", "10/31", "11/1", "11/2"];
  return (
    <Figure caption="鎖到 10/31 之後，10 月的帳就不會再變。11/3 才補點 10/30 的名？差額自動記在 11/1，10 月報表保持原樣。">
      <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
        {days.map((d, i) => (
          <div
            key={d}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-1 py-2.5",
              i <= 2 ? "bg-neutral-200/70 text-neutral-600" : "bg-white ring-1 ring-neutral-200",
              i === 3 && "ring-2 ring-primary-500",
            )}
          >
            {i <= 2 ? <Lock className="size-3.5" /> : <span className="size-3.5" />}
            <span className="tabular-nums font-semibold">{d}</span>
            {i === 1 && <span className="text-[11px] text-warning-900">補點名</span>}
            {i === 3 && <span className="text-[11px] text-primary-900">更正記這天</span>}
          </div>
        ))}
      </div>
    </Figure>
  );
}

/** 一個月的節奏。 */
export function FigMonthRhythm() {
  const steps = [
    { when: "每天", what: "賣卡、確認收款、點名" },
    { when: "有花錢時", what: "記一筆：支出／代墊／轉帳" },
    { when: "月初 1–5 號", what: "建付款批次 → 各自付款、按已付款 → 分部往來轉平" },
    { when: "付完之後", what: "盤點資金帳戶 → 結帳清單打勾 → 鎖到上個月底" },
  ];
  return (
    <Figure caption="大部分時間你只做第一行；後面三行是管錢的人一個月一次。">
      <ol className="flex flex-col gap-1.5">
        {steps.map((s) => (
          <li key={s.when} className="grid grid-cols-[88px_1fr] items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[13px]">
            <span className="font-semibold text-primary-900">{s.when}</span>
            <span className="text-neutral-700">{s.what}</span>
          </li>
        ))}
      </ol>
    </Figure>
  );
}
