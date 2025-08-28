import InputField from "@/components/InputField";
import { useState } from "react";
import CardSelect from "./CardSelect";
import Button from "@/components/Button";
import TeacherSelect from "./TeacherSelect";
import SubNavbar from "@/features/SubNavbar";
import PeriodList from "./PeriodList";
import AddPeriodForm from "./AddPeriodForm";
import { useCreateLessonMutation } from "@/store/slices/lessons";
import { useRouter } from "next/navigation";

const validationErrors = {
  lessonName: "Must provide a name",
  teachers: "Must select at least one teacher",
  cards: "Must select at least one card",
  periods: "Must add at least one period",
};

const NewLesson = () => {
  const [lessonName, setLessonName] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
  const [periods, setPeriods] = useState<
    { startTime: string; endTime: string }[]
  >([]);
  const [errors, setErrors] = useState<{
    lessonName?: string;
    teachers?: string;
    cards?: string;
    periods?: string;
  }>({});
  const [createLesson, { isLoading }] = useCreateLessonMutation();
  const router = useRouter();

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
    });
    setErrors(errors);
    if (Object.keys(errors).length === 0) {
      await createLesson({
        lessonName,
        teacherIds: selectedTeacherIds,
        cardIds: selectedCardIds,
        periods,
      });

      router.push("/lessons");
    }
  };

  return (
    <>
      <SubNavbar title="New Lesson" backUrl="/lessons" />
      <div className="px-5 py-5 flex flex-col gap-5">
        <div className="flex flex-col gap-4">
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
          <AddPeriodForm
            periods={periods}
            onAddPeriod={handleAddPeriod}
            error={errors.periods}
          />
          <PeriodList periods={periods} onDelete={handleDeletePeriod} />
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 flex gap-4">
          <Button onClick={handleSubmit} isLoading={isLoading}>
            Create
          </Button>
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
}) => {
  const errors: {
    lessonName?: string;
    teachers?: string;
    cards?: string;
    periods?: string;
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
  if (data.periods.length === 0) {
    errors.periods = validationErrors.periods;
  }
  return errors;
};

export default NewLesson;
