import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { seriesName, type SeriesChoice } from "./SeriesPicker";
import { useCreateLessonGroupMutation, useGetLessonGroupsQuery } from "@/store/slices/lessonGroups";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { seriesNameKey, seriesDisplayName } from "../seriesSuggest";
import { termNumbers } from "../termLabels";
import { useLocations } from "@/hooks/useLocations";
import AddPeriodForm from "./AddPeriodForm";
import { useCreateLessonMutation } from "@/store/slices/lessons";
import { useRouter, useSearchParams } from "next/navigation";
import DropInPriceField, {
  type DropInPlans,
  buildDropInOptions,
  dropInPlansFrom,
  parseDropInPrice,
} from "./DropInPriceField";
import {
  DEFAULT_LESSON_KIND,
  DEFAULT_SESSIONS_PER_ATTENDANCE,
  type LessonKind,
} from "@/lib/lessonKind";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { DEFAULT_DANCE_LEVEL } from "@/lib/danceLevels";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import {
  getLessonCloneSource,
  clearLessonCloneSource,
  getLastLessonKind,
  getLastLessonLocation,
  setLastLessonLocation,
  setLastLessonKind,
} from "@/lib/lessonDraftStorage";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, X } from "lucide-react";
import { DANCE_LEVELS } from "@/lib/danceLevels";
import { ActionRow, GROUPED_PAGE_BG, GroupedRow, GroupedSection, SegmentedControl } from "./grouped";
import {
  AssistantGroup,
  CardGroup,
  DanceStyleGroup,
  LocationGroup,
  SeriesGroup,
  TeacherGroup,
  type SeriesMode,
} from "./groupedFields";
import { addDays, format } from "date-fns";
import { useGetCardsQuery } from "@/store/slices/cards";
import { useSizeClass } from "@/hooks/useMediaQuery";

const validationErrors = {
  lessonName: "請選一個課種",
  newSeriesName: "請輸入新課種的名稱",
  teachers: "請至少選擇一位老師",
  cards: "請至少選擇一張課卡（或到「細節」開放單堂付費）",
  periods: "請至少新增一個時段",
  danceStyle: "請選擇舞種",
  dropInPrice: "請輸入單堂價",
  dropInOptions: "每個方案都要有名稱和金額，名稱不能重複",
};

const STEPS = ["基本設定", "細節", "排課", "預覽"] as const;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 每個欄位錯誤在哪一步：下一步只看這一步的，建立時跳到第一個有錯的步驟。 */
const ERROR_STEP = {
  lessonName: 0,
  danceStyle: 0,
  cards: 0,
  teachers: 1,
  dropInPrice: 1,
  periods: 2,
} as const;

