import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { seriesName, type SeriesChoice } from "./SeriesPicker";
import { useCreateLessonGroupMutation, useGetLessonGroupsQuery } from "@/store/slices/lessonGroups";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { seriesNameKey, seriesDisplayName } from "../seriesSuggest";
import { termNumbers } from "../termLabels";
import { useLocations } from "@/hooks/useLocations";
import SubNavbar from "@/features/SubNavbar";
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
import { ArrowLeft, Check, X } from "lucide-react";
import { DANCE_LEVELS } from "@/lib/danceLevels";
import { ActionRow, GROUPED_PAGE_BG, GroupedRow, GroupedSection, SegmentedControl } from "./grouped";
import { AssistantGroup, CardGroup, DanceStyleGroup, LocationGroup, SeriesGroup, TeacherGroup } from "./groupedFields";
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
  const { data: groups = [] } = useGetLessonGroupsQuery();
  const [series, setSeries] = useState<SeriesChoice>(() => {
    const id = initialClone?.groupId ?? (groupIdParam ? Number(groupIdParam) : null);
    if (id) return { type: "existing", id };
    // 沒課種的舊課開新一期：用它清過的課名當新課種。
    return initialClone ? { type: "new", name: seriesDisplayName(initialClone.lessonName) } : null;
  });
  const baseName = seriesName(series, groups);
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

  const cloneInitialPeriod = initialClone?.initialPeriod;
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

  // 選了現有課種：舞種、階級跟著它最新一期帶入。
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
    }
    setPrefillGroupId(null);
  }, [prefillGroupId, groupLessons]);

  const handleSeriesChange = (choice: SeriesChoice) => {
    setSeries(choice);
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
    : cloneInitialPeriod;

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

  /** 下一步：這一步有缺就留在這裡把錯誤標出來。 */
  const handleNext = () => {
    const stepErrors = Object.fromEntries(
      Object.entries(liveErrors).filter(([key]) => ERROR_STEP[key as keyof typeof ERROR_STEP] === step)
    );
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) goTo(step + 1);
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
  const title = initialClone ? "開新一期" : "新增課程";
  const isPreview = step === STEPS.length - 1;

  return (
    <>
      {!isExpanded && <SubNavbar title={title} backUrl="/lessons" />}

      <div className={`min-h-dvh w-full ${GROUPED_PAGE_BG}`}>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pt-4 pb-32 lg:px-6 lg:pt-8">
        {isExpanded && (
          <div className="flex items-center gap-3">
            <Link href="/lessons" aria-label="回課程" className="text-neutral-400 hover:text-neutral-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-[15px] text-neutral-500">{title}</span>
          </div>
        )}

        <nav aria-label="步驟" className="flex flex-col gap-2">
          <ol className="grid grid-cols-4 gap-1.5">
            {STEPS.map((label, index) => {
              const active = index === step;
              const done = index < STEPS.length - 1 && stepDone(index);
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    aria-current={active ? "step" : undefined}
                    className="group flex w-full cursor-pointer flex-col gap-1.5 pt-1 text-left"
                  >
                    <span
                      className={`h-1 rounded-full transition-colors ${
                        active ? "bg-primary-700" : done ? "bg-primary-300" : "bg-neutral-300"
                      }`}
                    />
                    <span
                      className={`flex items-center gap-1 text-[13px] ${
                        active ? "font-semibold text-neutral-900" : "text-neutral-500 group-hover:text-neutral-800"
                      }`}
                    >
                      {done && !active && <Check aria-label="已完成" className="size-3.5 text-primary-700" />}
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <h1 className="text-[28px] font-bold tracking-tight text-neutral-900 lg:text-[32px]">
          {STEPS[step]}
        </h1>

        {step === 0 && (
          <>
            <SeriesGroup
              value={series}
              onChange={handleSeriesChange}
              customName={customName}
              onCustomNameChange={setCustomName}
              showCustomName={showCustomName}
              onShowCustomNameChange={setShowCustomName}
              baseName={baseName}
              error={errors.lessonName}
            />
            <DanceStyleGroup danceStyleId={danceStyleId} onChange={handleDanceStyleChange} error={errors.danceStyle}>
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
              <div className="flex flex-col gap-2 px-4 py-3">
                <span className="text-[15px] text-neutral-900">型態</span>
                <SegmentedControl
                  ariaLabel="課程型態"
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

        {step === 1 && (
          <>
            {initialClone && (
              <p className="-mt-3 px-4 text-[15px] text-neutral-500">沿用上一期的設定，有變再改。</p>
            )}
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
            title={`時段 · ${periods.length} 個`}
            error={errors.periods}
            footer={periods.length === 0 && !addingPeriod ? "至少加一個時段才能開課。" : undefined}
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
            <p className="-mt-3 px-4 text-[15px] text-neutral-500">確認一下，沒問題就建立。</p>
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
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex w-full max-w-[640px] items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:px-6">
          {step > 0 && (
            <Button variant="secondary" onClick={() => goTo(step - 1)}>
              上一步
            </Button>
          )}
          <span className="flex-1" />
          {isPreview ? (
            <Button onClick={handleSubmit} isLoading={isLoading}>
              {title === "開新一期" ? "開這一期" : "建立課程"}
            </Button>
          ) : (
            <Button onClick={handleNext}>{step === STEPS.length - 2 ? "預覽" : "下一步"}</Button>
          )}
        </div>
      </div>
    </>
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
