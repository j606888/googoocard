'use client';

import SubNavbar from "@/features/SubNavbar";
import Step3 from "@/features/lessons/newLesson/Step3";

const NewLessonStep3Page = () => {
  return <div>
    <SubNavbar title="New Lesson" backUrl="/lessons" />
    <Step3 />
  </div>;
};

export default NewLessonStep3Page;