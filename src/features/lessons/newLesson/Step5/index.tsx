import ProgressBall from "@/components/ProgressBall";
import Button from "@/components/Button";
import { useRouter } from "next/navigation";
import BasicInformation from "./BasicInformation";
import Periods from "./Periods";
import StudentsAndCards from "./StudentsAndCards";

const Step4 = () => {
  const router = useRouter();

  const handleSubmit = () => {
    router.push("/lessons");
  }

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-center">Review & Submit</h2>
      <ProgressBall currentStep={5} />
      <div>
        <BasicInformation />
        <Periods />
        <StudentsAndCards />
      </div>
        <div className="bg-white flex gap-4 px-5 py-4">
        <Button outline onClick={() => router.push("/lessons/new/step-4")}>
          Back
          </Button>
          <Button onClick={handleSubmit}>Save</Button>
        </div>
    </div>
  );
};

export default Step4;
