import Button from "@/components/Button";
import { useRouter } from "next/navigation";
import BasicInformation from "./BasicInformation";
import Periods from "./Periods";
import StudentsAndCards from "./StudentsAndCards";
import ProgressHeader from "@/components/ProgressHeader";
import { useCreateLessonMutation } from "@/store/slices/lessons";
import { getLessonDraft } from "@/lib/lessonDraftStorage";

const Step4 = () => {
  const router = useRouter();
  const [createLesson, { isLoading }] = useCreateLessonMutation();
  
  const handleSubmit = async () => {
    const draftLesson = getLessonDraft();
    if (draftLesson) {
      await createLesson(draftLesson);
      router.push("/lessons");
    }
  };

  return (
    <>
      <ProgressHeader currentStep={5} />
      <div className="px-5 py-5 mb-16 flex flex-col gap-3">
        <BasicInformation />
        <Periods />
        <StudentsAndCards />
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white flex gap-4 px-5 py-4">
        <Button outline onClick={() => router.push("/lessons/new/step-4")}>
          Back
        </Button>
        <Button onClick={handleSubmit} isLoading={isLoading}>Save</Button>
      </div>
    </>
  );
};

export default Step4;
