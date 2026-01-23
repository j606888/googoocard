import { Lesson } from "@/store/slices/lessons";
import { useState } from "react";
import { DanceType } from "@prisma/client";
import InputField from "@/components/InputField";
import DanceTypeSelect from "@/features/lessons/newLesson/DanceTypeSelect";
import TeacherSelect from "@/features/lessons/newLesson/TeacherSelect";
import CardSelect from "@/features/lessons/newLesson/CardSelect";
import Button from "@/components/Button";
import { useUpdateLessonMutation } from "@/store/slices/lessons";

const validationErrors = {
  lessonName: "Must provide a name",
  teachers: "Must select at least one teacher",
  cards: "Must select at least one card",
};

const SettingSection = ({ lesson }: { lesson: Lesson }) => {

  const [lessonName, setLessonName] = useState(lesson.name);
  const [danceType, setDanceType] = useState<DanceType>(lesson.danceType);  
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>(lesson.teachers.map((teacher) => teacher.id));
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>(lesson.cards.map((card) => card.id));
  const [errors, setErrors] = useState<{
    lessonName?: string;
    teachers?: string;
    cards?: string;
  }>({});
  const [updateLesson, { isLoading }] = useUpdateLessonMutation();
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
      await updateLesson({ id: lesson.id, draftLesson: { lessonName, teacherIds: selectedTeacherIds, cardIds: selectedCardIds, danceType } });
    }
  };

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <InputField
            label="Lesson Name"
            placeholder="E.g. Bachata Lv1"
            value={lessonName}
            onChange={handleLessonNameChange}
            error={errors.lessonName}
          />
          <DanceTypeSelect
            danceType={danceType}
            onChange={handleDanceTypeChange}
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
          />
          <Button onClick={handleSubmit} isLoading={isLoading}>
            Update
          </Button>
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
