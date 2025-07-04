import Button from "@/components/Button";
import { Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddPeriodForm from "./AddPeriodForm";
import { getLessonDraft, updateLessonDraft } from "@/lib/lessonDraftStorage";
import ProgressHeader from "@/components/ProgressHeader";
import { format } from "date-fns";

const Step2 = () => {
  const [periods, setPeriods] = useState<
    { startTime: string; endTime: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = () => {
    if (periods.length === 0) {
      setError("Please add at least one period");
      return;
    }
    updateLessonDraft({ periods });
    router.push("/lessons/new/step-3");
  };

  const handleAddPeriod = (period: {
    startTime: string;
    endTime: string;
  }) => {
    setPeriods([...periods, period]);
    setError(null);
    syncPeriods([...periods, period]);
  };

  const handleDeletePeriod = (index: number) => {
    const newPeriods = periods.filter((_, i) => i !== index);
    setPeriods(newPeriods);
    syncPeriods(newPeriods);
  };

  useEffect(() => {
    const draft = getLessonDraft();
    setPeriods(draft?.periods || []);
  }, []);

  const syncPeriods = (
    periods: { startTime: string; endTime: string }[]
  ) => {
    const draft = JSON.parse(localStorage.getItem("lesson-draft") || "{}");
    localStorage.setItem(
      "lesson-draft",
      JSON.stringify({
        ...draft,
        periods,
      })
    );
  };

  return (
    <>
      <ProgressHeader currentStep={2} />
      <div className="px-5 py-5 flex flex-col gap-5">
        <div className="mb-5 border border-gray-200 rounded-lg p-4">
          <AddPeriodForm onAddPeriod={handleAddPeriod} />
          <div className="flex flex-col gap-3">
            {periods.map((period, index) => (
              <PeriodCard
                key={index}
                period={period}
                onDelete={() => handleDeletePeriod(index)}
              />
            ))}
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 flex gap-4">
          <Button outline onClick={() => router.push("/lessons/new/step-1")}>
            Back
          </Button>
          <Button onClick={handleSubmit}>Next</Button>
        </div>
      </div>
    </>
  );
};

const PeriodCard = ({
  period,
  onDelete,
}: {
  period: { startTime: string; endTime: string };
  onDelete: () => void;
}) => {
  const date = format(new Date(period.startTime), "MMM d");
  const weekday = format(new Date(period.startTime), "EEE");

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-between w-full px-3 py-2 bg-primary-100 rounded-sm">
        <span className="text-sm font-semibold">
          {date}, {weekday}
        </span>
        <span className="text-xs">
          {format(new Date(period.startTime), "hh:mm aa")}
          {" ~ "}
          {format(new Date(period.endTime), "hh:mm aa")}
        </span>
      </div>
      <Trash className="w-4 h-4 cursor-pointer" onClick={onDelete} />
    </div>
  );
};

export default Step2;
