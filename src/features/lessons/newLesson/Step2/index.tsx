import Button from "@/components/Button";
import { Snail, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLessonDraft, updateLessonDraft } from "@/lib/lessonDraftStorage";
import ProgressHeader from "@/components/ProgressHeader";
import { format } from "date-fns";
import AddPeriodForm from "./AddPeriodForm";

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
    const newPeriods = [...periods, period];
    const sortedPeriods = newPeriods.sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
    setError(null);
    setPeriods(sortedPeriods);
    syncPeriods(sortedPeriods);
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
      <div className="px-5 py-3 flex flex-col gap-5">
        <AddPeriodForm periods={periods} onAddPeriod={handleAddPeriod} />
        <div className="flex flex-col gap-3 mb-20">
            {periods.map((period, index) => (
              <PeriodCard
                key={index}
                period={period}
                onDelete={() => handleDeletePeriod(index)}
              />
            ))}
            {periods.length === 0 && (
              <div className="bg-primary-100 rounded-sm p-6 flex flex-col gap-3 items-center">
                <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
                  <Snail className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-semibold">No periods yet</h4>
                  <p className="text-sm text-gray-500">
                    Add at least one period to continue
                  </p>
                </div>
              </div>
            )}
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="fixed bottom-0 left-0 right-0 p-4 flex gap-4 bg-white">
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
