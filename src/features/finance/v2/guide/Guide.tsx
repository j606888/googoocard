"use client";

// 財務使用教學（/finance/guide）：從零開始怎麼用、示意圖、常見疑惑。寫給不懂會計的人看；會計名詞只放括號裡。
// 各財務頁標題旁的「看教學」會帶 #段落 id 跳進來（FinanceShell 的 `guide`）。
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceShell } from "../ui";
import {
  FigBranches,
  FigCashGap,
  FigLock,
  FigMoneyFlow,
  FigMonthRhythm,
  FigOpening,
  FigPayoutRun,
  FigSplitExample,
  FigThreeQuestions,
} from "./figures";
import SetupProgress from "./SetupProgress";
import { FAQ } from "./faq";

const TOC = [
  { id: "intro", label: "0. 財務在做什麼" },
  { id: "setup", label: "1. 第一次設定" },
  { id: "split", label: "　分帳規則" },
  { id: "opening", label: "2. 開帳" },
  { id: "daily", label: "3. 日常" },
  { id: "record", label: "　記一筆" },
  { id: "monthly", label: "4. 每個月" },
  { id: "payouts", label: "　付款批次" },
  { id: "accounts", label: "　資金帳戶與盤點" },
  { id: "close", label: "　結帳與鎖帳" },
  { id: "reports", label: "5. 看報表" },
  { id: "faq", label: "6. 常見疑惑" },
  { id: "roles", label: "7. 誰能做什麼" },
];

