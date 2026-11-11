import InputField from "@/components/InputField";
import { useEffect, useState } from "react";
import CardSelect from "./CardSelect";
import { Button } from "@/components/ui/button";
import TeacherSelect from "./TeacherSelect";
import AssistantSelect from "./AssistantSelect";
import SeriesPicker, { seriesName, type SeriesChoice } from "./SeriesPicker";
import { useCreateLessonGroupMutation, useGetLessonGroupsQuery } from "@/store/slices/lessonGroups";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { seriesNameKey, seriesDisplayName } from "../seriesSuggest";
import { termNumbers } from "../termLabels";
import LocationSelect from "./LocationSelect";
import { useLocations } from "@/hooks/useLocations";
import SubNavbar from "@/features/SubNavbar";
import PeriodList from "./PeriodList";
import AddPeriodForm from "./AddPeriodForm";
import { useCreateLessonMutation } from "@/store/slices/lessons";
import { useRouter, useSearchParams } from "next/navigation";
import DanceStyleSelect from "./DanceStyleSelect";
import LevelSelect from "./LevelSelect";
import LessonKindSelect from "./LessonKindSelect";
import SessionsPerAttendanceSelect from "./SessionsPerAttendanceSelect";
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
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";
import { addDays } from "date-fns";
import { useSizeClass } from "@/hooks/useMediaQuery";

