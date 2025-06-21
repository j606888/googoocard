'use client';

import SubNavbar from "@/features/SubNavbar";
import Step5 from "@/features/lessons/newLesson/Step5";

const NewLessonStep5Page = () => {
  return <div>
    <SubNavbar title="New Lesson" backUrl="/lessons" />
    <Step5 />
  </div>;
};

export default NewLessonStep5Page;