export default function Guide() {
  const active = useActiveSection();
  return (
    <FinanceShell title="使用教學">
      <div className="flex gap-10">
        <nav aria-label="教學目錄" className="sticky top-6 hidden h-fit w-48 shrink-0 flex-col lg:flex">
          {TOC.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={cn(
                "whitespace-pre rounded-lg px-3 py-1.5 text-sm transition-colors",
                active === t.id ? "bg-neutral-100 font-semibold text-neutral-900" : "text-neutral-500 hover:text-neutral-900",
              )}
            >
              {t.label}
            </a>
          ))}
        </nav>

        <article className="flex min-w-0 max-w-3xl flex-1 flex-col gap-12 pb-10 text-[15px] leading-relaxed text-neutral-800">
          <MobileToc />

          <Section id="intro" title="0. 財務在做什麼">
            <p>
              財務把你平常做的事——賣卡、點名、收錢、付老師——自動記成一本帳，回答三個問題：<b>賺多少</b>、<b>錢夠不夠</b>、<b>欠誰／誰欠我們</b>。
              你<b>不需要懂會計</b>：分錄（借貸）是系統自己記的，你只要照平常操作，再偶爾記一下支出、月初發錢就好。
            </p>
            <FigThreeQuestions />
            <p>先記住一條錢的路線，後面所有畫面都只是在看它的不同段：</p>
            <FigMoneyFlow />
            <Terms />
          </Section>

          <Section id="setup" title="1. 第一次設定">
            <p>
              財務只要設定一次。下面是<b>你的教室現在的進度</b>，打勾的會自動消失在財務設定上方的「開帳清單」；點任何一項都會帶你去做。
            </p>
            <SetupProgress />
            <Steps
              items={[
                <>
                  <b>開啟財務</b>（只有教室擁有者）：到 <L href="/finance">財務</L> 選「舊卡的錢在誰手上」。
                  <Stuck>
                    開帳時，所有還有剩格的卡，到期日都會變成<b>轉換日 ＋ 6 個月</b>。過期後剩下的錢算「過期收入」。開帳前先跟大家說好轉換日。
                  </Stuck>
                </>,
                <>
                  <b>勾財務成員</b>：<L href="/finance/settings#general">財務設定 → 成員與其他</L>。「保管人」＝手上會拿教室的錢的人（有自己的資金帳戶）；「可以結算」＝能發錢、改規則、鎖帳的人。
                </>,
                <>
                  <b>建分部</b>：<L href="/finance/settings#branches">財務設定 → 分部</L>，每個分部設<b>負責人</b>和<b>過期的錢給誰</b>（兩個都要是保管人）。設好負責人，系統會自動幫他建一個資金帳戶。
                </>,
                <>
                  <b>每門進行中的課標上分部</b>：在課程頁編輯。財務開了以後，沒標分部的課存不了。
                </>,
                <>
                  <b>老師</b>：不用設付款人——老師在哪個分部上課，那幾堂的錢就由那個分部的負責人付。財務設定如果問「這位老師是某某本人嗎？」，按<b>連結帳號</b>，他的收入和薪水才會對在一起。
                  <Stuck>
                    付款批次出現「X 付 → 付給 X」？代表那位老師就是那個分部的負責人——他從自己管的錢領自己的報酬，這是正常的。
                  </Stuck>
                </>,
                <>
                  <b>場地與次數包</b>：<L href="/finance/settings#venues">財務設定 → 場地與次數包</L>。外面租的場地、或當房東的成員（例如丁丁家）都建成場地，選它屬於哪個分部、每次付多少或買次數包；場地費從那個分部負責人的錢付。開帳前手上的次數包，在場地填「還剩幾次」。沒有場地費就勾「這間教室不用場地費」。
                </>,
                <>
                  <b>每門進行中的課設分帳規則</b>：見下面「分帳規則」。
                </>,
                <>
                  <b>收的錢改記到保管人</b>：<L href="/finance/settings#receivers">財務設定 → 收的錢在誰手上</L>。小幫手代收、或開帳前收款人不是保管人的卡，改記到實際拿錢的人。平常是空的。
                </>,
                <>
                  <b>開帳</b>：見第 2 段。
                </>,
              ]}
            />

            <Sub id="split" title="分帳規則：一堂課的錢怎麼分">
              <p>
                在每門課的課程頁 → <b>「分帳」分頁</b> → 「設定規則」。規則設一次，套用到這門課的每一堂。規則<b>由上往下扣</b>，每一行是：
              </p>
              <ul className="ml-5 list-disc space-y-1">
                <li><b>固定金額</b>：給老師、公積金或場地，例如老師每堂 $1,500。</li>
                <li><b>比例</b>：「這堂收入的 X%」或「前面扣完剩下的 X%」。</li>
                <li><b>場地費</b>：照場地的收費方式——每次付的場地扣那個價，買次數包的場地每堂從包扣一次（單價＝包價 ÷ 次數）。</li>
                <li><b>剩下的給誰</b>（最後一行，一定有）：給某個分部的公積金，或幾位老師平分／照比重分。</li>
              </ul>
              <FigSplitExample />
              <p>
                <b>這堂課的基金</b>決定這堂的利潤（或虧損）算在哪個分部，報表也照它歸類——不是照上課地點。收入不夠付時，老師拿 0，差額由這個分部吸收。
              </p>
              <Tip>
                其他課的規則差不多？用「從另一門課複製規則」。某一堂特別（例如請外師）就在那一堂按「只改這一堂」，其他堂不受影響。
              </Tip>
              <Stuck>
                改規則會<b>重算這門課從開帳以來的每一堂</b>。已經鎖帳的日子不會被改到，差額記在鎖帳日的隔天。
              </Stuck>
            </Sub>
          </Section>

          <Section id="opening" title="2. 開帳：選一天，從那天開始記">
            <p>
              開帳是在說：「從<b>轉換日</b>這天起，帳本開始記；之前的事，用一張期初的表交代。」在 <L href="/finance/opening">財務設定 → 開帳</L>，五個步驟：
            </p>
            <FigOpening />
            <Steps
              items={[
                <><b>轉換日</b>：哪一天都可以，通常選月初。<b>現金怎麼算</b>選「約定」或「實數」（見下面）。</>,
                <><b>資金帳戶</b>：每個收過錢的人都要有資金帳戶。出現「這些人收過錢，但還沒有資金帳戶」就按「建帳戶」。</>,
                <><b>預收與應收</b>：系統自己算舊卡還欠學生多少課、還有多少沒收的錢，你只要看一眼。</>,
                <><b>次數包與待付</b>：次數包剩的會自動算。還沒付給老師、場地的錢，<b>建議開帳前先私下結清</b>，這裡就不用填。</>,
                <><b>確認期初</b>：看每個分部的期初表（資產＝負債＋權益），沒問題就按「開帳」（只有教室擁有者能按）。</>,
              ]}
            />
            <Compare
              left={{ title: "約定：錢在收錢的人那裡", body: "不用數錢。每個人的期初現金＝他收的舊卡還沒上完的價值，公積金期初是 0。錢放在私人戶頭、數不出來時選這個。" }}
              right={{ title: "實數：數得出來", body: "每個資金帳戶填實際有多少錢，公積金是相減出來的，可能是負的（代表之前已經先用了學生預付的錢）。" }}
            />
            <Tip>選錯日子不要緊：<b>第一次鎖帳之前</b>都可以換一天「重新開帳」，手動分錄會保留。鎖帳之後就只能用手動分錄更正。</Tip>
          </Section>

          <Section id="daily" title="3. 日常：大部分時候你只做這些">
            <FigMonthRhythm />
            <ul className="ml-5 list-disc space-y-2">
              <li>
                <b>賣卡、收錢時選對「收款人」</b>＝錢現在在誰手上（只能選保管人）。「已收到錢／還沒收」一定要照實選：還沒收的會記成<b>應收</b>，一直留在總覽「要處理的事」，直到你確認收款。
              </li>
              <li>
                <b>點名要「定案」才記帳</b>。學生自助簽到後、老師還沒在點名頁送出的那一格，錢還算預收。
              </li>
              <li>
                <b>學生沒付錢，老師也先拿不到那一份</b>：上課當天就算收入，但老師的那份記在「待學生付款」，學生付了才自動變成可以發。
              </li>
            </ul>

            <Sub id="record" title="記一筆">
              <p>任何財務頁的「記一筆」（手機在下方）都可以記：</p>
              <Table
                head={["類型", "什麼時候用"]}
                rows={[
                  ["支出", <>教室花的錢：廣告、器材、記帳士……「誰付的錢」選<b>教室的錢</b>（從某個資金帳戶扣）或<b>自己先墊</b>（下次付款批次會列出來還他）。</>],
                  ["轉帳", "資金帳戶之間搬錢，例如丁丁把現金存進教室戶頭。不是用來付老師的。"],
                  ["老闆放錢／拿錢", "業主自己放錢進來、拿錢出去，或從某分部的公積金分紅。（只有可以結算的人）"],
                  ["手動分錄", "給懂會計的人或記帳士調帳用，借貸要平衡才能存。（只有可以結算的人）"],
                ]}
              />
              <Stuck>
                記錯了不能刪、不能改——帳本只增不改。手動分錄可以按「沖銷」再重記；支出目前畫面上還沒有作廢按鈕，請可以結算的人用手動分錄調回來。
              </Stuck>
            </Sub>
          </Section>

          <Section id="monthly" title="4. 每個月：發錢、對帳、鎖帳">
            <p>建議每月初做一次，順序是 付款批次 → 分部往來 → 盤點 → 結帳鎖帳。</p>

            <Sub id="payouts" title="付款批次：發老師和場地的錢">
              <p>
                <L href="/finance/payouts">結算與付款</L> → 「建立付款批次」→ 選<b>算到哪一天</b>（通常是上個月底）。系統列出到那天為止，每位老師、場地、代墊的人<b>可以發多少</b>，並依「誰從哪個資金帳戶付」分組。
              </p>
              <FigPayoutRun />
              <Stuck>
                按了「標記已付款」<b>不要再去記一筆轉帳</b>——「標記已付款」本身就是付款紀錄，再記一次會扣兩次錢。付錯了，可以結算的人按「作廢」，那筆會變回待付。
              </Stuck>
              <p>應付金額有小數、實付是取整後的金額（取整單位在財務設定 → 成員與其他），尾差系統會自己記。老師名字可以點進去看<b>報酬單</b>：這期每一堂、合計、待學生付款。</p>
              <h4 className="pt-2 font-semibold text-neutral-900">分部往來轉平</h4>
              <FigBranches />
              <p>只有一個分部的教室不會出現這一項。轉完錢，在付款批次的「分部往來轉平」按「標記已轉」。</p>
            </Sub>

            <Sub id="accounts" title="資金帳戶與盤點">
              <p>
                <b>資金帳戶</b>＝某個人手上（或某個戶頭裡）屬於教室的錢。<L href="/finance/accounts">資金帳戶</L> 看每個口袋的餘額和明細。
              </p>
              <p>
                <b>盤點</b>：數一數實際有多少，按「盤點」填進去。跟帳上不一樣的差額會記成「現金短溢」，帳上就等於你數到的。用「約定」開帳的教室，建議每個月結帳前盤點一次。
              </p>
            </Sub>

            <Sub id="close" title="結帳與鎖帳">
              <p>
                <L href="/finance/close">結帳</L> 是一張清單，一項一項幫你檢查：過去的時段都點名了、未付款都處理了、有課的都設了分帳、帳本健康檢查、資金帳戶盤點（可略過）、各分部負責人看過損益表。每一項沒做完都會直接列出要去哪裡處理。
              </p>
              <p>
                清單看完，選<b>鎖到哪一天</b>按「鎖帳」。鎖住的日子不能再新增或改帳，這個月的報表就定了。<b>清單沒做完也可以鎖</b>，它只是提醒。
              </p>
              <FigLock />
              <Tip>
                鎖帳日往後推，可以結算的人都能做；往前移或解鎖只有教室擁有者能做，而且會留紀錄。<b>第一次鎖帳後就不能再重新開帳</b>。
              </Tip>
            </Sub>
          </Section>

          <Section id="reports" title="5. 看報表：每張報表回答一個問題">
            <p>
              <L href="/finance/reports">報表</L> 上都可以切分部、選期間；數字點下去會一路看到是哪一筆、哪張卡、哪堂課。
            </p>
            <FigCashGap />
            <Table
              head={["想知道", "看這張"]}
              rows={[
                ["這個月賺多少？台南跟高雄比？", "損益表（分部並排）"],
                ["今天手上有的、欠的、自己的各是多少？", "資產負債表"],
                ["錢從哪裡來、去哪裡了？", "現金流量"],
                ["還欠學生多少堂課的錢？", "預收餘額（逐張卡）"],
                ["誰還沒付錢？拖多久了？", "應收帳齡"],
                ["該付給老師、場地、業主多少？", "應付明細"],
                ["哪門課賺、哪門課虧？", "課程獲利"],
                ["記帳士要的", "試算表、總分類帳"],
              ]}
            />
          </Section>

          <Section id="faq" title="6. 常見疑惑與卡住的地方">
            {FAQ.map((g) => (
              <div key={g.group} className="flex flex-col gap-2">
                <h3 className="text-base font-semibold text-neutral-900">{g.group}</h3>
                <div className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
                  {g.items.map((f) => (
                    <details key={f.q} className="group px-4">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-3 font-medium text-neutral-900 [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">{f.q}</span>
                        <ChevronDown className="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="flex flex-col gap-1.5 pb-4 text-[14px] text-neutral-700">
                        <p>{f.a}</p>
                        {f.where && <p className="text-[13px] text-neutral-500">去哪裡：{f.where}</p>}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          <Section id="roles" title="7. 誰能做什麼">
            <p>財務目前<b>對所有成員透明</b>：每個人都看得到全部數字。能「動」的人分三種，在 <L href="/finance/settings#general">財務設定 → 成員與其他</L> 勾：</p>
            <Table
              head={["身分", "可以做"]}
              rows={[
                ["所有成員", "看所有財務頁和報表、照平常賣卡點名；建議擁有者把會拿錢的人都勾成保管人。"],
                ["保管人", "有自己的資金帳戶、可以當收款人；記自己付的支出和次數包；從自己的帳戶轉帳、盤點、按「標記已付款」。分部負責人、過期的錢給誰，都只能選保管人。"],
                ["可以結算", "建付款批次、作廢付款、替任何人按已付款；改分帳規則和財務設定；老闆放錢／拿錢、手動分錄、沖銷；退費；把鎖帳日往後推。"],
                ["教室擁有者", "開啟財務、開帳與重新開帳、把鎖帳日往前或解鎖，加上可以結算的所有事。"],
              ]}
            />
            <p className="text-[13px] text-neutral-500">最後一位保管人、最後一位可以結算的人不能被取消；保管人還是某分部負責人、過期收入對象或房東時，也要先換人才能取消。</p>
          </Section>
        </article>
      </div>
    </FinanceShell>
  );
}

/* ---------- 版面小元件 ---------- */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4">
      <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3 pt-2">
      <h3 className="text-[17px] font-semibold text-neutral-900">{title}</h3>
      {children}
    </section>
  );
}

function L({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-primary-800 underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-900 text-xs font-bold text-white">{i + 1}</span>
          <div className="min-w-0 flex-1 [&>div]:mt-2">{it}</div>
        </li>
      ))}
    </ol>
  );
}

