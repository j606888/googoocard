"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Select from "@/components/Select";
import SegmentedTabs from "@/components/SegmentedTabs";
import { FieldLabel } from "@/components/Field";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCan } from "@/hooks/useCan";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useGetLocationsQuery } from "@/store/slices/locations";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import {
  useGetSplitRulesQuery,
  useSaveSplitRuleMutation,
  type FeeMode,
  type RuleScope,
  type SplitRuleBody,
  type SplitRuleRow,
  type TeacherPay,
} from "@/store/slices/finance";
import { MoneyInput, Panel } from "../ui";
import { dayLabel, errorText, parseMoneyInput } from "../format";

const INHERIT = "INHERIT" as const;
type Maybe<T extends string> = T | typeof INHERIT;

/** 每一層各自最新的那列（effectiveFrom 最晚；同一天取後建的）。 */
function latestBy(rows: SplitRuleRow[], key: (r: SplitRuleRow) => string) {
  const map = new Map<string, SplitRuleRow>();
  for (const row of rows) {
    const k = key(row);
    const cur = map.get(k);
    if (!cur || row.effectiveFrom > cur.effectiveFrom || (row.effectiveFrom === cur.effectiveFrom && row.id > cur.id)) map.set(k, row);
  }
  return map;
}

const since = (row?: SplitRuleRow) =>
  !row ? null : new Date(row.effectiveFrom).getTime() === 0 ? "從頭算" : `${dayLabel(row.effectiveFrom).split("（")[0]} 起`;

/**
 * 分帳規則：全教室 → 分部 → 課程三層，下一層只寫不一樣的，沒寫就沿用上一層。
 * 只有能改水庫的人可以存；大家都看得到。
 */
export default function RulesPage() {
  const { data: rules, isLoading } = useGetSplitRulesQuery();
  const { data: locationsData } = useGetLocationsQuery();
  const canEdit = useCan("finance.edit");
  const [adding, setAdding] = useState<number | null>(null);

  const latest = useMemo(() => latestBy(rules ?? [], (r) => `${r.scope}:${r.locationId ?? ""}:${r.lessonId ?? ""}`), [rules]);
  const classroom = latest.get("CLASSROOM::");
  const locations = (locationsData?.locations ?? []).filter((l) => !l.archivedAt);
  const lessonRules = [...latest.values()].filter((r) => r.scope === "LESSON");

  if (isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-neutral-900">分帳規則</h2>
        <Popover>
          <PopoverTrigger aria-label="說明" className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100">
            <Info className="size-5" />
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm leading-relaxed text-neutral-700">
            <p>點名收入 − 場地費 − 助教費 − 抽成 ＝ 分給這堂的老師。</p>
            <p className="mt-2">三層：全教室 → 分部 → 課程。下一層只寫不一樣的，沒寫就沿用上一層。</p>
            <p className="mt-2">某一層第一次設＝從頭算；之後改的從下個月 1 號生效。</p>
            <p className="mt-2">每天固定的費用由當天的課平攤，除不盡的早的堂多 1 元。</p>
          </PopoverContent>
        </Popover>
      </div>

      <LayerForm key={`c${classroom?.id ?? 0}`} scope="CLASSROOM" title="全教室" row={classroom} canEdit={canEdit} />

      {locations.map((location) => {
        const row = latest.get(`LOCATION:${location.id}:`);
        return <LayerForm key={`l${location.id}-${row?.id ?? 0}`} scope="LOCATION" locationId={location.id} title={location.name} row={row} canEdit={canEdit} />;
      })}

      {lessonRules.map((row) => (
        <LayerForm key={`x${row.id}`} scope="LESSON" lessonId={row.lessonId!} row={row} canEdit={canEdit} />
      ))}
      {adding !== null && <LayerForm key={`new${adding}`} scope="LESSON" lessonId={adding} canEdit={canEdit} />}
      {canEdit && <AddException exclude={lessonRules.map((r) => r.lessonId!)} onPick={setAdding} />}
    </div>
  );
}

