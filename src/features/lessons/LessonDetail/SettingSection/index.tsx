import { Lesson } from "@/store/slices/lessons";
import { useState } from "react";
import InputField from "@/components/InputField";
import DanceStyleSelect from "@/features/lessons/newLesson/DanceStyleSelect";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import LevelSelect from "@/features/lessons/newLesson/LevelSelect";
import LessonKindSelect from "@/features/lessons/newLesson/LessonKindSelect";
import type { LessonKind } from "@/lib/lessonKind";
import TeacherSelect from "@/features/lessons/newLesson/TeacherSelect";
import CardSelect from "@/features/lessons/newLesson/CardSelect";
import LessonGroupSelect from "@/features/lessons/newLesson/LessonGroupSelect";
import LocationSelect from "@/features/lessons/newLesson/LocationSelect";
import { Button } from "@/components/ui/button";
import {
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useEndLessonMutation,
  useReopenLessonMutation,
} from "@/store/slices/lessons";
import { useRouter } from "next/navigation";

const validationErrors = {
  lessonName: "請輸入課程名稱",
  teachers: "請至少選擇一位老師",
  cards: "請至少選擇一張課卡",
  danceStyle: "請選擇舞種",
};

const SettingSection = ({ lesson }: { lesson: Lesson }) => {

  const [lessonName, setLessonName] = useState(lesson.name);
  const [danceStyleId, setDanceStyleId] = useState<number | null>(lesson.danceStyleId);
  const { byId } = useDanceStyles();
  const hasLevels = danceStyleId !== null && (byId.get(danceStyleId)?.hasLevels ?? false);
  const [level, setLevel] = useState<number>(lesson.level);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>(lesson.teachers.map((teacher) => teacher.id));
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>(lesson.cards.map((card) => card.id));
  const [groupId, setGroupId] = useState<number | null>(lesson.groupId);
  const [locationId, setLocationId] = useState<number | null>(lesson.location?.id ?? null);
  const [kind, setKind] = useState<LessonKind>(lesson.kind);
  const [endLesson, { isLoading: isEnding }] = useEndLessonMutation();
  const [reopenLesson, { isLoading: isReopening }] = useReopenLessonMutation();
  const isEndedByHand = lesson.endedAt !== null;

  const handleEndToggle = async () => {
    if (isEndedByHand) {
      await reopenLesson(lesson.id).unwrap();
      return;
    }
    if (!confirm("確定要結束這門課程嗎？之後可以再重新開課。")) return;
    await endLesson(lesson.id).unwrap();
  };
  const [errors, setErrors] = useState<{
    lessonName?: string;
    teachers?: string;
    cards?: string;
    danceStyle?: string;
  }>({});
  const [updateLesson, { isLoading }] = useUpdateLessonMutation();
  const [deleteLesson, { isLoading: isDeleting }] = useDeleteLessonMutation();
  const router = useRouter();
  const hasNoPeriods = lesson.periods.length === 0;

  const handleDelete = () => {
    const confirmed = confirm("確定要刪除這門課程嗎？");
    if (!confirmed) return;
    router.push("/lessons");
    deleteLesson(lesson.id);
  };
  const handleLessonNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errors.lessonName) {
      setErrors((prev) => ({ ...prev, lessonName: undefined }));
    }
    setLessonName(e.target.value);
  };

  const handleDanceStyleChange = (value: number) => {
    setDanceStyleId(value);
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

  const handleSubmit = async () => {
    const errors = validateForm({
      lessonName,
      teachers: selectedTeacherIds,
      cards: selectedCardIds,
      danceStyleId,
    });
    setErrors(errors);
    if (Object.keys(errors).length === 0 && danceStyleId !== null) {
      await updateLesson({ id: lesson.id, draftLesson: { lessonName, teacherIds: selectedTeacherIds, cardIds: selectedCardIds, danceStyleId, level, kind, groupId, locationId } });
    }
  };

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
        <div className="flex flex-col gap-4">
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
          <LessonKindSelect kind={kind} onChange={setKind} />
          <LocationSelect locationId={locationId} onChange={setLocationId} />
          <LessonGroupSelect
            groupId={groupId}
            onChange={setGroupId}
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
          <Button className="w-full" onClick={handleSubmit} isLoading={isLoading}>
            儲存
          </Button>
          <div className="pt-4 border-t border-neutral-200 flex flex-col gap-1">
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleEndToggle}
              isLoading={isEnding || isReopening}
            >
              {isEndedByHand ? "重新開課" : "結束課程"}
            </Button>
            <p className="text-xs text-neutral-500 text-center">
              {isEndedByHand
                ? "這門課已手動結束；重新開課或排新時段都會回到「進行中」"
                : "結束後移到「已結束」，紀錄都會保留"}
            </p>
          </div>
          <div className="pt-4 border-t border-neutral-200">
            <Button
              variant="dangerSecondary"
              className="w-full"
              onClick={handleDelete}
              disabled={!hasNoPeriods || isDeleting}
            >
              刪除課程
            </Button>
            {!hasNoPeriods && (
              <p className="text-xs text-neutral-500 mt-1 text-center">
                刪除課程前，請先移除所有時段
              </p>
            )}
          </div>
        </div>
      </div>
  );
};

const validateForm = (data: {
  lessonName: string;
  teachers: number[];
  cards: number[];
  danceStyleId: number | null;
}) => {
  const errors: {
    lessonName?: string;
    teachers?: string;
    cards?: string;
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
  return errors;
};

export default SettingSection;
