'use client';

import SubNavbar from "@/features/SubNavbar";
import Step4 from "@/features/lessons/newLesson/Step4";

const NewLessonStep4Page = () => {
  return <div>
    <SubNavbar title="New Lesson" backUrl="/lessons" />
    <Step4 />
  </div>;
};

export default NewLessonStep4Page;