function Stuck({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-warning-50 px-3.5 py-2.5 text-[14px] text-warning-950">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <b>容易卡住：</b>
        {children}
      </span>
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-primary-50 px-3.5 py-2.5 text-[14px] text-neutral-800">{children}</div>;
}

function Compare({ left, right }: { left: { title: string; body: string }; right: { title: string; body: string } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[left, right].map((c) => (
        <div key={c.title} className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <span className="font-semibold text-neutral-900">{c.title}</span>
          <span className="text-[14px] text-neutral-600">{c.body}</span>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows }: { head: [string, string]; rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
            <th scope="col" className="w-[34%] px-4 py-2 font-medium">{head[0]}</th>
            <th scope="col" className="px-4 py-2 font-medium">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b], i) => (
            <tr key={i} className="border-b border-neutral-100 align-top last:border-b-0">
              <th scope="row" className="px-4 py-2.5 text-left font-semibold text-neutral-900">{a}</th>
              <td className="px-4 py-2.5 text-neutral-700">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 名詞小抄：總覽上會看到的字。 */
function Terms() {
  const terms: [string, string][] = [
    ["資金帳戶", "某個人手上（或某個戶頭）屬於教室的錢。"],
    ["預收", "學生已經付、但課還沒上的錢——還欠學生的課。"],
    ["應收", "課上了（或卡賣了）但學生還沒付的錢。"],
    ["應付", "該付、還沒付給老師、場地、代墊的人的錢。"],
    ["公積金", "分部累積賺下來、還沒分出去的錢；屬於分部，不屬於某個人。"],
    ["分部往來", "一個分部替另一個分部收錢或付錢後，兩邊互欠的錢。"],
  ];
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {terms.map(([t, d]) => (
        <div key={t} className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5">
          <dt className="text-sm font-semibold text-neutral-900">{t}</dt>
          <dd className="text-[13px] text-neutral-600">{d}</dd>
        </div>
      ))}
    </dl>
  );
}

function MobileToc() {
  return (
    <details className="rounded-2xl border border-neutral-200 bg-white px-4 lg:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
        目錄
        <ChevronDown className="size-4 text-neutral-400" aria-hidden />
      </summary>
      <div className="flex flex-col pb-3">
        {TOC.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="whitespace-pre py-1.5 text-sm text-neutral-700">
            {t.label}
          </a>
        ))}
      </div>
    </details>
  );
}

/** 目前捲到哪一段（電腦版目錄高亮用）。 */
function useActiveSection(): string {
  const [active, setActive] = useState(TOC[0].id);
  useEffect(() => {
    const els = TOC.map((t) => document.getElementById(t.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return active;
}