const validationErrors = {
  lessonName: "請選一個課種",
  newSeriesName: "請輸入新課種的名稱",
  teachers: "請至少選擇一位老師",
  cards: "請至少選擇一張課卡",
  periods: "請至少新增一個時段",
  danceStyle: "請選擇舞種",
  dropInPrice: "請輸入單堂價",
  dropInOptions: "每個方案都要有名稱和金額，名稱不能重複",
};

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
  // 開新一期：細節沿用上一期，先收起來只看摘要。
  const [detailOpen, setDetailOpen] = useState(!initialClone);
  const [addingPeriod, setAddingPeriod] = useState(false);
  const { data: teachers = [] } = useGetTeachersQuery();
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

  const handleSubmit = async () => {
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
    setErrors(errors);
    // 老師在「細節」裡：沒選就把細節打開，看得到錯誤。
    if (errors.teachers) setDetailOpen(true);
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

  // 細節收起來時的一行摘要。
  const detailSummary =
    [
      locations.find((l) => l.id === locationId)?.name,
      selectedTeacherIds.length
        ? `老師 ${selectedTeacherIds.map((id) => teachers.find((t) => t.id === id)?.name).filter(Boolean).join("、")}`
        : "還沒選老師",
      selectedAssistantIds.length
        ? `小幫手 ${selectedAssistantIds.map((id) => teachers.find((t) => t.id === id)?.name).filter(Boolean).join("、")}`
        : null,
      dropInEnabled ? "開放單堂" : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const submitButton = (
    <Button className="w-full" onClick={handleSubmit} isLoading={isLoading}>
      {isExpanded ? "建立課程" : "建立"}
    </Button>
  );

  return (
    <>
      {isExpanded ? (
        /* 桌面：頁內 header */
        <div className="flex w-full max-w-[1120px] items-center gap-3 px-8 pt-6 pb-2">
          <Link href="/lessons" className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-neutral-900">{initialClone ? "開新一期" : "新增課程"}</h1>
        </div>
      ) : (
        <SubNavbar title={initialClone ? "開新一期" : "新增課程"} backUrl="/lessons" />
      )}

      <div className="grid w-full max-w-[1120px] items-start gap-5 px-5 py-5 lg:grid-cols-[3fr_2fr] lg:gap-8 lg:px-8 lg:pt-2 lg:pb-8">
        <div className="flex min-w-0 flex-col gap-5">
          <FormSection step={1} title="基本設定" hint="開一堂課一定要有的">
            <div className="flex flex-col gap-1.5">
              <SeriesPicker value={series} onChange={handleSeriesChange} error={errors.lessonName} />
              {showCustomName && (
                <InputField
                  label="這一期的名稱（學生在課表上看到的）"
                  placeholder={baseName || "例：Bachata Lv1 冬季班"}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              )}
              {series && (
                <button
                  type="button"
                  onClick={() => {
                    if (!showCustomName && !customName.trim()) setCustomName(baseName);
                    setShowCustomName(!showCustomName);
                  }}
                  className="self-start py-1 text-[13px] font-medium text-primary-700 hover:underline cursor-pointer"
                >
                  {showCustomName ? "用課種名稱就好" : "這一期另取名稱（選填）"}
                </button>
              )}
            </div>
            <DanceStyleSelect
              danceStyleId={danceStyleId}
              onChange={handleDanceStyleChange}
              error={errors.danceStyle}
            />
            {hasLevels && <LevelSelect level={level} onChange={setLevel} />}
            <LessonKindSelect kind={kind} onChange={setPickedKind} />
            <SessionsPerAttendanceSelect
              value={sessionsPerAttendance}
              onChange={setSessionsPerAttendance}
            />
            <CardSelect
              error={errors.cards}
              onChange={handleCardChange}
              selectedCardIds={selectedCardIds}
              danceStyleId={danceStyleId}
            />
          </FormSection>

          <section className="rounded-2xl border border-neutral-200 bg-white">
            <button
              type="button"
              aria-expanded={detailOpen}
              onClick={() => setDetailOpen(!detailOpen)}
              className="flex w-full cursor-pointer items-center gap-2.5 px-5 py-4 text-left lg:px-6 lg:py-5"
            >
              <span className="text-xs font-bold text-primary-700">2</span>
              <span className="text-lg font-bold text-neutral-900">細節</span>
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-500">
                {detailOpen ? "分部、老師、小幫手、單堂付費" : detailSummary}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`size-5 shrink-0 text-neutral-500 transition-transform ${detailOpen ? "rotate-180" : ""}`}
              />
            </button>
            {detailOpen && (
              <div className="flex flex-col gap-5 px-5 pb-5 lg:px-6 lg:pb-6">
                <LocationSelect locationId={locationId} onChange={setPickedLocationId} />
                <TeacherSelect
                  error={errors.teachers}
                  onChange={handleTeacherChange}
                  selectedTeacherIds={selectedTeacherIds}
                />
                <AssistantSelect
                  selectedAssistantIds={selectedAssistantIds}
                  teacherIds={selectedTeacherIds}
                  onChange={setSelectedAssistantIds}
                />
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
                  error={errors.dropInPrice}
                />
              </div>
            )}
          </section>
          {isExpanded && submitButton}
        </div>

        <FormSection step={3} title="排課" aside={`${periods.length} 個時段`}>
          <PeriodList periods={periods} onDelete={handleDeletePeriod} />
          {addingPeriod ? (
            <AddPeriodForm
              periods={periods}
              onAddPeriod={handleAddPeriod}
              onCancel={() => setAddingPeriod(false)}
              initialPeriod={nextPeriodDefault}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="border-dashed"
              onClick={() => setAddingPeriod(true)}
            >
              <Plus className="size-4" />
              新增時段
            </Button>
          )}
          {errors.periods && <p className="text-sm text-danger-700">{errors.periods}</p>}
        </FormSection>
        {!isExpanded && submitButton}
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

/** 表單的一個分區：編號、標題、右側附註。 */
const FormSection = ({
  step,
  title,
  hint,
  aside,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  aside?: string;
  children: React.ReactNode;
}) => (
  <section className="flex min-w-0 flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5 lg:p-6">
    <div className="flex items-baseline gap-2.5">
      <span className="text-xs font-bold text-primary-700">{step}</span>
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      {hint && <span className="text-sm text-neutral-500">{hint}</span>}
      {aside && <span className="ml-auto text-sm text-neutral-500">{aside}</span>}
    </div>
    {children}
  </section>
);
