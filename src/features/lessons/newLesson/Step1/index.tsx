import InputField from "@/components/InputField";
import { useState } from "react";
import CardSelect from "./CardSelect";
import Button from "@/components/Button";
import TeacherSelect from "./TeacherSelect";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getLessonDraft, updateLessonDraft } from "@/lib/lessonDraftStorage";
import ProgressHeader from "@/components/ProgressHeader";

const validationErrors = {
  lessonName: "Must provide a name",
  teachers: "Must select at least one teacher",
  cards: "Must select at least one card",
};

const Step1 = () => {
  const router = useRouter();
  const [lessonName, setLessonName] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<{
    lessonName?: string;
    teachers?: string;
    cards?: string;
  }>({});

  const handleLessonNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (errors.lessonName) {
      setErrors((prev) => ({ ...prev, lessonName: undefined }));
    }
    setLessonName(e.target.value);
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

  const handleSubmit = () => {
    const errors = validateForm({
      lessonName,
      teachers: selectedTeacherIds,
      cards: selectedCardIds,
    });
    setErrors(errors);

    if (Object.keys(errors).length === 0) {
      updateLessonDraft({
        lessonName,
        teacherIds: selectedTeacherIds,
        cardIds: selectedCardIds,
      });

      router.push("/lessons/new/step-2");
    }
  };

  useEffect(() => {
    const draft = getLessonDraft();
    if (draft) {
      setLessonName(draft.lessonName);
      setSelectedTeacherIds(draft.teacherIds);
      setSelectedCardIds(draft.cardIds);
    }
  }, []);

  return (
    <>
      <ProgressHeader currentStep={1} />
      <div className="px-5 py-5 flex flex-col gap-5">
        <div className="flex flex-col gap-4 mb-5">
          <InputField
            label="Lesson Name"
            placeholder="E.g. Bachata Lv1"
            value={lessonName}
            onChange={handleLessonNameChange}
            error={errors.lessonName}
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
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 flex gap-4">
          <Button onClick={handleSubmit}>Next</Button>
        </div>
      </div>
    </>
  );
};

const validateForm = (data: {
  lessonName: string;
  teachers: number[];
  cards: number[];
}) => {
  const errors: { lessonName?: string; teachers?: string; cards?: string } = {};
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

export default Step1;
