"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, Flag, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, fieldControlClass } from "@/components/Field";
import Select from "@/components/Select";
import SegmentedTabs from "@/components/SegmentedTabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { roleLabel } from "@/lib/roles";
import { TEACHER_KINDS, TEACHER_KIND_LABELS, type TeacherKind } from "@/lib/teachers";
import { cn } from "@/lib/utils";
import TeacherAvatar from "@/features/teachers/TeacherAvatar";
import TeacherForm from "@/features/teachers/TeacherForm";
import LocationForm from "@/features/locations/LocationForm";
import { useGetTeachersQuery, useUpdateTeacherMutation, type Teacher } from "@/store/slices/teachers";
import { useGetLocationsQuery } from "@/store/slices/locations";
import {
  usePreviewBuildMutation,
  useSaveBuildMutation,
  useSetRevenueOwnerMutation,
  useSetupFinanceMutation,
  type BuildBody,
  type FeeMode,
  type FinanceSettingState,
  type RemainderTo,
  type TeacherPay,
  type VenuePayee,
} from "@/store/slices/finance";
import { DateInput, MoneyInput, Panel } from "../ui";
import { dateKeyOf, dayLabel, errorText, money, parseMoneyInput, todayKey } from "../format";
import { financeHref } from "../routes";
import { fredoka } from "../town/fonts";
import { CoinIcon, CrateIcon, HammerIcon, HouseIcon, KeepIcon, StudioIcon } from "../town/icons";
import { KiwiAvatar } from "../town/sprites";
import { scarfOf } from "../town/townView";
import townStyles from "../town/town.module.css";
import BuildScene, { type BuildPerson, type BuildSceneData } from "./BuildScene";
import { BUILDS, CHAPTERS, QUESTION_COUNT, STAGE, questionNumber, sceneStage, type Stage } from "./stages";
import styles from "./build.module.css";

type VenueAnswer = { mode: FeeMode; amount: string; payee: VenuePayee; teacherId: number | null };
const NO_FEE: VenueAnswer = { mode: "NONE", amount: "", payee: "EXTERNAL", teacherId: null };
const FEE_MODES: { value: FeeMode; label: string }[] = [
  { value: "NONE", label: "不用" },
  { value: "PER_LESSON", label: "每堂固定" },
  { value: "PER_DAY", label: "每天固定" },
];
const PAY_OPTIONS: { value: TeacherPay; title: string; sub: string }[] = [
  { value: "NONE", title: "不用算", sub: "收入全部留在教室" },
  { value: "HOURLY", title: "每堂固定鐘點費", sub: "老師每堂拿固定的錢" },
  { value: "SPLIT", title: "拆帳", sub: "扣掉場地費、助教費和抽成，剩下的給老師" },
];
/** 老師的代表色（設計系統色盤 key）→ 奇異鳥圍巾色。 */
const SCARF_OF_COLOR: Record<string, string> = {
  blue: "#7FA8E0", orange: "#E9A86B", purple: "#B49AE0", teal: "#6CC3C9", pink: "#F2A7C3",
  indigo: "#8C9AE0", red: "#E58B7A", green: "#4BB38B", slate: "#9AA7B4", stone: "#BFAE98",
};
const CONFETTI = ["#F4A23C", "#4BB38B", "#E58B7A", "#7FA8E0", "#F6C344", "#B49AE0"];

const firstOfMonth = () => `${todayKey().slice(0, 8)}01`;
const shortDate = (dateKey: string) => `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8))}`;

function InfoTip({ children }: { children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger aria-label="說明" className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
        <Info className="size-5" />
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm leading-relaxed text-neutral-700">{children}</PopoverContent>
    </Popover>
  );
}

function OptionCard({ selected, onClick, title, sub, icon }: { selected: boolean; onClick: () => void; title: string; sub?: string; icon?: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl border-[1.5px] px-4 py-2.5 text-left",
        selected ? "border-primary-700 bg-primary-50" : "border-neutral-300 bg-white hover:bg-neutral-50"
      )}
    >
      <span aria-hidden="true" className={cn("size-5 shrink-0 rounded-full border-2", selected ? "border-[6px] border-primary-700" : "border-neutral-300")} />
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold text-neutral-900">{title}</span>
        {sub && <span className="text-[13px] leading-relaxed text-neutral-600">{sub}</span>}
      </span>
    </button>
  );
}

