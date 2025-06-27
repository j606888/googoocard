import Button from "@/components/Button";
import { useRouter } from "next/navigation";
import BasicInformation from "./BasicInformation";
import Periods from "./Periods";
import StudentsAndCards from "./StudentsAndCards";
import ProgressHeader from "@/components/ProgressHeader";

const Step4 = () => {
  const router = useRouter();

  const handleSubmit = () => {
    router.push("/lessons");
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
        <Button onClick={handleSubmit}>Save</Button>
      </div>
    </>
  );
};

export default Step4;
