"use client";

import Button from "@/components/Button";
import SubNavbar from "@/features/SubNavbar";
import { AlarmClock } from "lucide-react";
import { useRouter } from "next/navigation";

const NewLessonPage = () => {
  const router = useRouter();

  return <div className='flex flex-col left-0 right-0 top-0 bottom-0 absolute bg-primary-50 overflow-hidden'>
    <SubNavbar title="New Lesson" backUrl="/lessons" />
    <div className='bg-primary-50 flex flex-col items-center gap-6 p-5 max-h-full'>
      <div className='flex items-center justify-center w-24 h-24 rounded-full bg-primary-500'>
        <AlarmClock className='w-12 h-12 text-white' />
      </div>
      <p className='text-base/relaxed text-center'>
        There are 5 steps to create lesson.<br/> It usually takes 3 to 10 minutes, depending on the size of your class.
      </p>
      <div className='flex flex-col gap-4 m-auto'>
        <Step step={1} description="Basic information" />
        <Step step={2} description="Lesson periods" />
        <Step step={3} description="Attend students" />
        <Step step={4} description="Class card" />
        <Step step={5} description="Review & Submit" />
      </div>
      <Button onClick={() => router.push("/lessons/new/step-1")} className="mt-auto">START</Button>
    </div>
  </div>
};

const Step = ({ step, description }: { step: number, description: string }) => {
  return <div className='flex items-center gap-4'>
    <div className='flex items-center justify-center w-8 h-8 rounded-full bg-primary-300'>
      <span className='text-primary-900 text-sm font-semibold'>{step}</span>
    </div>
    <p className='text-base/relaxed text-primary-900'>{description}</p>
  </div>
}

export default NewLessonPage;