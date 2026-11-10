"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { fieldControlClass } from "@/components/Field";
import MultiSelect from "@/components/MultiSelect";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import SubNavbar from "@/features/SubNavbar";
import { useLocations } from "@/hooks/useLocations";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { assistantsFirst } from "@/lib/teachers";
import { cn } from "@/lib/utils";
import {
  useGetLessonGroupsQuery,
  useOrganizeLessonGroupsMutation,
} from "@/store/slices/lessonGroups";
import { useGetLessonsQuery, type LessonSummary } from "@/store/slices/lessons";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import {
  draftSeries,
  seriesDisplayName,
  suggestedLocationId,
  type DraftSeries,
} from "./seriesSuggest";
import { slotLabel, termNumbers, termRangeLabel } from "./termLabels";

const STEPS = ["課種", "分部", "小幫手", "確認"] as const;
/** Select 的值不能是 null：0 = 不設分部／「新的課種」。 */
const NONE = 0;
const MIXED = -1;

interface TermSetting {
  locationId: number | null;
  assistantIds: number[];
}

const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * 翻新精靈：把改版前的課（沒有課種、分部、小幫手，舊群組是「週日課程」這種時段班）
 * 一次整理成「課種 → 期」。四步：① 課種歸類 ② 每期分部 ③ 每期小幫手 ④ 確認後一次寫入。
 *
 * 初稿是純函式（`seriesSuggest.ts`）算的；可以重跑，已經是課種的群組會原樣帶進來。
 * 全部狀態都在這個元件裡，送出前不寫任何東西。
 */
