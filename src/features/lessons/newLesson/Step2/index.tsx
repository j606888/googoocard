import Button from "@/components/Button";
import ProgressBall from "@/components/ProgressBall";
import { Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddPeriodForm from "./AddPeriodForm";
import { getLessonDraft, updateLessonDraft } from "@/lib/lessonDraftStorage";

const Step2 = () => {
  const [periods, setPeriods] = useState<{ date: string, fromTime: string, toTime: string }[]>([]);
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

  const handleAddPeriod = (period: { date: string, fromTime: string, toTime: string }) => {
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

  const syncPeriods = (periods: { date: string, fromTime: string, toTime: string }[]) => {
    const draft = JSON.parse(localStorage.getItem('lesson-draft') || '{}');
    localStorage.setItem("lesson-draft", JSON.stringify({
      ...draft,
      periods,
    }));
  }

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-center">Lesson periods</h2>
      <ProgressBall currentStep={2} />
      <div className="mb-5 border border-gray-200 rounded-lg p-4">
        <AddPeriodForm onAddPeriod={handleAddPeriod} />
        <div className="flex flex-col gap-3">
          {periods.map((period, index) => (
            <PeriodCard key={index} period={period} onDelete={() => handleDeletePeriod(index)} />
          ))}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
      <div className="flex gap-4">
        <Button outline onClick={() => router.push("/lessons/new/step-1")}>
          Back
        </Button>
        <Button onClick={handleSubmit}>Next</Button>
      </div>
    </div>
  );
};

const PeriodCard = ({ period, onDelete }: { period: { date: string, fromTime: string, toTime: string }, onDelete: () => void }) => {
  const weekday = new Date(period.date).toLocaleDateString('en-US', { weekday: 'short' });
  return (
    <div className="flex items-center gap-2">
    <div className="flex items-center justify-between w-full px-3 py-2 bg-primary-100 rounded-sm">
      <span className="text-sm font-semibold">{period.date}, {weekday}</span>
      <span className="text-xs">{period.fromTime} ~ {period.toTime}</span>
    </div>
    <Trash className="w-4 h-4 cursor-pointer" onClick={onDelete}/>
  </div>
  )
}

export default Step2;