function ChapterList({ items }: { items: { n: number; title: string; sub: string }[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((c) => (
        <li key={c.n} className="flex items-center gap-3 border-t border-dashed border-neutral-200 py-2.5 first:border-t-0">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-warning-50 text-sm font-bold tabular-nums text-warning-950">{c.n}</span>
          <span className="flex flex-col">
            <span className="text-[15px] font-bold text-neutral-900">{c.title}</span>
            <span className="text-[13px] text-neutral-600">{c.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const LATER = [
  { n: 2, title: "居民", sub: "誰是老師、誰是助教" },
  { n: 3, title: "場地", sub: "在哪上課、場地費" },
  { n: 4, title: "分帳", sub: "老師怎麼拿錢" },
];

/**
 * 建城（設計稿「水庫建城（第一次設定）」）：左邊一題一題問，右邊小鎮一塊一塊蓋起來。
 * 第 1 章（主堡）答完就送 finance/setup，主堡能收錢了；第 2～4 章（居民、場地、分帳）
 * 老師身分、分部各自當場存，分帳規則在最後「開城」時一次送 finance/build。
 * 掛載時就決定從哪裡開始：還沒建城從頭；主堡蓋好了從居民開始。
 */
export default function BuildWizard({ state, meId }: { state: FinanceSettingState; meId: number }) {
  const router = useRouter();
  const compact = useSizeClass() === "compact";
  const saved = state.setting;
  const [startedReady] = useState(() => Boolean(saved?.setupCompletedAt));
  const [stage, setStage] = useState<Stage>(startedReady ? STAGE.TEACHERS : STAGE.INTRO);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [ownerId, setOwnerId] = useState<number | null>(saved?.revenueOwnerUserId ?? (state.canEdit ? null : meId));
  const [startDate, setStartDate] = useState(saved?.startDate ? dateKeyOf(saved.startDate) : todayKey());
  const [balance, setBalance] = useState(saved?.setupCompletedAt ? String(saved.openingBalance) : "");
  const [loan, setLoan] = useState<string | null>(saved?.setupCompletedAt ? (saved.openingOwnerLoan === null ? null : String(saved.openingOwnerLoan)) : "");
  const [custody, setCustody] = useState<Record<number, string>>(() =>
    Object.fromEntries((saved?.openingCustody ?? []).map((c) => [c.userId, String(c.amount)]))
  );
  const [kinds, setKinds] = useState<Record<number, TeacherKind>>({});
  const [venues, setVenues] = useState<Record<string, VenueAnswer>>({});
  const [teacherPay, setTeacherPay] = useState<TeacherPay | null>(null);
  const [hourlyFee, setHourlyFee] = useState("");
  const [assistantMode, setAssistantMode] = useState<FeeMode>("NONE");
  const [assistantAmount, setAssistantAmount] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [roundTo, setRoundTo] = useState<1 | 10 | 100>(1);
  const [remainderTo, setRemainderTo] = useState<RemainderTo>("FUND");
  const [teacherFormKey, setTeacherFormKey] = useState<number | null>(null);
  const [locationFormKey, setLocationFormKey] = useState<number | null>(null);

  const { data: teacherRows = [] } = useGetTeachersQuery();
  const { data: locationData } = useGetLocationsQuery();
  const [updateTeacher] = useUpdateTeacherMutation();
  const [setRevenueOwner, handOff] = useSetRevenueOwnerMutation();
  const [setupFinance] = useSetupFinanceMutation();
  const [previewBuild, preview] = usePreviewBuildMutation();
  const [saveBuild] = useSaveBuildMutation();

  const teachers = teacherRows.filter((t) => !t.archivedAt);
  const locations = (locationData?.locations ?? []).filter((l) => !l.archivedAt);
  const kindOf = (t: Teacher) => kinds[t.id] ?? t.kind;
  const owner = state.members.find((m) => m.id === ownerId);
  const others = state.members.filter((m) => m.id !== ownerId);
  const ownerName = owner?.name ?? "營收負責人";
  const targets = locations.length > 0
    ? locations.map((l) => ({ key: String(l.id), locationId: l.id as number | null, name: l.name }))
    : [{ key: "all", locationId: null as number | null, name: "場地費" }];
  const venueOf = (key: string) => venues[key] ?? NO_FEE;
  const setVenue = (key: string, patch: Partial<VenueAnswer>) => setVenues((v) => ({ ...v, [key]: { ...(v[key] ?? NO_FEE), ...patch } }));
  const teacherName = (id: number | null) => teacherRows.find((t) => t.id === id)?.name ?? "？";

  const body = (): BuildBody => ({
    teacherPay: teacherPay ?? "NONE",
    hourlyFee: teacherPay === "HOURLY" ? parseMoneyInput(hourlyFee) : null,
    assistantMode: teacherPay === "NONE" ? "NONE" : assistantMode,
    assistantAmount: teacherPay !== "NONE" && assistantMode !== "NONE" ? parseMoneyInput(assistantAmount) : null,
    commissionPct: teacherPay === "SPLIT" ? Number(commissionPct || 0) : null,
    roundTo,
    remainderTo,
    venues: targets.map((t) => {
      const v = venueOf(t.key);
      const on = v.mode !== "NONE";
      return {
        locationId: t.locationId,
        venueMode: v.mode,
        venueAmount: on ? parseMoneyInput(v.amount) : null,
        venuePayee: on ? v.payee : null,
        venueTeacherId: on && v.payee === "MEMBER" ? v.teacherId : null,
      };
    }),
  });
  const bodyKey = JSON.stringify(body());

  // 最後一題：用還沒存的答案算最近一堂；改取整方式就重算。
  useEffect(() => {
    if (stage !== STAGE.TRIAL) return;
    previewBuild(JSON.parse(bodyKey) as BuildBody);
  }, [stage, bodyKey, previewBuild]);

  const go = (s: Stage) => {
    setError(null);
    setStage(s);
  };

  const prevOf: Partial<Record<Stage, Stage | null>> = {
    [STAGE.OWNER]: STAGE.INTRO,
    [STAGE.START]: STAGE.OWNER,
    [STAGE.BALANCE]: STAGE.START,
    [STAGE.LOAN]: STAGE.BALANCE,
    [STAGE.CUSTODY]: STAGE.LOAN,
    [STAGE.TEACHERS]: startedReady ? null : STAGE.KEEP_DONE,
    [STAGE.PLACES]: STAGE.TEACHERS,
    [STAGE.VENUE_FEES]: STAGE.PLACES,
    [STAGE.PAY]: STAGE.VENUE_FEES,
    [STAGE.FEES]: STAGE.PAY,
    [STAGE.TRIAL]: teacherPay === "NONE" ? STAGE.PAY : STAGE.FEES,
  };
  const prev = prevOf[stage] ?? null;

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    setError(null);
    switch (stage) {
      case STAGE.INTRO:
        return go(STAGE.OWNER);
      case STAGE.OWNER:
        return ownerId ? go(STAGE.START) : setError("選一位成員");
      case STAGE.START:
        return startDate ? go(STAGE.BALANCE) : setError("選一個日期");
      case STAGE.BALANCE:
        return parseMoneyInput(balance) === null ? setError("填一個數字，沒有就填 0") : go(STAGE.LOAN);
      case STAGE.LOAN:
        return loan && parseMoneyInput(loan) === null ? setError("填一個數字，或按「略過」") : go(STAGE.CUSTODY);
      case STAGE.CUSTODY:
        return run(async () => {
          await setupFinance({
            revenueOwnerUserId: ownerId!,
            startDate,
            openingBalance: parseMoneyInput(balance) ?? 0,
            openingOwnerLoan: loan ? parseMoneyInput(loan) : null,
            openingCustody: others
              .map((m) => ({ userId: m.id, amount: parseMoneyInput(custody[m.id] ?? "") ?? 0 }))
              .filter((c) => c.amount > 0),
          }).unwrap();
          go(STAGE.KEEP_DONE);
        });
      case STAGE.KEEP_DONE:
        return go(STAGE.TEACHERS);
      case STAGE.TEACHERS:
        return run(async () => {
          const changed = teachers.filter((t) => kinds[t.id] && kinds[t.id] !== t.kind);
          await Promise.all(changed.map((t) => updateTeacher({ id: t.id, kind: kinds[t.id] }).unwrap()));
          go(STAGE.PLACES);
        });
      case STAGE.PLACES:
        return go(STAGE.VENUE_FEES);
      case STAGE.VENUE_FEES: {
        for (const t of targets) {
          const v = venueOf(t.key);
          if (v.mode === "NONE") continue;
          if (!parseMoneyInput(v.amount)) return setError(`${t.name}：填場地費多少錢`);
          if (v.payee === "MEMBER" && !v.teacherId) return setError(`${t.name}：選付給誰`);
        }
        return go(STAGE.PAY);
      }
      case STAGE.PAY:
        if (!teacherPay) return setError("選一個");
        if (teacherPay === "HOURLY" && !parseMoneyInput(hourlyFee)) return setError("填每堂鐘點費");
        return go(teacherPay === "NONE" ? STAGE.TRIAL : STAGE.FEES);
      case STAGE.FEES: {
        if (assistantMode !== "NONE" && !parseMoneyInput(assistantAmount)) return setError("填助教費多少錢");
        const pct = Number(commissionPct || 0);
        if (teacherPay === "SPLIT" && (!Number.isInteger(pct) || pct < 0 || pct > 100)) return setError("抽成填 0～100");
        return go(STAGE.TRIAL);
      }
      case STAGE.TRIAL:
        return run(async () => {
          await saveBuild(body()).unwrap();
          go(STAGE.DONE);
        });
      default:
        return router.push(financeHref.home);
    }
  };

  const handOver = () =>
    run(async () => {
      await setRevenueOwner(ownerId!).unwrap();
      toast.success(`交給 ${owner?.name} 了，他登入後會看到建城任務`);
      go(STAGE.INTRO);
    });

  // ---------- 小鎮要畫的東西
  const loanAmount = loan ? parseMoneyInput(loan) : null;
  const holders = others
    .map((m) => ({ m, amount: parseMoneyInput(custody[m.id] ?? "") ?? 0 }))
    .filter((h) => h.amount > 0);
  const people: BuildPerson[] = [
    ...holders.map(({ m, amount }) => {
      const t = teachers.find((x) => x.userId === m.id);
      return { key: `u${m.id}`, name: m.name, scarf: scarfOf(m.id), pack: true, from: STAGE.CUSTODY as Stage, kindLabel: t ? TEACHER_KIND_LABELS[kindOf(t)] : null, amount };
    }),
    ...teachers
      .filter((t) => t.userId !== ownerId && !holders.some((h) => h.m.id === t.userId))
      .map((t) => ({
        key: `t${t.id}`,
        name: t.name,
        scarf: t.userId ? scarfOf(t.userId) : SCARF_OF_COLOR[t.color] ?? "#7FA8E0",
        pack: false,
        from: STAGE.TEACHERS as Stage,
        kindLabel: TEACHER_KIND_LABELS[kindOf(t)],
        amount: null,
      })),
  ].slice(0, 4);
  const ownerTeacher = teachers.find((t) => t.userId === ownerId);
  const feeLabel = (v: VenueAnswer) => {
    const amount = parseMoneyInput(v.amount);
    if (v.mode === "NONE" || !amount) return null;
    return `${money(amount)}／${v.mode === "PER_DAY" ? "天" : "堂"}`;
  };
  const pct = Number(commissionPct || 0);
  const scene: BuildSceneData = {
    ownerName: owner?.name ?? null,
    ownerKindLabel: ownerTeacher ? TEACHER_KIND_LABELS[kindOf(ownerTeacher)] : null,
    openLabel: startDate ? `${shortDate(startDate)} 開張` : null,
    balance: parseMoneyInput(balance) ?? 0,
    loan: loanAmount || null,
    people,
    venues: targets.slice(0, 2).map((t) => {
      const v = venueOf(t.key);
      return {
        key: t.key,
        name: t.locationId ? t.name : "教室",
        fee: feeLabel(v),
        payee: v.mode === "NONE" ? null : v.payee === "MEMBER" ? `給${teacherName(v.teacherId)}` : "外面的場地",
      };
    }),
    fundLabel: teacherPay === "SPLIT" && pct > 0 ? `抽 ${pct}%` : teacherPay === "NONE" ? "收入都留下" : "留在教室的錢",
  };

  // ---------- 每一步
  const n = questionNumber(stage);
  const chapter = CHAPTERS.find((c) => stage >= c.from && stage <= c.to);
  const eyebrow = n && chapter ? `${chapter.label} · ${n} / ${QUESTION_COUNT}${stage === STAGE.LOAN ? " · 可以略過" : ""}` : null;
  const backButton = prev !== null && (
    <Button variant="secondary" size="lg" onClick={() => go(prev)} disabled={busy}>
      上一步
    </Button>
  );
  const nextButton = (label = "下一步", icon?: ReactNode) => (
    <Button size="lg" className="flex-1" onClick={next} isLoading={busy}>
      {icon}
      {label}
    </Button>
  );

  let title = "";
  let desc: ReactNode = null;
  let tip: ReactNode = null;
  let content: ReactNode = null;
  let footer: ReactNode = (
    <>
      {backButton}
      {nextButton()}
    </>
  );

  switch (stage) {
    case STAGE.INTRO:
      title = "蓋一座主堡";
      desc = "回答幾個問題，小鎮就會一塊一塊蓋起來。蓋好，水庫就開始記帳。";
      tip = "先準備：Excel「大水庫結餘」最後的數字、存摺餘額、手上的現金。";
      content = (
        <>
          <ChapterList items={[{ n: 1, title: "主堡", sub: "錢放在哪、現在有多少 · 5 題" }, ...LATER.map((c, i) => ({ ...c, sub: `${c.sub} · ${[1, 2, 3][i]} 題` }))]} />
          <p className="rounded-xl bg-neutral-50 px-4 py-3 text-[13px] leading-relaxed text-neutral-600">蓋好主堡就能開始收錢，後面三塊可以之後再蓋。</p>
        </>
      );
      footer = nextButton("開始建城");
      break;

    case STAGE.OWNER:
      title = "誰保管公司的錢？";
      desc = "他會戴上皇冠，負責確認大家送回來的錢。";
      tip = "只有他看得到「收到了」、能記大水庫的支出，有人送錢來也通知他。之後可以在水庫設定換人。";
      content = state.canEdit ? (
        <>
          <div role="radiogroup" aria-label="營收負責人" className="flex flex-col gap-2">
            {state.members.map((m) => (
              <OptionCard
                key={m.id}
                selected={ownerId === m.id}
                onClick={() => setOwnerId(m.id)}
                icon={<KiwiAvatar scarf={scarfOf(m.id)} size={36} bg="#FFF3D9" />}
                title={`${m.name}${m.id === meId ? "（我）" : ""}`}
                sub={roleLabel(m.role)}
              />
            ))}
          </div>
          {ownerId && ownerId !== meId && (
            <p className="text-sm text-neutral-600">
              {owner?.name} 不在旁邊？
              <Button variant="link" onClick={handOver} disabled={handOff.isLoading}>
                交給他填後面的題目
              </Button>
            </p>
          )}
        </>
      ) : (
        <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-900">營收負責人是你。要換人請管理員到水庫設定換。</p>
      );
      break;

    case STAGE.START:
      title = "從哪天開始記帳？";
      desc = "這天之後的收款記在這裡，之前的留在 Excel。";
      tip = "這天之前付款的課卡不算代收。從月初開始最好對帳，月結剛好從這天算。";
      content = (
        <>
          <div className="flex flex-wrap gap-2">
            {[{ label: "今天", value: todayKey() }, { label: "這個月 1 號", value: firstOfMonth() }].map((o) => (
              <Button key={o.label} size="sm" variant={startDate === o.value ? "primary" : "secondary"} aria-pressed={startDate === o.value} onClick={() => setStartDate(o.value)}>
                {o.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="build-start">啟用日</FieldLabel>
            <DateInput id="build-start" value={startDate} max={todayKey()} onChange={setStartDate} />
          </div>
        </>
      );
      break;

    case STAGE.BALANCE: {
      title = "大水庫現在有多少錢？";
      desc = "現金加銀行，一個數就好。";
      tip = "可以先抄 Excel「大水庫結餘」最後的累計數，再跟存摺、手上的現金對一下。學生付了、還沒上的課不用填，系統從課卡算。";
      const crates = Math.min(48, Math.round((parseMoneyInput(balance) ?? 0) / 1000));
      content = (
        <>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="build-balance">現金＋銀行</FieldLabel>
            <MoneyInput id="build-balance" value={balance} onChange={setBalance} autoFocus error={!!error} />
          </div>
          {crates > 0 && (
            <p className="flex items-center gap-2 text-sm text-neutral-600">
              <CrateIcon tone="fund" />
              倉庫會堆 <strong className="tabular-nums text-neutral-900">{crates}</strong> 箱，一箱大約 $1,000
            </p>
          )}
        </>
      );
      break;
    }

    case STAGE.LOAN:
      title = "你自己放了多少錢進來？";
      desc = "前期投入、自己掏錢補的。只記帳，不排還款。";
      tip = "填了會立一塊建城貸款看板，大家看得到回本進度（水庫基金 ÷ 建城貸款）。略過的話之後在水庫設定補。";
      content = loan === null ? (
        <p className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          已略過
          <Button variant="link" onClick={() => setLoan("")}>
            還是要填
          </Button>
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="build-loan">建城貸款</FieldLabel>
          <MoneyInput id="build-loan" value={loan} onChange={setLoan} autoFocus error={!!error} />
        </div>
      );
      footer = (
        <>
          {backButton}
          <Button variant="ghost" size="lg" onClick={() => { setLoan(null); go(STAGE.CUSTODY); }}>
            略過
          </Button>
          {nextButton()}
        </>
      );
      break;

    case STAGE.CUSTODY:
      title = "誰手上還有沒交的錢？";
      desc = `收了學生的錢、還沒交給 ${ownerName} 的。沒有就空著。`;
      tip = "每人一個數，會變成他背包裡的錢，之後用推車送回主堡。";
      content = (
        <div className="flex flex-col gap-3">
          {others.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <KiwiAvatar scarf={scarfOf(m.id)} accessory="pack" size={36} bg="#FFF3D9" />
              <label htmlFor={`build-custody-${m.id}`} className="min-w-0 flex-1 truncate text-sm font-bold text-neutral-900">
                {m.name}
              </label>
              <div className="w-36">
                <MoneyInput id={`build-custody-${m.id}`} value={custody[m.id] ?? ""} onChange={(v) => setCustody((c) => ({ ...c, [m.id]: v }))} />
              </div>
            </div>
          ))}
          {others.length === 0 && <p className="text-sm text-neutral-600">教室裡沒有其他成員，直接下一步。</p>}
        </div>
      );
      footer = (
        <>
          {backButton}
          {nextButton("蓋好主堡")}
        </>
      );
      break;

    case STAGE.KEEP_DONE:
      title = "主堡可以收錢了！";
      desc = `代收、繳回、大水庫的帳，從 ${shortDate(startDate)} 開始記。`;
      content = state.canEdit ? (
        <>
          <div className="rounded-2xl bg-warning-50 px-4 py-3">
            <p className="text-[15px] font-bold text-neutral-900">下一步：老師怎麼分錢</p>
            <p className="text-[13px] text-neutral-600">大約 5 分鐘</p>
            <ChapterList items={LATER} />
          </div>
          <p className="rounded-xl bg-neutral-50 px-4 py-3 text-[13px] leading-relaxed text-neutral-600">先到這裡也可以：分帳先「不用算」，收入全部留在教室，之後在新手任務接著蓋。</p>
        </>
      ) : (
        <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600">居民、場地、分帳要請能改水庫設定的人來蓋。在那之前分帳先「不用算」，收入全部留在教室。</p>
      );
      footer = state.canEdit ? (
        <>
          <Button variant="secondary" size="lg" onClick={() => go(STAGE.PAUSED)}>
            先到這裡
          </Button>
          {nextButton("繼續蓋")}
        </>
      ) : (
        <Button size="lg" className="flex-1" onClick={() => router.push(financeHref.home)}>
          去小鎮
        </Button>
      );
      break;

    case STAGE.TEACHERS:
      title = "誰是老師、誰是助教？";
      desc = "點名時用得到。沒帳號的人也可以加。";
      tip = "只當助教的人，排課選老師時不會出現；只教課的人，點名選助教時不會出現。之後在老師頁也能改。";
      content = (
        <>
          {teachers.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">還沒有老師。按下面加一位，或之後在老師頁加。</p>
          ) : (
            <ul className="flex flex-col">
              {teachers.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-100 py-2.5 first:border-t-0">
                  <TeacherAvatar name={t.name} color={t.color} size="sm" />
                  <span className="flex min-w-24 flex-1 flex-col">
                    <span className="text-[15px] font-bold text-neutral-900">{t.name}</span>
                    <span className="text-xs text-neutral-500">{t.userId ? "有帳號" : "沒帳號"}</span>
                  </span>
                  <SegmentedTabs<TeacherKind>
                    ariaLabel={`${t.name} 的身分`}
                    options={TEACHER_KINDS.map((value) => ({ value, label: TEACHER_KIND_LABELS[value] }))}
                    value={kindOf(t)}
                    onChange={(kind) => setKinds((k) => ({ ...k, [t.id]: kind }))}
                  />
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" onClick={() => setTeacherFormKey(Date.now())}>
            <Plus aria-hidden="true" />
            再加一位
          </Button>
        </>
      );
      break;

    case STAGE.PLACES:
      title = "你們在哪裡上課？";
      desc = "每個地方會蓋一間教室。";
      tip = "就是分部設定裡的地方，只有一個地方也可以。課卡每個地方都能用，錢一樣回到主堡。";
      content = (
        <>
          {locations.length === 0 ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600">只在一個地方上課，就不用加，直接下一步。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {locations.map((l, i) => (
                <li key={l.id} className="flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] border-neutral-200 bg-white px-4 py-2">
                  {i % 2 === 0 ? <HouseIcon size={30} /> : <StudioIcon size={30} />}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-bold text-neutral-900">{l.name}</span>
                    {l.address && <span className="truncate text-xs text-neutral-500">{l.address}</span>}
                  </span>
                  <Check className="size-5 text-primary-700" aria-hidden="true" />
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" onClick={() => setLocationFormKey(Date.now())}>
            <Plus aria-hidden="true" />
            加一個地方
          </Button>
        </>
      );
      break;

    case STAGE.VENUE_FEES:
      title = "場地要付錢嗎？";
      desc = targets.length > 1 ? "每個地方各自設。" : "每堂或每天固定付一筆，就在這裡設。";
      tip = "每天固定：當天的課平攤，早的堂多 1 元。付給成員會算進他的薪水；付給外面的場地，付場租時在大水庫記一筆。";
      content = (
        <div className="flex flex-col gap-3">
          {targets.map((t, i) => {
            const v = venueOf(t.key);
            const payeeValue = v.payee === "MEMBER" && v.teacherId ? `t${v.teacherId}` : "EXTERNAL";
            return (
              <fieldset key={t.key} className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-neutral-200 bg-white p-4">
                <legend className="flex items-center gap-2 px-1 text-[15px] font-bold text-neutral-900">
                  {t.locationId && (i % 2 === 0 ? <HouseIcon size={22} /> : <StudioIcon size={22} />)}
                  {t.name}
                </legend>
                <SegmentedTabs<FeeMode> ariaLabel={`${t.name} 怎麼算`} fill options={FEE_MODES} value={v.mode} onChange={(mode) => setVenue(t.key, { mode })} />
                {v.mode !== "NONE" && (
                  <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3">
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel htmlFor={`build-venue-${t.key}`}>{v.mode === "PER_DAY" ? "每天" : "每堂"}</FieldLabel>
                      <MoneyInput id={`build-venue-${t.key}`} value={v.amount} onChange={(amount) => setVenue(t.key, { amount })} />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <FieldLabel>付給</FieldLabel>
                      <Select<string>
                        aria-label={`${t.name} 付給誰`}
                        value={payeeValue}
                        onChange={(value) =>
                          setVenue(t.key, value === "EXTERNAL" ? { payee: "EXTERNAL", teacherId: null } : { payee: "MEMBER", teacherId: Number(value.slice(1)) })
                        }
                        options={[{ value: "EXTERNAL", label: "外面的場地" }, ...teachers.map((x) => ({ value: `t${x.id}`, label: x.name }))]}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      );
      break;

    case STAGE.PAY:
      title = "老師怎麼拿錢？";
      desc = "選最接近的。例外之後在分帳規則設。";
      tip = "一堂有兩位老師：預設平分，之後可以在每門課設比例。";
      content = (
        <>
          <div role="radiogroup" aria-label="老師怎麼拿錢" className="flex flex-col gap-2">
            {PAY_OPTIONS.map((o) => (
              <OptionCard key={o.value} selected={teacherPay === o.value} onClick={() => setTeacherPay(o.value)} title={o.title} sub={o.sub} />
            ))}
          </div>
          {teacherPay === "HOURLY" && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="build-hourly">每堂鐘點費</FieldLabel>
              <MoneyInput id="build-hourly" value={hourlyFee} onChange={setHourlyFee} />
            </div>
          )}
        </>
      );
      break;

    case STAGE.FEES:
      title = teacherPay === "SPLIT" ? "助教費和教室抽成" : "助教費";
      desc = "都在分給老師之前扣。";
      tip = teacherPay === "SPLIT"
        ? "抽成 ＝（收入 − 場地費 − 助教費）× %，四捨五入到元，進水庫基金。不抽就填 0。"
        : "助教費跟場地費一樣，每堂或每天固定。點名時記了誰當助教，就算給誰。";
      content = (
        <>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>助教費</FieldLabel>
            <SegmentedTabs<FeeMode> ariaLabel="助教費怎麼算" fill options={FEE_MODES} value={assistantMode} onChange={setAssistantMode} />
          </div>
          {assistantMode !== "NONE" && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="build-assistant">{assistantMode === "PER_DAY" ? "每天" : "每堂"}</FieldLabel>
              <MoneyInput id="build-assistant" value={assistantAmount} onChange={setAssistantAmount} />
            </div>
          )}
          {teacherPay === "SPLIT" && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="build-commission">教室抽成</FieldLabel>
              <div className={cn(fieldControlClass(), "flex h-12 w-36 items-center gap-1.5")}>
                <input
                  id="build-commission"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  className="min-w-0 flex-1 bg-transparent text-base tabular-nums outline-none"
                />
                <span className="text-neutral-500" aria-hidden="true">%</span>
              </div>
              <p className="text-[13px] text-neutral-500">抽到的錢進水庫基金</p>
            </div>
          )}
        </>
      );
      break;

    case STAGE.TRIAL: {
      title = "用一堂真的課算算看";
      tip = "用最近點過名的一堂課，照剛剛的答案算。不對就回上一步改，之後也能在分帳規則改。";
      const p = preview.data;
      const s = p?.split;
      const teach = s ? s.teacherLines.reduce((sum, l) => sum + l.amount, 0) : 0;
      const where = p?.locationId ? locations.find((l) => l.id === p.locationId)?.name : null;
      content = preview.isLoading && !p ? (
        <div className="h-48 animate-pulse rounded-2xl bg-neutral-100" />
      ) : !p || !s ? (
        <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-600">最近還沒有點過名的課，開城之後點完名，驗收頁就算得出來。</p>
      ) : (
        <>
          <div className="flex flex-col rounded-2xl bg-warning-50 px-4 py-3 tabular-nums">
            <span className="text-[15px] font-bold text-neutral-900">{dayLabel(p.startTime)} {p.lessonName}{where ? ` · ${where}` : ""}</span>
            <span className="mb-1 text-[13px] text-neutral-600">{p.attendeeCount} 人次{p.periodsThatDay > 1 ? ` · 這天 ${p.periodsThatDay} 堂` : ""}</span>
            {[
              ["點名收入", money(s.revenue), false],
              ...(s.venueFee ? [["場地費", `−${money(s.venueFee)}`, false]] : []),
              ...(s.assistantFee ? [["助教費", `−${money(s.assistantFee)}`, false]] : []),
              ...(teacherPay === "SPLIT" ? [[`教室抽成 ${pct}%`, `−${money(s.commission)}`, false]] : []),
              ...(teacherPay !== "NONE" ? [[teacherPay === "HOURLY" ? "鐘點費" : "分給老師", money(teach), true]] : []),
              ["留在教室", money(s.fund, { signed: true }), teacherPay === "NONE"],
            ].map(([k, v, strong]) => (
              <div key={k as string} className={cn("flex justify-between gap-3 border-t border-warning-100 py-1.5 text-sm first:border-t-0", strong && "font-bold")}>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
          {teacherPay === "SPLIT" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <FieldLabel>老師實拿取整</FieldLabel>
                  <Select<number>
                    aria-label="老師實拿取整"
                    value={roundTo}
                    onChange={(v) => setRoundTo(v as 1 | 10 | 100)}
                    options={[{ value: 1, label: "不取整" }, { value: 10, label: "捨去到十位" }, { value: 100, label: "捨去到百位" }]}
                    className="w-full"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <FieldLabel>零頭歸</FieldLabel>
                  <Select<RemainderTo>
                    aria-label="零頭歸誰"
                    value={remainderTo}
                    onChange={setRemainderTo}
                    options={[{ value: "FUND", label: "水庫基金" }, { value: "REVENUE_OWNER", label: `營收負責人 ${ownerName}` }]}
                    className="w-full"
                  />
                </div>
              </div>
              {s.teacherLines.length > 0 && (
                <p className="text-sm leading-relaxed text-neutral-600">
                  → {s.teacherLines.map((l) => `${teacherName(l.teacherId)} 實拿 ${money(l.amount)}`).join("、")}
                  {s.remainder > 0 && `，零頭 ${money(s.remainder)} ${s.remainderTeacherId ? `給${teacherName(s.remainderTeacherId)}` : "進水庫基金"}`}
                </p>
              )}
            </>
          )}
        </>
      );
      footer = (
        <>
          {backButton}
          {nextButton("開城！", <Flag aria-hidden="true" />)}
        </>
      );
      break;
    }

    case STAGE.DONE:
      title = "主堡完工！";
      desc = `水庫從 ${shortDate(startDate)} 開始記帳。`;
      content = (
        <>
          <dl className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {[
              ["主堡", `${ownerName} 保管 · ${money(parseMoneyInput(balance) ?? 0)}`],
              ["居民", `${teachers.length} 位`],
              ["場地", locations.length ? locations.map((l) => l.name).join("、") : "一個地方"],
              ["分帳", PAY_OPTIONS.find((o) => o.value === (teacherPay ?? "NONE"))!.title + (teacherPay === "SPLIT" ? ` · 抽 ${pct}%` : "")],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 px-4 py-3 text-sm">
                <dt className="w-10 shrink-0 font-bold text-neutral-500">{k}</dt>
                <dd className="min-w-0 font-bold text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] font-bold text-neutral-500">接下來</p>
          <Link href={financeHref.home} className="flex min-h-12 items-center gap-3 rounded-2xl border-[1.5px] border-neutral-200 bg-white px-4 text-[15px] font-bold text-neutral-900 hover:bg-neutral-50">
            <span className="flex-1">新手任務：加入主畫面、試玩推車</span>
            <ChevronRight className="size-5 text-neutral-500" aria-hidden="true" />
          </Link>
        </>
      );
      footer = nextButton("去小鎮");
      break;

    case STAGE.PAUSED:
      title = "主堡先開張了";
      desc = "分帳先「不用算」，收入全部留在教室。";
      content = (
        <div className="rounded-2xl bg-neutral-50 px-4 py-3">
          <p className="text-[15px] font-bold text-neutral-900">還沒蓋</p>
          <p className="text-[13px] text-neutral-600">之後在新手任務點「繼續蓋」</p>
          <ChapterList items={LATER} />
        </div>
      );
      footer = (
        <>
          <Button variant="secondary" size="lg" onClick={() => router.push(financeHref.home)}>
            去小鎮
          </Button>
          <Button size="lg" className="flex-1" onClick={() => go(STAGE.TEACHERS)}>
            繼續蓋
          </Button>
        </>
      );
      break;
  }

  const shown = sceneStage(stage);
  const sceneBlock = (
    <div className={cn(townStyles.root, fredoka.variable, "relative", compact ? "h-[300px]" : "h-full min-h-0")} style={{ backgroundColor: "#F1EEDF" }}>
      <BuildScene stage={shown} data={scene} compact={compact} />
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2 lg:left-5 lg:top-5">
        {[
          { from: STAGE.LOAN, icon: <CoinIcon size={compact ? 20 : 24} />, n: money(scene.balance).replace("$", ""), l: "財庫", show: true },
          { from: STAGE.CUSTODY, icon: <HammerIcon size={compact ? 18 : 22} />, n: scene.loan ? money(scene.loan).replace("$", "") : "", l: "建城貸款", show: !compact && Boolean(scene.loan) },
          { from: STAGE.TEACHERS + 1, icon: <KiwiAvatar scarf="#7FA8E0" size={compact ? 20 : 26} bg="#EAF1FB" />, n: String(teachers.length), l: "居民", show: true },
          { from: STAGE.VENUE_FEES, icon: <HouseIcon size={compact ? 18 : 22} />, n: String(Math.max(1, locations.length)), l: "場地", show: true },
        ]
          .filter((p) => p.show)
          .map((p) => (
            <div
              key={p.l}
              className={cn(
                styles.pc, styles.pop, styles.pill, shown >= p.from && styles.on,
                "flex items-center gap-1.5 rounded-full bg-[#FFFDF7] py-1 pl-1 pr-3 shadow-[0_2px_0_rgba(77,66,57,.10),0_6px_18px_rgba(77,66,57,.10)]"
              )}
            >
              <span className="grid size-7 place-items-center rounded-full bg-[#FFF3D9] lg:size-8">{p.icon}</span>
              <span className="text-[15px] font-semibold tabular-nums lg:text-lg">{p.n}</span>
              <span className="text-[11px] font-medium text-[#76675A] lg:text-xs">{p.l}</span>
            </div>
          ))}
      </div>
      <p className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#FFFDF7] py-1.5 pl-2 pr-4 text-[13px] font-bold shadow-[0_2px_0_rgba(77,66,57,.10),0_8px_22px_rgba(77,66,57,.14)] lg:bottom-5 lg:text-sm">
        <HammerIcon size={20} />
        {BUILDS[stage]}
      </p>
      {stage === STAGE.DONE && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className={styles.confetti} style={{ left: `${5 + ((i * 37) % 90)}%`, backgroundColor: CONFETTI[i % CONFETTI.length], animationDelay: `${(i * 53) % 600}ms` }} />
          ))}
        </div>
      )}
    </div>
  );

  const status = (c: (typeof CHAPTERS)[number]) =>
    stage === STAGE.DONE || stage > c.to || (c.to === STAGE.CUSTODY && (stage === STAGE.KEEP_DONE || stage === STAGE.PAUSED))
      ? "done"
      : stage >= c.from && stage <= c.to
        ? "current"
        : "todo";

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white lg:grid lg:h-[680px] lg:grid-cols-[440px_minmax(0,1fr)]">
      {compact && sceneBlock}
      <section aria-label="建城問題" className="flex min-h-0 flex-col">
        <header className="flex flex-col gap-3 px-5 pt-5 lg:px-7 lg:pt-6">
          <div className="flex items-center gap-2 text-[15px] font-bold text-neutral-900">
            <KeepIcon size={24} />
            水庫建城
          </div>
          <ol className="grid grid-cols-4 gap-1.5" aria-label="建城進度">
            {CHAPTERS.map((c) => {
              const st = status(c);
              return (
                <li key={c.label} className="flex flex-col gap-1.5">
                  <span aria-hidden="true" className={cn("h-1.5 rounded-full transition-colors", st === "done" ? "bg-primary-600" : st === "current" ? "bg-warning-300" : "bg-neutral-200")} />
                  <span className={cn("flex items-center gap-1 text-xs", st === "current" ? "font-bold text-neutral-900" : st === "done" ? "text-primary-900" : "text-neutral-500")}>
                    {st === "done" && <Check className="size-3" aria-hidden="true" />}
                    {c.label}
                    <span className="sr-only">{st === "done" ? "（完成）" : st === "current" ? "（進行中）" : "（還沒）"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 lg:px-7">
          {eyebrow && <p className="text-[13px] font-bold text-neutral-500">{eyebrow}</p>}
          <div className="flex items-start gap-1">
            <h2 className="flex-1 text-xl font-bold text-neutral-900 lg:text-2xl">{title}</h2>
            {tip && <InfoTip>{tip}</InfoTip>}
          </div>
          {desc && <p className="-mt-2 text-sm leading-relaxed text-neutral-600">{desc}</p>}
          {content}
          <FieldError>{error}</FieldError>
        </div>
        <footer className="flex gap-3 border-t border-neutral-100 px-5 py-4 lg:px-7">{footer}</footer>
      </section>
      {!compact && sceneBlock}
      {teacherFormKey !== null && <TeacherForm key={teacherFormKey} open onClose={() => setTeacherFormKey(null)} />}
      {locationFormKey !== null && <LocationForm key={locationFormKey} open all={locationData?.locations ?? []} onClose={() => setLocationFormKey(null)} />}
    </div>
  );
}

/** 已經蓋好、或沒有權限蓋後面三章的人打開建城頁時看到的。 */
export function BuildClosed({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <Panel className="max-w-[560px]">
      <div className="flex items-center gap-3">
        <KeepIcon size={40} />
        <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      </div>
      <p className="text-sm leading-relaxed text-neutral-600">{body}</p>
      <Link href={href} className="text-sm font-semibold text-primary-700">
        {cta} ›
      </Link>
    </Panel>
  );
}