const OrganizeWizard = () => {
  const router = useRouter();
  const { data, isLoading: isLessonsLoading } = useGetLessonsQuery({ tab: "all", sort: "name" });
  const { data: groups, isLoading: isGroupsLoading } = useGetLessonGroupsQuery();
  const { data: teachers } = useGetTeachersQuery();
  const { locations, all: allLocations, isLoading: isLocationsLoading } = useLocations();
  const [organize, { isLoading: isSaving }] = useOrganizeLessonGroupsMutation();

  const lessons = useMemo(() => data?.lessons ?? [], [data?.lessons]);
  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);

  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<DraftSeries[] | null>(null);
  const [settings, setSettings] = useState<Record<number, TermSetting>>({});

  // 資料到齊後只建一次初稿；之後的修改都留在畫面上，不被重新抓的資料蓋掉。
  // 分部也要等到：初稿的預設分部是從它算的。
  const ready =
    !isLessonsLoading && !isGroupsLoading && !isLocationsLoading && Boolean(data) && Boolean(groups);
  useEffect(() => {
    if (!ready || drafts !== null) return;
    setDrafts(draftSeries(lessons, groups ?? []));
    setSettings(
      Object.fromEntries(
        lessons.map((lesson) => [
          lesson.id,
          {
            locationId: suggestedLocationId(lesson, locations),
            assistantIds: (lesson.assistants ?? []).map((a) => a.id),
          },
        ])
      )
    );
  }, [ready, drafts, lessons, groups, locations]);

  const seriesLessons = (draft: DraftSeries) =>
    draft.lessonIds.map((id) => lessonById.get(id)).filter((l): l is LessonSummary => Boolean(l));

  const patchDraft = (key: string, change: Partial<DraftSeries>) =>
    setDrafts((prev) => prev!.map((d) => (d.key === key ? { ...d, ...change } : d)));

  /** 把一期搬到另一個課種；target = null 就自己開一個新的課種。搬空的課種拿掉。 */
  const moveTerm = (lessonId: number, target: string | null) =>
    setDrafts((prev) => {
      const lesson = lessonById.get(lessonId)!;
      let next = prev!.map((d) => ({ ...d, lessonIds: d.lessonIds.filter((id) => id !== lessonId) }));
      if (target === null) {
        next.push({
          key: `x${lessonId}`,
          name: seriesDisplayName(lesson.name),
          enabled: true,
          lessonIds: [lessonId],
        });
      } else {
        next = next.map((d) => (d.key === target ? { ...d, lessonIds: [...d.lessonIds, lessonId] } : d));
      }
      return next.filter((d) => d.lessonIds.length > 0);
    });

  const patchSetting = (lessonId: number, change: Partial<TermSetting>) =>
    setSettings((prev) => ({ ...prev, [lessonId]: { ...prev[lessonId], ...change } }));

  const teacherIdsOf = (lessonId: number) =>
    (lessonById.get(lessonId)?.teachers ?? []).map((t) => t.id);

  /** 整個課種一起設小幫手：每一期都換成這幾位，扣掉那一期本來就是老師的人。 */
  const setSeriesAssistants = (draft: DraftSeries, ids: number[]) =>
    setSettings((prev) => {
      const next = { ...prev };
      for (const id of draft.lessonIds) {
        const teacherIds = teacherIdsOf(id);
        next[id] = { ...next[id], assistantIds: ids.filter((a) => !teacherIds.includes(a)) };
      }
      return next;
    });

  const setSeriesLocation = (draft: DraftSeries, locationId: number | null) =>
    setSettings((prev) => {
      const next = { ...prev };
      for (const id of draft.lessonIds) next[id] = { ...next[id], locationId };
      return next;
    });

  // ---- 送出的內容（確認頁也用它來列摘要）----
  const plan = useMemo(() => {
    if (!drafts) return null;
    const byName = new Map<string, number[]>();
    const ungroup: number[] = [];
    for (const draft of drafts) {
      const name = draft.name.trim();
      if (draft.enabled && name) byName.set(name, [...(byName.get(name) ?? []), ...draft.lessonIds]);
      else ungroup.push(...draft.lessonIds.filter((id) => lessonById.get(id)?.groupId !== null));
    }
    const changed = lessons.filter((lesson) => {
      const setting = settings[lesson.id];
      if (!setting) return false;
      return (
        setting.locationId !== (lesson.location?.id ?? null) ||
        !sameIds(setting.assistantIds, (lesson.assistants ?? []).map((a) => a.id))
      );
    });
    const locationChanges = changed.filter(
      (l) => settings[l.id].locationId !== (l.location?.id ?? null)
    ).length;
    const assistantChanges = changed.filter(
      (l) => !sameIds(settings[l.id].assistantIds, (l.assistants ?? []).map((a) => a.id))
    ).length;

    // 這次會被搬空、跟著刪掉的舊群組（時段班）。
    const destination = new Map<number, string | null>();
    for (const [name, ids] of byName) ids.forEach((id) => destination.set(id, name));
    ungroup.forEach((id) => destination.set(id, null));
    const removedGroups = (groups ?? []).filter((group) => {
      const members = lessons.filter((l) => l.groupId === group.id);
      return (
        members.length > 0 &&
        members.every((l) => destination.has(l.id) && destination.get(l.id) !== group.name)
      );
    });
    const loose = drafts.filter((d) => !(d.enabled && d.name.trim())).flatMap((d) => d.lessonIds);

    return {
      series: [...byName].map(([name, lessonIds]) => ({ name, lessonIds })),
      ungroupLessonIds: ungroup,
      lessons: changed.map((l) => ({ id: l.id, ...settings[l.id] })),
      locationChanges,
      assistantChanges,
      removedGroups,
      looseCount: loose.length,
    };
  }, [drafts, settings, lessons, lessonById, groups]);

  const handleSubmit = async () => {
    if (!plan) return;
    try {
      const result = await organize({
        series: plan.series,
        ungroupLessonIds: plan.ungroupLessonIds,
        lessons: plan.lessons,
      }).unwrap();
      toast.success(
        `已整理 ${plan.series.length} 個課種${result.removedGroups ? `，刪掉 ${result.removedGroups} 個舊群組` : ""}`
      );
      router.push("/lessons");
    } catch {
      toast.error("整理失敗，什麼都沒有改，請再試一次");
    }
  };

  const locationOptions = [
    { value: NONE, label: "不設分部" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
    // 封存的分部不給新選，但已經掛著的要能顯示出來。
    ...allLocations
      .filter((l) => l.archivedAt && lessons.some((lesson) => lesson.location?.id === l.id))
      .map((l) => ({ value: l.id, label: `${l.name}（已封存）` })),
  ];
  const assistantOptions = (excludeIds: number[], selected: number[]) =>
    assistantsFirst(teachers ?? [])
      .filter((t) => !excludeIds.includes(t.id) && (!t.archivedAt || selected.includes(t.id)))
      .map((t) => ({ value: t.id, label: t.name }));

  // ---- 共用的一列「一期」----
  const termHead = (lesson: LessonSummary, number: number | null, seriesName?: string) => (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        {number !== null && <span className="font-semibold text-neutral-900">第 {number} 期</span>}
        {(number === null || lesson.name !== seriesName) && (
          <span className={number === null ? "font-semibold text-neutral-900" : "text-neutral-700"}>
            {lesson.name}
          </span>
        )}
      </div>
      <div className="text-xs text-neutral-600">
        {[
          termRangeLabel(lesson),
          slotLabel(lesson),
          lesson.teachers.map((t) => t.name).join("、"),
          `${lesson.studentCount} 人`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </div>
  );

  const seriesCard = (
    draft: DraftSeries,
    renderTerm: (lesson: LessonSummary, number: number | null) => React.ReactNode,
    header?: React.ReactNode
  ) => {
    const members = seriesLessons(draft);
    const numbers = draft.enabled ? termNumbers(members) : null;
    const ordered = [...members].sort(
      (a, b) => (numbers ? numbers.get(b.id)! - numbers.get(a.id)! : b.id - a.id)
    );
    const style = members[0]?.danceStyle;
    return (
      <section key={draft.key} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3">
          <span
            aria-hidden="true"
            className={cn("size-2.5 shrink-0 rounded-full", style ? danceStyleMeta(style).bg : "bg-neutral-300")}
          />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-neutral-900">
            {draft.enabled && draft.name.trim() ? draft.name : "不歸類"}
            <span className="ml-2 text-[13px] font-normal text-neutral-600">
              {draft.enabled ? `${members.length} 期` : `${members.length} 門課`}
            </span>
          </span>
          {header}
        </div>
        <ul>
          {ordered.map((lesson) => (
            <li
              key={lesson.id}
              className="flex flex-col gap-2 border-t border-neutral-100 px-4 py-3 first:border-t-0 lg:flex-row lg:items-center lg:gap-3"
            >
              {renderTerm(lesson, numbers?.get(lesson.id) ?? null)}
            </li>
          ))}
        </ul>
      </section>
    );
  };

  // ---- 四個步驟 ----
  const stepSeries = () =>
    drafts!.map((draft) => {
      const members = seriesLessons(draft);
      const others = drafts!.filter((d) => d.key !== draft.key);
      return (
        <section key={draft.key} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <Switch
                checked={draft.enabled}
                onCheckedChange={(checked) => patchDraft(draft.key, { enabled: checked })}
                aria-label="歸成課種"
              />
              歸成課種
            </label>
            {draft.enabled ? (
              <input
                value={draft.name}
                onChange={(e) => patchDraft(draft.key, { name: e.target.value })}
                aria-label="課種名稱"
                placeholder="課種名稱"
                maxLength={60}
                className={cn(fieldControlClass(!draft.name.trim()), "h-10 min-w-0 flex-1 lg:max-w-[320px]")}
              />
            ) : (
              <span className="flex-1 text-sm text-neutral-600">不歸類，留在「未分類」</span>
            )}
            <span className="text-[13px] text-neutral-600">{members.length} 期</span>
          </div>
          <ul>
            {(() => {
              const numbers = termNumbers(members);
              return [...members]
                .sort((a, b) => numbers.get(b.id)! - numbers.get(a.id)!)
                .map((lesson) => (
                  <li
                    key={lesson.id}
                    className="flex flex-col gap-2 border-t border-neutral-100 px-4 py-3 first:border-t-0 lg:flex-row lg:items-center lg:gap-3"
                  >
                    {termHead(lesson, draft.enabled ? numbers.get(lesson.id)! : null, draft.name)}
                    <Select
                      size="sm"
                      aria-label={`把「${lesson.name}」移到`}
                      className="w-full lg:w-[220px]"
                      value={draft.key}
                      onChange={(value) => {
                        if (value === draft.key) return;
                        moveTerm(lesson.id, value === String(NONE) ? null : value);
                      }}
                      options={[
                        { value: draft.key, label: "留在這個課種" },
                        ...(members.length > 1 ? [{ value: String(NONE), label: "拆成新的課種" }] : []),
                        ...others.map((d) => ({ value: d.key, label: `移到「${d.name || "未命名"}」` })),
                      ]}
                    />
                  </li>
                ));
            })()}
          </ul>
        </section>
      );
    });

  const stepLocations = () =>
    locations.length === 0 ? (
      <EmptyState
        kind="inline"
        title="還沒有分部"
        description="只有一個上課地點可以跳過這一步；要分台南、高雄的話先到「分部」新增。"
        action={
          <Button variant="secondary" size="sm" onClick={() => router.push("/locations")}>
            新增分部
          </Button>
        }
      />
    ) : (
      drafts!.map((draft) => {
        const ids = draft.lessonIds.map((id) => settings[id]?.locationId ?? null);
        const common = ids.every((id) => id === ids[0]) ? (ids[0] ?? NONE) : MIXED;
        return seriesCard(
          draft,
          (lesson, number) => (
            <>
              {termHead(lesson, number, draft.name)}
              <Select
                size="sm"
                aria-label={`「${lesson.name}」的分部`}
                className="w-full lg:w-[160px]"
                value={settings[lesson.id]?.locationId ?? NONE}
                onChange={(value) => patchSetting(lesson.id, { locationId: value === NONE ? null : value })}
                options={locationOptions}
              />
            </>
          ),
          draft.lessonIds.length > 1 && (
            <Select
              size="sm"
              aria-label={`「${draft.name}」每一期的分部`}
              className="w-full lg:w-[200px]"
              value={common}
              onChange={(value) => value !== MIXED && setSeriesLocation(draft, value === NONE ? null : value)}
              options={[
                ...(common === MIXED ? [{ value: MIXED, label: "各期不同" }] : []),
                ...locationOptions.map((o) => ({ ...o, label: `全部：${o.label}` })),
              ]}
            />
          )
        );
      })
    );

  const stepAssistants = () =>
    (teachers ?? []).length === 0 ? (
      <EmptyState kind="inline" title="還沒有老師資料" description="到「老師」新增助教後，再回來設小幫手。" />
    ) : (
      drafts!.map((draft) => {
        const newest = draft.lessonIds[0];
        return seriesCard(
          draft,
          (lesson, number) => {
            const selected = settings[lesson.id]?.assistantIds ?? [];
            return (
              <>
                {termHead(lesson, number, draft.name)}
                <div className="w-full lg:w-[280px]">
                  <MultiSelect
                    options={assistantOptions(teacherIdsOf(lesson.id), selected)}
                    values={selected}
                    placeholder="沒有小幫手"
                    onChange={(values) => patchSetting(lesson.id, { assistantIds: values as number[] })}
                  />
                </div>
              </>
            );
          },
          draft.lessonIds.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-700"
              onClick={() => setSeriesAssistants(draft, settings[newest]?.assistantIds ?? [])}
            >
              最新一期的小幫手套用到全部
            </Button>
          )
        );
      })
    );

  const stepConfirm = () => {
    if (!plan) return null;
    const termCount = plan.series.reduce((sum, s) => sum + s.lessonIds.length, 0);
    const locationName = new Map(allLocations.map((l) => [l.id, l.name]));
    return (
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-800">
          <li>
            <Check className="mr-1.5 inline size-4 text-primary-700" />
            {plan.series.length} 個課種，共 {termCount} 期
          </li>
          {plan.looseCount > 0 && <li className="pl-5.5">{plan.looseCount} 門課不歸類</li>}
          <li className="pl-5.5">{plan.locationChanges} 期改分部、{plan.assistantChanges} 期改小幫手</li>
          {plan.removedGroups.length > 0 && (
            <li className="pl-5.5">
              舊群組會刪掉：{plan.removedGroups.map((g) => `「${g.name}」`).join("")}
              <span className="text-neutral-600">（課不會刪，只是改掛到課種底下）</span>
            </li>
          )}
        </ul>
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <ul>
            {plan.series.map((series) => {
              const members = series.lessonIds.map((id) => lessonById.get(id)!);
              const perLocation = new Map<string, number>();
              for (const lesson of members) {
                const name = locationName.get(settings[lesson.id]?.locationId ?? NONE) ?? "未設分部";
                perLocation.set(name, (perLocation.get(name) ?? 0) + 1);
              }
              const running = members.some((l) => l.status === "inProgress");
              return (
                <li
                  key={series.name}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 px-4 py-3 first:border-t-0"
                >
                  <span className="min-w-0 flex-1 font-semibold text-neutral-900">{series.name}</span>
                  <span className="text-[13px] text-neutral-700">
                    {[...perLocation].map(([name, count]) => `${name} ${count} 期`).join(" · ")}
                  </span>
                  <span className={cn("text-[13px] font-medium", running ? "text-primary-700" : "text-neutral-600")}>
                    {running ? "開課中" : "已停"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

  const canNext = step !== 0 || (drafts ?? []).every((d) => !d.enabled || d.name.trim());
  const isLast = step === STEPS.length - 1;
  const intro = [
    "同名的課歸成一個課種，每一門課是一期。名稱可以改，取一樣的名字就會合併；只有一期、不想歸類的可以關掉。",
    "每一期在哪個分部上課。課名有 [KH] 這類代號的已經先帶入，其他預設第一個分部。",
    "每一期的小幫手（選填）。改版前沒有這個資料，記得的再補就好。",
    "確認後一次寫入；中途失敗的話什麼都不會改。",
  ][step];

  const nothingToDo = ready && lessons.length === 0;

  return (
    <>
      <SubNavbar title="翻新精靈" backUrl="/lessons" className="lg:hidden" />
      <div className="flex w-full max-w-[960px] flex-col gap-5 px-5 pt-4 pb-28 lg:px-8 lg:pt-6">
        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/lessons" aria-label="回課程" className="text-neutral-500 hover:text-neutral-700">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900">翻新精靈</h1>
        </div>

        <ol className="flex items-center gap-2 text-[13px]" aria-label="步驟">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true" className="h-px w-4 bg-neutral-300 lg:w-8" />}
              <button
                type="button"
                disabled={index > step || !drafts}
                onClick={() => setStep(index)}
                aria-current={index === step ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                  index === step
                    ? "bg-primary-900 text-white"
                    : index < step
                      ? "text-primary-700 hover:bg-primary-50"
                      : "text-neutral-500"
                )}
              >
                <span className="tabular-nums">{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        <p className="text-sm text-neutral-700">{intro}</p>

        {!drafts ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl opacity-50" />
          </div>
        ) : nothingToDo ? (
          <EmptyState kind="inline" title="還沒有課程" description="沒有舊資料需要整理。" />
        ) : (
          <div className="flex flex-col gap-3">
            {step === 0 && stepSeries()}
            {step === 1 && stepLocations()}
            {step === 2 && stepAssistants()}
            {step === 3 && stepConfirm()}
          </div>
        )}
      </div>

      {drafts && !nothingToDo && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur lg:left-64">
          <div className="flex w-full max-w-[960px] items-center gap-3 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-8">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                上一步
              </Button>
            )}
            <span className="flex-1" />
            {isLast ? (
              <Button onClick={handleSubmit} disabled={isSaving || !plan} isLoading={isSaving}>
                套用
              </Button>
            ) : (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
                下一步
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default OrganizeWizard;