function AddException({ exclude, onPick }: { exclude: number[]; onPick: (lessonId: number) => void }) {
  const { data } = useGetLessonsQuery({ tab: "inProgress", sort: "name" });
  const options = (data?.lessons ?? []).filter((l) => !exclude.includes(l.id)).map((l) => ({ value: l.id, label: l.name }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Plus className="size-4 text-primary-700" />
      <span className="text-sm font-medium text-primary-900">加一個課程例外</span>
      <Select<number> size="sm" options={options} placeholder="選一門課" onChange={onPick} aria-label="選課程" />
    </div>
  );
}

const FEE_OPTIONS = (inherit: boolean) => [
  ...(inherit ? [{ value: INHERIT, label: "沿用" }] : []),
  { value: "NONE", label: "不扣" },
  { value: "PER_LESSON", label: "每堂固定" },
  { value: "PER_DAY", label: "每天固定" },
] as { value: Maybe<FeeMode>; label: string }[];

function LayerForm({
  scope,
  title,
  locationId,
  lessonId,
  row,
  canEdit,
}: {
  scope: RuleScope;
  title?: string;
  locationId?: number;
  lessonId?: number;
  row?: SplitRuleRow;
  canEdit: boolean;
}) {
  const { data: teachers } = useGetTeachersQuery();
  const { data: lessons } = useGetLessonsQuery({ tab: "all", sort: "name" }, { skip: scope !== "LESSON" });
  const [save, { isLoading }] = useSaveSplitRuleMutation();
  const inherit = scope !== "CLASSROOM";
  const lesson = lessons?.lessons.find((l) => l.id === lessonId);

  const [teacherPay, setTeacherPay] = useState<Maybe<TeacherPay>>(row?.teacherPay ?? (inherit ? INHERIT : "NONE"));
  const [hourlyFee, setHourlyFee] = useState(row?.hourlyFee?.toString() ?? "");
  const [venueMode, setVenueMode] = useState<Maybe<FeeMode>>(row?.venueMode ?? (inherit ? INHERIT : "NONE"));
  const [venueAmount, setVenueAmount] = useState(row?.venueAmount?.toString() ?? "");
  const [venueTeacherId, setVenueTeacherId] = useState<number>(row?.venuePayee === "MEMBER" ? row.venueTeacherId ?? 0 : 0);
  const [assistantMode, setAssistantMode] = useState<Maybe<FeeMode>>(row?.assistantMode ?? (inherit ? INHERIT : "NONE"));
  const [assistantAmount, setAssistantAmount] = useState(row?.assistantAmount?.toString() ?? "");
  const [commission, setCommission] = useState(row?.commissionPct?.toString() ?? "");
  const [roundTo, setRoundTo] = useState<1 | 10 | 100>(row?.roundTo ?? 1);
  const [remainderTo, setRemainderTo] = useState(row?.remainderTo ?? "FUND");
  const [shares, setShares] = useState<Record<number, string>>(
    Object.fromEntries((row?.shares ?? []).map((s) => [s.teacherId, String(s.pct)]))
  );

  const name = title ?? lesson?.name ?? "課程";
  const venuePayeeOptions = [
    { value: 0, label: "外面的場地" },
    ...(teachers ?? []).filter((t) => !t.archivedAt).map((t) => ({ value: t.id, label: `成員：${t.name}` })),
  ];

  const submit = async () => {
    const pick = <T extends string>(v: Maybe<T>) => (v === INHERIT ? null : v);
    const body: SplitRuleBody = {
      scope,
      locationId: locationId ?? null,
      lessonId: lessonId ?? null,
      venueMode: pick(venueMode),
      venueAmount: venueMode === "PER_LESSON" || venueMode === "PER_DAY" ? parseMoneyInput(venueAmount) ?? 0 : null,
      venuePayee: venueMode === "PER_LESSON" || venueMode === "PER_DAY" ? (venueTeacherId ? "MEMBER" : "EXTERNAL") : null,
      venueTeacherId: venueTeacherId || null,
      assistantMode: pick(assistantMode),
      assistantAmount: assistantMode === "PER_LESSON" || assistantMode === "PER_DAY" ? parseMoneyInput(assistantAmount) ?? 0 : null,
      commissionPct: commission.trim() === "" ? null : Number(commission),
    };
    if (scope !== "LOCATION") {
      body.teacherPay = pick(teacherPay);
      body.hourlyFee = teacherPay === "HOURLY" ? parseMoneyInput(hourlyFee) ?? 0 : null;
    }
    if (scope === "CLASSROOM") {
      body.roundTo = roundTo;
      body.remainderTo = remainderTo;
    }
    if (scope === "LESSON") {
      body.shares = Object.entries(shares)
        .filter(([, v]) => v.trim() !== "")
        .map(([teacherId, v]) => ({ teacherId: Number(teacherId), pct: Number(v) }));
    }
    try {
      const saved = await save(body).unwrap();
      toast.success(`存好了，${since(saved)}生效`);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const feeRow = (
    label: string,
    mode: Maybe<FeeMode>,
    setMode: (v: Maybe<FeeMode>) => void,
    amount: string,
    setAmount: (v: string) => void,
    extra?: React.ReactNode
  ) => (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <SegmentedTabs<Maybe<FeeMode>> ariaLabel={label} value={mode} onChange={setMode} options={FEE_OPTIONS(inherit)} />
      {(mode === "PER_LESSON" || mode === "PER_DAY") && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-32"><MoneyInput value={amount} onChange={setAmount} /></div>
          {extra}
        </div>
      )}
    </div>
  );

  return (
    <Panel
      title={<span className="flex items-baseline gap-2">{name}<span className="text-[13px] font-normal text-neutral-500">{scope === "CLASSROOM" ? "" : scope === "LOCATION" ? "分部" : "課程例外"}{row ? ` · ${since(row)}` : ""}</span></span>}
    >
      <fieldset disabled={!canEdit} className="grid gap-5 lg:grid-cols-2">
        {scope !== "LOCATION" && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>老師怎麼拿</FieldLabel>
            <SegmentedTabs<Maybe<TeacherPay>>
              ariaLabel="老師怎麼拿"
              value={teacherPay}
              onChange={setTeacherPay}
              options={[
                ...(inherit ? [{ value: INHERIT as Maybe<TeacherPay>, label: "沿用" }] : []),
                { value: "NONE", label: "不用算" },
                { value: "HOURLY", label: "鐘點費" },
                { value: "SPLIT", label: "拆帳" },
              ]}
            />
            {teacherPay === "HOURLY" && <div className="w-32"><MoneyInput value={hourlyFee} onChange={setHourlyFee} /></div>}
          </div>
        )}
        {feeRow("場地費", venueMode, setVenueMode, venueAmount, setVenueAmount,
          <Select<number> size="sm" value={venueTeacherId} options={venuePayeeOptions} onChange={setVenueTeacherId} aria-label="場地費付給" />
        )}
        {feeRow("助教費", assistantMode, setAssistantMode, assistantAmount, setAssistantAmount)}
        <div className="flex flex-col gap-1.5">
          <FieldLabel hint={inherit ? "（空白＝沿用）" : undefined}>教室抽成</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={commission}
              onChange={(e) => setCommission(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className="h-11 w-20 rounded-xl border border-neutral-300 px-3 text-[15px] tabular-nums"
              aria-label="教室抽成百分比"
            />
            <span className="text-sm text-neutral-700">%</span>
          </div>
        </div>
        {scope === "CLASSROOM" && (
          <>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>老師實拿取整數</FieldLabel>
              <Select<1 | 10 | 100> value={roundTo} onChange={setRoundTo} aria-label="取整數"
                options={[{ value: 1, label: "不取整" }, { value: 10, label: "捨去到十位" }, { value: 100, label: "捨去到百位" }]} />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>零頭歸</FieldLabel>
              <Select<"REVENUE_OWNER" | "FUND"> value={remainderTo} onChange={setRemainderTo} aria-label="零頭歸"
                options={[{ value: "FUND", label: "水庫基金" }, { value: "REVENUE_OWNER", label: "營收負責人" }]} />
            </div>
          </>
        )}
        {scope === "LESSON" && lesson && lesson.teachers.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel hint="（空白＝平分）">多位老師的比例</FieldLabel>
            <div className="flex flex-wrap gap-3">
              {lesson.teachers.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  {t.name}
                  <input
                    inputMode="numeric"
                    value={shares[t.id] ?? ""}
                    onChange={(e) => setShares({ ...shares, [t.id]: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                    className="h-11 w-16 rounded-xl border border-neutral-300 px-3 text-[15px] tabular-nums"
                  />
                  %
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" isLoading={isLoading} onClick={submit}>存起來</Button>
        </div>
      )}
    </Panel>
  );
}
