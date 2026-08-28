import { Lesson } from "@/store/slices/lessons";
import { useState } from "react";
import { DanceType } from "@prisma/client";
import InputField from "@/components/InputField";
import DanceTypeSelect from "@/features/lessons/newLesson/DanceTypeSelect";
import TeacherSelect from "@/features/lessons/newLesson/TeacherSelect";
import CardSelect from "@/features/lessons/newLesson/CardSelect";
import LessonGroupSelect from "@/features/lessons/newLesson/LessonGroupSelect";
import { Button } from "@/components/ui/button";
import { useUpdateLessonMutation, useDeleteLessonMutation } from "@/store/slices/lessons";
import { useRouter } from "next/navigation";

const validationErrors = {
  lessonName: "請輸入課程名稱",
  teachers: "請至少選擇一位老師",
  cards: "請至少選擇一張課卡",
};

const SettingSection = ({ lesson }: { lesson: Lesson }) => {

  const [lessonName, setLessonName] = useState(lesson.name);
  const [danceType, setDanceType] = useState<DanceType>(lesson.danceType);  
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>(lesson.teachers.map((teacher) => teacher.id));
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>(lesson.cards.map((card) => card.id));
  const [groupId, setGroupId] = useState<number | null>(lesson.groupId);
  const [errors, setErrors] = useState<{
    lessonName?: string;
    teachers?: string;
    cards?: string;
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

  const handleDanceTypeChange = (value: DanceType) => {
    setDanceType(value);
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
    });
    setErrors(errors);
    if (Object.keys(errors).length === 0) {
      await updateLesson({ id: lesson.id, draftLesson: { lessonName, teacherIds: selectedTeacherIds, cardIds: selectedCardIds, danceType, groupId } });
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
          <DanceTypeSelect
            danceType={danceType}
            onChange={handleDanceTypeChange}
          />
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
            danceType={danceType}
          />
          <Button className="w-full" onClick={handleSubmit} isLoading={isLoading}>
            儲存
          </Button>
          <div className="pt-4 border-t border-neutral-200">
            <button
              onClick={handleDelete}
              disabled={!hasNoPeriods || isDeleting}
              className={`w-full py-2 rounded font-semibold text-white bg-danger-500 hover:bg-danger-600 ${
                !hasNoPeriods || isDeleting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              刪除課程
            </button>
            {!hasNoPeriods && (
              <p className="text-xs text-neutral-400 mt-1 text-center">
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
}) => {
  const errors: {
    lessonName?: string;
    teachers?: string;
    cards?: string;
  } = {};
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
