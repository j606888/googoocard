import InputField from "@/components/InputField";
import { useState } from "react";
import CardSelect from "./CardSelect";
import { Button } from "@/components/ui/button";
import TeacherSelect from "./TeacherSelect";
import LessonGroupSelect from "./LessonGroupSelect";
import SubNavbar from "@/features/SubNavbar";
import PeriodList from "./PeriodList";
import AddPeriodForm from "./AddPeriodForm";
import { useCreateLessonMutation } from "@/store/slices/lessons";
import { useRouter, useSearchParams } from "next/navigation";
import DanceStyleSelect from "./DanceStyleSelect";
import LevelSelect from "./LevelSelect";
import { DEFAULT_DANCE_LEVEL } from "@/lib/danceLevels";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import {
  getLessonCloneSource,
  clearLessonCloneSource,
} from "@/lib/lessonDraftStorage";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSizeClass } from "@/hooks/useMediaQuery";
import StepFlow from "@/components/StepFlow";

const validationErrors = {
  lessonName: "請輸入課程名稱",
  teachers: "請至少選擇一位老師",
  cards: "請至少選擇一張課卡",
  periods: "請至少新增一個時段",
  danceStyle: "請選擇舞種",
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

  const [lessonName, setLessonName] = useState(initialClone?.lessonName ?? "");
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
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>(
    initialClone?.teacherIds ?? []
  );
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>(
    initialClone?.cardIds ?? []
  );
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    initialClone?.groupId ?? (groupIdParam ? Number(groupIdParam) : null)
  );

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
  }>({});
  const [createLesson, { isLoading }] = useCreateLessonMutation();
  const router = useRouter();

  const handleLessonNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errors.lessonName) {
      setErrors((prev) => ({ ...prev, lessonName: undefined }));
    }
    setLessonName(e.target.value);
  };

  const handleDanceStyleChange = (value: number) => {
    setPickedStyleId(value);
    if (errors.danceStyle) {
      setErrors((prev) => ({ ...prev, danceStyle: undefined }));
    }
  };

  const handleTeacherChange = (value: number[]) => {
    setSelectedTeacherIds(value);
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
  };

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
    });
    setErrors(errors);
    if (Object.keys(errors).length === 0 && danceStyleId !== null) {
      await createLesson({
        lessonName,
        teacherIds: selectedTeacherIds,
        cardIds: selectedCardIds,
        danceStyleId,
        // A style without levels has no 階級 picker; its lessons are 初階.
        level: hasLevels ? level : DEFAULT_DANCE_LEVEL,
        groupId: selectedGroupId,
        periods,
      });

      router.push("/lessons");
    }
  };

  const submitButton = (
    <Button className="w-full" onClick={handleSubmit} isLoading={isLoading}>
      {isExpanded ? "建立課程" : "建立"}
    </Button>
  );

  return (
    <>
      {isExpanded ? (
        /* 桌面：頁內 header */
        <div className="flex items-center gap-3 px-8 pt-6 pb-2">
          <Link href="/lessons" className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-neutral-900">新增課程</h1>
        </div>
      ) : (
        <SubNavbar title="新增課程" backUrl="/lessons" />
      )}

      <StepFlow
        columns="3fr 2fr"
        submit={submitButton}
        steps={[
          {
            key: "info",
            title: "課程資訊",
            content: (
              <>
                <InputField
                  label="課程名稱"
                  placeholder="例：Bachata Lv1"
                  value={lessonName}
                  onChange={handleLessonNameChange}
                  error={errors.lessonName}
                />
                <DanceStyleSelect
                  danceStyleId={danceStyleId}
                  onChange={handleDanceStyleChange}
                  error={errors.danceStyle}
                />
                {hasLevels && <LevelSelect level={level} onChange={setLevel} />}
                <LessonGroupSelect
                  groupId={selectedGroupId}
                  onChange={setSelectedGroupId}
                />
                <TeacherSelect
                  error={errors.teachers}
                  onChange={handleTeacherChange}
                  selectedTeacherIds={selectedTeacherIds}
                />
                <CardSelect
                  error={errors.cards}
                  onChange={handleCardChange}
                  selectedCardIds={selectedCardIds}
                  danceStyleId={danceStyleId}
                />
              </>
            ),
          },
          {
            key: "schedule",
            title: "排課",
            aside: `已新增 ${periods.length} 個時段`,
            content: (
              <>
                <AddPeriodForm
                  periods={periods}
                  onAddPeriod={handleAddPeriod}
                  error={errors.periods}
                  initialPeriod={cloneInitialPeriod}
                />
                <PeriodList periods={periods} onDelete={handleDeletePeriod} />
              </>
            ),
          },
        ]}
      />
    </>
  );
};

const validateForm = (data: {
  lessonName: string;
  teachers: number[];
  cards: number[];
  periods: { startTime: string; endTime: string }[];
  danceStyleId: number | null;
}) => {
  const errors: {
    lessonName?: string;
    teachers?: string;
    cards?: string;
    periods?: string;
    danceStyle?: string;
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
  if (data.cards.length === 0) {
    errors.cards = validationErrors.cards;
  }
  if (data.periods.length === 0) {
    errors.periods = validationErrors.periods;
  }
  return errors;
};

export default NewLesson;