const NewLesson = () => {
  const searchParams = useSearchParams();
  // 只渲染一份 header 與一顆送出按鈕。表單狀態本來就只有一份，
  // 兩份按鈕綁同一個 handleSubmit，所以收成一份不影響行為。
  const isExpanded = useSizeClass() === "expanded";
  // "+ 新增這天的堂" on a group's detail page links here with ?groupId=…
  // so the new lesson starts pre-assigned to that group.
  const groupIdParam = searchParams.get("groupId");

  const [initialClone] = useState(() => {
    if (typeof window === "undefined") return null;
    const source = getLessonCloneSource();
    if (source) clearLessonCloneSource();
    return source;
  });

  // 課種＝課名的來源：選了課種，這一期就叫課種的名字，除非另取名稱。
  const { data: groups = [], isSuccess: groupsLoaded } = useGetLessonGroupsQuery();
  const [series, setSeries] = useState<SeriesChoice>(() => {
    const id = initialClone?.groupId ?? (groupIdParam ? Number(groupIdParam) : null);
    if (id) return { type: "existing", id };
    // 沒課種的舊課開新一期：用它清過的課名當新課種。
    return initialClone ? { type: "new", name: seriesDisplayName(initialClone.lessonName) } : null;
  });
  const baseName = seriesName(series, groups);
  // 延續現有課種 or 全新課種；沒碰過就看目前的選擇（教室還沒有課種就只能全新）。
  const [pickedMode, setPickedMode] = useState<SeriesMode | undefined>(undefined);
  const mode: SeriesMode =
    pickedMode ?? (series?.type === "new" || (groupsLoaded && groups.length === 0) ? "new" : "existing");
  // 延續一個開過的課種：上一期的設定整套帶進來，基本設定只顯示摘要，按「改設定」才展開欄位。
  const pickedGroup = series?.type === "existing" ? groups.find((g) => g.id === series.id) : undefined;
  const continuing =
    mode === "existing" &&
    series?.type === "existing" &&
    ((pickedGroup?.lessonCount ?? 0) > 0 || initialClone?.groupId === series.id);
  const [editing, setEditing] = useState(false);
  // 延續但還沒挑課種：先不顯示欄位（挑了就整套帶入）。
  const showFields = mode === "new" || (series !== null && (!continuing || editing));
  const [customName, setCustomName] = useState(initialClone?.lessonName ?? "");
  // undefined = 還沒動過：開新一期時，上一期的課名跟課種名稱不一樣（不算括號、期數）才預設打開。
  const [pickedShowCustomName, setShowCustomName] = useState<boolean | undefined>(undefined);
  const showCustomName =
    pickedShowCustomName ??
    Boolean(
      initialClone &&
        baseName &&
        seriesNameKey(initialClone.lessonName) !== seriesNameKey(baseName)
    );
  const lessonName = (showCustomName && customName.trim()) || baseName;
  // 步驟：0 基本設定、1 細節、2 排課、3 預覽。步驟列可以隨時跳。
  const [step, setStep] = useState(0);
  const goTo = (next: number) => {
    setStep(next);
    setAddingPeriod(false);
    window.scrollTo({ top: 0 });
  };
  const [addingPeriod, setAddingPeriod] = useState(false);
  const { data: teachers = [] } = useGetTeachersQuery();
  const { data: cardData } = useGetCardsQuery();
  const cardList = [...(cardData?.activeCards ?? []), ...(cardData?.expiredCards ?? [])];
  const [createLessonGroup] = useCreateLessonGroupMutation();
  const { styles } = useDanceStyles();
  const [pickedStyleId, setPickedStyleId] = useState<number | null>(
    initialClone?.danceStyleId ?? null
  );
  // Until the teacher picks one, default to the classroom's first style —
  // the old form defaulted to Bachata the same way.
  const danceStyleId = pickedStyleId ?? styles[0]?.id ?? null;
  const hasLevels = styles.find((style) => style.id === danceStyleId)?.hasLevels ?? false;
  const [level, setLevel] = useState<number>(
    initialClone?.level ?? DEFAULT_DANCE_LEVEL
  );
  // Clone > the classroom's last-used kind > "fixed". The last-used kind needs
  // the classroom id, which may arrive after the first render.
  const { data: classroomData } = useGetClassroomsQuery();
  const classroomId = classroomData?.currentClassroomId ?? null;
  const [pickedKind, setPickedKind] = useState<LessonKind | null>(initialClone?.kind ?? null);
  const kind: LessonKind =
    pickedKind ??
    (classroomId != null ? getLastLessonKind(classroomId) : null) ??
    DEFAULT_LESSON_KIND;
  const [sessionsPerAttendance, setSessionsPerAttendance] = useState<number>(
    initialClone?.sessionsPerAttendance ?? DEFAULT_SESSIONS_PER_ATTENDANCE
  );
  const [dropInEnabled, setDropInEnabled] = useState<boolean>(
    initialClone?.dropInPrice != null
  );
  const [dropInAmount, setDropInAmount] = useState<string>(
    initialClone?.dropInPrice != null ? String(initialClone.dropInPrice) : ""
  );
  const [dropInPlans, setDropInPlans] = useState<DropInPlans>(() =>
    dropInPlansFrom(initialClone?.dropInOptions)
  );
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>(
    initialClone?.teacherIds ?? []
  );
  const [selectedAssistantIds, setSelectedAssistantIds] = useState<number[]>(
    initialClone?.assistantIds ?? []
  );
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>(
    initialClone?.cardIds ?? []
  );
  // 分部: clone > the classroom's last-used one (if still active) > none.
  // `undefined` = not touched yet, so an explicit「不指定」sticks.
  const { locations } = useLocations();
  const [pickedLocationId, setPickedLocationId] = useState<number | null | undefined>(
    initialClone ? (initialClone.locationId ?? null) : undefined
  );
  const lastLocationId = classroomId != null ? getLastLessonLocation(classroomId) : null;
  const locationId =
    pickedLocationId !== undefined
      ? pickedLocationId
      : locations.some((l) => l.id === lastLocationId)
        ? lastLocationId
        : null;

  // 第一堂的預設：開新一期帶來的，或延續課種時上一期最後一堂的下一週。
  const [inheritedPeriod, setInheritedPeriod] = useState(initialClone?.initialPeriod);
  const [periods, setPeriods] = useState<
    { startTime: string; endTime: string }[]
  >([]);
  const [errors, setErrors] = useState<{
    lessonName?: string;
    teachers?: string;
    cards?: string;
    periods?: string;
    danceStyle?: string;
    dropInPrice?: string;
  }>({});
  const [createLesson, { isLoading }] = useCreateLessonMutation();
  const router = useRouter();

  // 選了現有課種：最近一期的設定整套帶入（跟課程頁「開新一期」一樣）。
  const [prefillGroupId, setPrefillGroupId] = useState<number | null>(null);
  const { data: groupLessons } = useGetLessonsQuery(
    { tab: "all", sort: "nextSession", groupId: prefillGroupId ?? undefined },
    { skip: prefillGroupId === null }
  );
  useEffect(() => {
    if (prefillGroupId === null || !groupLessons) return;
    const numbers = termNumbers(groupLessons.lessons);
    const latest = [...groupLessons.lessons].sort((a, b) => numbers.get(b.id)! - numbers.get(a.id)!)[0];
    if (latest) {
      setPickedStyleId(latest.danceStyleId);
      setLevel(latest.level);
      setPickedKind(latest.kind);
      setSessionsPerAttendance(latest.sessionsPerAttendance);
      setSelectedCardIds(latest.cardIds);
      setSelectedTeacherIds(latest.teachers.map((t) => t.id));
      setSelectedAssistantIds((latest.assistants ?? []).map((t) => t.id));
      setPickedLocationId(latest.location?.id ?? null);
      setDropInEnabled(latest.dropInPrice != null);
      setDropInAmount(latest.dropInPrice != null ? String(latest.dropInPrice) : "");
      setDropInPlans(dropInPlansFrom(latest.dropInOptions));
      setInheritedPeriod(
        latest.lastPeriodStart && latest.lastPeriodEnd
          ? {
              startTime: addDays(new Date(latest.lastPeriodStart), 7).toISOString(),
              endTime: addDays(new Date(latest.lastPeriodEnd), 7).toISOString(),
            }
          : undefined
      );
    }
    setPrefillGroupId(null);
  }, [prefillGroupId, groupLessons]);

  const handleModeChange = (next: SeriesMode) => {
    setPickedMode(next);
    setSeries(next === "new" ? { type: "new", name: "" } : null);
    setEditing(false);
    setErrors((prev) => ({ ...prev, lessonName: undefined }));
  };

  const handleSeriesChange = (choice: SeriesChoice) => {
    setSeries(choice);
    if (choice?.type === "existing" && !(series?.type === "existing" && series.id === choice.id)) setEditing(false);
    if (choice?.type === "existing") setPrefillGroupId(choice.id);
    if (errors.lessonName) {
      setErrors((prev) => ({ ...prev, lessonName: undefined }));
    }
  };

  const handleDanceStyleChange = (value: number) => {
    setPickedStyleId(value);
    if (errors.danceStyle) {
      setErrors((prev) => ({ ...prev, danceStyle: undefined }));
    }
  };

  const handleTeacherChange = (value: number[]) => {
    setSelectedTeacherIds(value);
    // 同一個人不能又是老師又是小幫手——選成老師就從小幫手拿掉。
    setSelectedAssistantIds((prev) => prev.filter((id) => !value.includes(id)));
    if (errors.teachers) {
      setErrors((prev) => ({ ...prev, teachers: undefined }));
    }
  };

  const handleCardChange = (value: number[]) => {
    setSelectedCardIds(value);
    if (errors.cards) {
      setErrors((prev) => ({ ...prev, cards: undefined }));
    }
  };

  const handleAddPeriod = (period: { startTime: string; endTime: string }) => {
    const newPeriods = [...periods, period];
    const sortedPeriods = newPeriods.sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
    setErrors({ ...errors, periods: undefined });
    setPeriods(sortedPeriods);
    setAddingPeriod(false);
  };

  // 打開「新增時段」時的預設：最後一個時段的下一週；還沒有時段就用開新一期帶來的那堂。
  const lastPeriod = periods[periods.length - 1];
  const nextPeriodDefault = lastPeriod
    ? {
        startTime: addDays(new Date(lastPeriod.startTime), 7).toISOString(),
        endTime: addDays(new Date(lastPeriod.endTime), 7).toISOString(),
      }
    : inheritedPeriod;

  const handleDeletePeriod = (index: number) => {
    const newPeriods = periods.filter((_, i) => i !== index);
    setPeriods(newPeriods);
  };

  /** 整份表單現在的錯誤（不寫進 state）：步驟列的打勾、下一步、預覽都用它。 */
  const currentErrors = () => {
    const errors = validateForm({
      lessonName,
      teachers: selectedTeacherIds,
      cards: selectedCardIds,
      periods,
      danceStyleId,
      dropInEnabled,
      dropInPrice: parseDropInPrice(dropInEnabled, dropInAmount),
    });
    const dropInPrice = parseDropInPrice(dropInEnabled, dropInAmount);
    const dropInOptions = buildDropInOptions(dropInEnabled, dropInAmount, dropInPlans);
    if (!errors.dropInPrice && dropInOptions === undefined) {
      errors.dropInPrice = validationErrors.dropInOptions;
    }
    if (series?.type === "new" && !series.name.trim()) {
      errors.lessonName = validationErrors.newSeriesName;
    }
    return { errors, dropInPrice, dropInOptions };
  };
  const liveErrors = currentErrors().errors;
  const stepDone = (index: number) =>
    !Object.keys(liveErrors).some((key) => ERROR_STEP[key as keyof typeof ERROR_STEP] === index);

  // 延續時從基本設定直接跳排課（細節沿用），但細節也要先檢查過。
  const skipDetails = step === 0 && continuing && !editing;

  /** 下一步：這一步有缺就留在這裡把錯誤標出來。 */
  const handleNext = () => {
    const checked: number[] = skipDetails ? [0, 1] : [step];
    const stepErrors = Object.fromEntries(
      Object.entries(liveErrors).filter(([key]) => checked.includes(ERROR_STEP[key as keyof typeof ERROR_STEP]))
    );
    setErrors(stepErrors);
    const errorSteps = Object.keys(stepErrors).map((key) => ERROR_STEP[key as keyof typeof ERROR_STEP]);
    if (errorSteps.length === 0) {
      goTo(skipDetails ? 2 : step + 1);
    } else if (skipDetails) {
      // 沿用的設定有缺（例如上一期沒有老師）：展開欄位、帶到有缺的那一步。
      setEditing(true);
      goTo(Math.min(...errorSteps));
    }
  };

  const handleSubmit = async () => {
    const { errors, dropInPrice, dropInOptions } = currentErrors();
    setErrors(errors);
    const firstStep = Math.min(
      ...Object.keys(errors).map((key) => ERROR_STEP[key as keyof typeof ERROR_STEP])
    );
    if (Number.isFinite(firstStep)) {
      goTo(firstStep);
      return;
    }
    if (
      Object.keys(errors).length === 0 &&
      series !== null &&
      danceStyleId !== null &&
      dropInPrice !== undefined &&
      dropInOptions !== undefined
    ) {
      let groupId: number;
      if (series.type === "existing") {
        groupId = series.id;
      } else {
        // 同名的課種已經有了就用那個，不重複建。
        const name = series.name.trim();
        const same = groups.find((g) => seriesNameKey(g.name) === seriesNameKey(name));
        groupId = same ? same.id : (await createLessonGroup({ name }).unwrap()).id;
      }
      await createLesson({
        lessonName,
        teacherIds: selectedTeacherIds,
        assistantIds: selectedAssistantIds,
        cardIds: selectedCardIds,
        danceStyleId,
        // A style without levels has no 階級 picker; its lessons are 初階.
        level: hasLevels ? level : DEFAULT_DANCE_LEVEL,
        kind,
        sessionsPerAttendance,
        dropInPrice,
        dropInOptions,
        groupId,
        locationId,
        periods,
      });
      if (classroomId != null) {
        setLastLessonKind(classroomId, kind);
        setLastLessonLocation(classroomId, locationId);
      }

      router.push("/lessons");
    }
  };

  const nameOf = (id: number) => teachers.find((t) => t.id === id)?.name;
  const styleName = styles.find((st) => st.id === danceStyleId)?.name;
  const cardNames = selectedCardIds.map((id) => cardList.find((c) => c.id === id)?.name).filter(Boolean);
  // 摘要裡停用的課卡、封存的老師照樣留著，只標出來。
  const personLabel = (id: number) => {
    const t = teachers.find((x) => x.id === id);
    return t ? `${t.name}${t.archivedAt ? "（已封存）" : ""}` : null;
  };
  const cardLabel = (id: number) => {
    const c = cardList.find((x) => x.id === id);
    return c ? `${c.name}${c.expiredAt ? "（已停用）" : ""}` : null;
  };
  const inheritedRows: [string, string][] = [
    ["舞種", [styleName, hasLevels ? `第 ${level} 階` : null].filter(Boolean).join(" · ") || "—"],
    ["型態", `${kind === "ongoing" ? "持續開課" : "固定堂數"} · 每次扣 ${sessionsPerAttendance} 格`],
    ["課卡", selectedCardIds.map(cardLabel).filter(Boolean).join("、") || "—"],
    ["分部", locations.find((l) => l.id === locationId)?.name ?? "不指定"],
    ["老師", selectedTeacherIds.map(personLabel).filter(Boolean).join("、") || "—"],
    ["小幫手", selectedAssistantIds.map(personLabel).filter(Boolean).join("、") || "—"],
    ["單堂付費", dropInEnabled ? (dropInAmount ? `開放，$${dropInAmount}` : "開放") : "不開放"],
  ];
  const title = initialClone ? "開新一期" : "新增課程";
  const isPreview = step === STEPS.length - 1;
  const submitLabel = initialClone ? "開這一期" : "建立課程";
  const nextLabel = `下一步：${STEPS[skipDetails ? 2 : step + 1]}`;
  const subtitle = [
    "開一堂課一定要有的，其他下一步再說。",
    initialClone ? "沿用上一期的設定，有變再改。" : "在哪上、誰教、能不能單堂付費。",
    "一堂一堂加進來，下一堂預設隔一週。",
    "確認一下，沒問題就建立。",
  ][step];
  const primaryAction = isPreview ? (
    <Button onClick={handleSubmit} isLoading={isLoading}>
      {submitLabel}
    </Button>
  ) : (
    <Button onClick={handleNext}>{nextLabel}</Button>
  );

  return (
    <div className={`min-h-dvh w-full ${GROUPED_PAGE_BG}`}>
      {/* 手機：iOS 式上方列，取消／標題／下一步（下一步也在表單最後一顆）。 */}
      {!isExpanded && (
        <div className="sticky top-0 z-20 grid h-13 grid-cols-[1fr_auto_1fr] items-center border-b border-[#e4ebe7] px-4 bg-[#f3f6f4]/90 backdrop-blur">
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} className="flex cursor-pointer items-center justify-self-start text-[17px] text-primary-700">
              <ChevronLeft className="-ml-1.5 size-5" />上一步
            </button>
          ) : (
            <Link href="/lessons" className="justify-self-start text-[17px] text-primary-700">
              取消
            </Link>
          )}
          <span className="text-[17px] font-semibold text-neutral-900">{title}</span>
          <button
            type="button"
            onClick={isPreview ? handleSubmit : handleNext}
            disabled={isLoading}
            className="cursor-pointer justify-self-end text-[17px] font-semibold text-primary-700 disabled:opacity-50"
          >
            {isPreview ? "建立" : "下一步"}
          </button>
        </div>
      )}

      <div className="flex w-full items-start gap-12 px-4 pt-4 pb-10 lg:px-12 lg:pt-8 lg:pb-16">
        {/* 電腦：左邊直的步驟，隨時可以跳。 */}
        {isExpanded && (
          <nav aria-label="步驟" className="sticky top-8 flex w-[200px] shrink-0 flex-col gap-1">
            <Link href="/lessons" className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
              <ArrowLeft className="size-4" />課程
            </Link>
            <span className="mb-1.5 text-[13px] text-neutral-500">{title}</span>
            <ol className="flex flex-col gap-1">
              {STEPS.map((label, index) => {
                const active = index === step;
                const done = index < STEPS.length - 1 && stepDone(index);
                return (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={active ? "step" : undefined}
                      className={`flex h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 text-left text-[15px] transition-colors ${
                        active
                          ? "bg-white font-semibold text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "text-neutral-700 hover:bg-white/60"
                      }`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                          active
                            ? "bg-primary-900 text-white"
                            : done
                              ? "bg-primary-100 text-primary-700"
                              : "border-[1.5px] border-neutral-300 text-neutral-500"
                        }`}
                      >
                        {done && !active ? <Check aria-label="已完成" className="size-3.5" strokeWidth={3} /> : index + 1}
                      </span>
                      {label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        <div className="flex w-full min-w-0 max-w-[760px] flex-col gap-6 lg:gap-7">
          {!isExpanded && (
            <nav aria-label="步驟" className="flex flex-col gap-2">
              <ol className="grid grid-cols-4 gap-1">
                {STEPS.map((label, index) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-label={label}
                      aria-current={index === step ? "step" : undefined}
                      className="flex h-4 w-full cursor-pointer items-center"
                    >
                      <span
                        className={`h-1 w-full rounded-full ${
                          index === step
                            ? "bg-primary-900"
                            : index < STEPS.length - 1 && stepDone(index)
                              ? "bg-primary-300"
                              : "bg-[#d5dfd9]"
                        }`}
                      />
                    </button>
                  </li>
                ))}
              </ol>
              <span className="text-[13px] text-neutral-500">
                第 {step + 1} 步，共 {STEPS.length} 步
              </span>
            </nav>
          )}

          <header className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-[28px] font-bold tracking-tight text-neutral-900 lg:text-[30px]">{STEPS[step]}</h1>
              <p className="text-[15px] text-neutral-500">{subtitle}</p>
            </div>
            {isExpanded && <div className="shrink-0 [&>button]:h-10 [&>button]:rounded-[10px]">{primaryAction}</div>}
          </header>

          <div className="flex flex-col gap-6 lg:gap-5">
        {step === 0 && (
          <>
            <SeriesGroup
              mode={mode}
              onModeChange={handleModeChange}
              value={series}
              onChange={handleSeriesChange}
              customName={customName}
              onCustomNameChange={setCustomName}
              showCustomName={showCustomName}
              onShowCustomNameChange={setShowCustomName}
              baseName={baseName}
              error={errors.lessonName}
            />
            {continuing && !editing && (
              <InheritedSummary
                rows={inheritedRows}
                onEdit={() => setEditing(true)}
              />
            )}
            {showFields && (
            <>
            <DanceStyleGroup
              danceStyleId={danceStyleId}
              onChange={handleDanceStyleChange}
              error={errors.danceStyle}
              footer={series?.type === "existing" ? "跟著課種帶入，要改再改。" : undefined}
            >
              {hasLevels && (
                <GroupedRow label="階級">
                  <SegmentedControl
                    ariaLabel="階級"
                    className="w-56"
                    value={level}
                    onChange={setLevel}
                    options={DANCE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                  />
                </GroupedRow>
              )}
            </DanceStyleGroup>
            <GroupedSection
              title="上課方式"
              footer={
                kind === "ongoing"
                  ? "持續開課：一堂一堂往下加，你按結束才結束。"
                  : "固定堂數：先排好幾堂，上完自動結束。"
              }
            >
              <div className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:gap-4 lg:py-2.5">
                <span className="text-[15px] text-neutral-900 lg:flex-1">型態</span>
                <SegmentedControl
                  ariaLabel="課程型態"
                  className="lg:w-64"
                  value={kind}
                  onChange={setPickedKind}
                  options={[
                    { value: "fixed", label: "固定堂數" },
                    { value: "ongoing", label: "持續開課" },
                  ]}
                />
              </div>
              <GroupedRow label="每次扣幾格">
                <SegmentedControl
                  ariaLabel="每次扣幾格"
                  className="w-40"
                  value={sessionsPerAttendance}
                  onChange={setSessionsPerAttendance}
                  options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
                />
              </GroupedRow>
            </GroupedSection>
            <CardGroup
              selectedCardIds={selectedCardIds}
              onChange={handleCardChange}
              danceStyleId={danceStyleId}
              error={errors.cards}
            />
            </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <LocationGroup locationId={locationId} onChange={setPickedLocationId} />
            <TeacherGroup
              selectedTeacherIds={selectedTeacherIds}
              onChange={handleTeacherChange}
              error={errors.teachers}
            />
            <AssistantGroup
              selectedAssistantIds={selectedAssistantIds}
              teacherIds={selectedTeacherIds}
              onChange={setSelectedAssistantIds}
            />
            <GroupedSection title="單堂付費" error={errors.dropInPrice}>
              <div className="px-4 py-3">
                <DropInPriceField
                  enabled={dropInEnabled}
                  amount={dropInAmount}
                  onEnabledChange={(enabled) => {
                    setDropInEnabled(enabled);
                    setErrors((prev) => ({ ...prev, dropInPrice: undefined, cards: undefined }));
                  }}
                  onAmountChange={(amount) => {
                    setDropInAmount(amount);
                    setErrors((prev) => ({ ...prev, dropInPrice: undefined }));
                  }}
                  plans={dropInPlans}
                  onPlansChange={(plans) => {
                    setDropInPlans(plans);
                    setErrors((prev) => ({ ...prev, dropInPrice: undefined }));
                  }}
                />
              </div>
            </GroupedSection>
          </>
        )}

        {step === 2 && (
          <GroupedSection
            title="時段"
            error={errors.periods}
            footer={periods.length === 0 ? "至少加一個時段才能開課。" : `共 ${periods.length} 堂。`}
          >
            {periods.map((p, index) => (
              <div key={p.startTime} className="flex min-h-12 items-center gap-3 px-4">
                <span className="w-5 text-[13px] tabular-nums text-neutral-400">{index + 1}</span>
                <span className="flex-1 text-[15px] tabular-nums text-neutral-900">
                  {format(new Date(p.startTime), "M/d")}（{WEEKDAYS[new Date(p.startTime).getDay()]}）
                </span>
                <span className="text-[15px] tabular-nums text-neutral-500">
                  {format(new Date(p.startTime), "HH:mm")}–{format(new Date(p.endTime), "HH:mm")}
                </span>
                <button
                  type="button"
                  aria-label="刪除這個時段"
                  onClick={() => handleDeletePeriod(index)}
                  className="-mr-2 flex size-10 cursor-pointer items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-danger-600"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {addingPeriod ? (
              <AddPeriodForm
                periods={periods}
                onAddPeriod={handleAddPeriod}
                onCancel={() => setAddingPeriod(false)}
                initialPeriod={nextPeriodDefault}
              />
            ) : (
              <ActionRow onClick={() => setAddingPeriod(true)}>＋ 新增時段</ActionRow>
            )}
          </GroupedSection>
        )}

        {isPreview && (
          <>
            <PreviewSection title="基本設定" missing={!stepDone(0)} onEdit={() => goTo(0)}>
              <GroupedRow label="課種">{baseName || "—"}</GroupedRow>
              {lessonName && lessonName !== baseName && <GroupedRow label="這一期叫">{lessonName}</GroupedRow>}
              <GroupedRow label="舞種">
                {[styleName, hasLevels ? `第 ${level} 階` : null].filter(Boolean).join(" · ") || "—"}
              </GroupedRow>
              <GroupedRow label="型態">
                {kind === "ongoing" ? "持續開課" : "固定堂數"} · 每次扣 {sessionsPerAttendance} 格
              </GroupedRow>
              <GroupedRow label="課卡">
                <span className="truncate">{cardNames.length ? cardNames.join("、") : "—"}</span>
              </GroupedRow>
            </PreviewSection>
            <PreviewSection title="細節" missing={!stepDone(1)} onEdit={() => goTo(1)}>
              <GroupedRow label="分部">{locations.find((l) => l.id === locationId)?.name ?? "不指定"}</GroupedRow>
              <GroupedRow label="老師">{selectedTeacherIds.map(nameOf).filter(Boolean).join("、") || "—"}</GroupedRow>
              <GroupedRow label="小幫手">{selectedAssistantIds.map(nameOf).filter(Boolean).join("、") || "—"}</GroupedRow>
              <GroupedRow label="單堂付費">
                {dropInEnabled ? (dropInAmount ? `開放，$${dropInAmount}` : "開放") : "不開放"}
              </GroupedRow>
            </PreviewSection>
            <PreviewSection title="排課" missing={!stepDone(2)} onEdit={() => goTo(2)}>
              {periods.length === 0 ? (
                <GroupedRow label="時段">還沒有時段</GroupedRow>
              ) : (
                periods.map((p, index) => (
                  <GroupedRow key={p.startTime} label={`第 ${index + 1} 堂`}>
                    <span className="tabular-nums">
                      {format(new Date(p.startTime), "M/d")}（{WEEKDAYS[new Date(p.startTime).getDay()]}）
                      {format(new Date(p.startTime), "HH:mm")}–{format(new Date(p.endTime), "HH:mm")}
                    </span>
                  </GroupedRow>
                ))
              )}
            </PreviewSection>
          </>
        )}
          </div>

          {/* 表單最後：跟著內容走，不固定在畫面底部。 */}
          <div className="flex items-center gap-3 border-t border-[#e4ebe7] pt-5">
            {isExpanded && step > 0 && (
              <Button variant="secondary" onClick={() => goTo(step - 1)}>
                上一步
              </Button>
            )}
            <span className="hidden flex-1 lg:block" />
            <div className="flex-1 lg:flex-none [&>button]:w-full max-lg:[&>button]:h-13 max-lg:[&>button]:text-[17px]">{primaryAction}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const validateForm = (data: {
  lessonName: string;
  teachers: number[];
  cards: number[];
  periods: { startTime: string; endTime: string }[];
  danceStyleId: number | null;
  dropInEnabled: boolean;
  dropInPrice: number | null | undefined;
}) => {
  const errors: {
    lessonName?: string;
    teachers?: string;
    cards?: string;
    periods?: string;
    danceStyle?: string;
    dropInPrice?: string;
  } = {};
  if (data.danceStyleId === null) {
    errors.danceStyle = validationErrors.danceStyle;
  }
  if (!data.lessonName) {
    errors.lessonName = validationErrors.lessonName;
  }
  if (data.teachers.length === 0) {
    errors.teachers = validationErrors.teachers;
  }
  // 開了單堂付費的課可以不收課卡（全場付現）。
  if (data.cards.length === 0 && !data.dropInEnabled) {
    errors.cards = validationErrors.cards;
  }
  if (data.dropInPrice === undefined) {
    errors.dropInPrice = validationErrors.dropInPrice;
  }
  if (data.periods.length === 0) {
    errors.periods = validationErrors.periods;
  }
  return errors;
};

export default NewLesson;

/** 預覽的一區：標題右邊「修改」跳回那一步；還有缺的標出來。 */
const PreviewSection = ({
  title,
  missing,
  onEdit,
  children,
}: {
  title: string;
  missing: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) => (
  <GroupedSection
    title={title}
    footer={missing ? "這一區還有沒填的。" : undefined}
    action={
      <button type="button" onClick={onEdit} className="cursor-pointer text-[13px] font-medium text-primary-700 hover:underline">
        修改
      </button>
    }
  >
    {children}
  </GroupedSection>
);

/** 延續課種時的「沿用上一期的設定」：一張摘要，旁邊「改設定」展開欄位。 */
const InheritedSummary = ({ rows, onEdit }: { rows: [string, string][]; onEdit: () => void }) => (
  <GroupedSection
    title="沿用上一期的設定"
    footer="細節也一起沿用，下一步直接排課。"
    action={
      <button type="button" onClick={onEdit} className="cursor-pointer text-[13px] font-medium text-primary-700 hover:underline">
        改設定
      </button>
    }
  >
    {rows.map(([label, value]) => (
      <GroupedRow key={label} label={label}>
        <span className="truncate">{value}</span>
      </GroupedRow>
    ))}
  </GroupedSection>
);
