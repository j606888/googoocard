'use client';

import SubNavbar from "@/features/SubNavbar";
import Step1 from "@/features/lessons/newLesson/Step1";

const NewLessonStep1Page = () => {
  return <div>
    <SubNavbar title="New Lesson" backUrl="/lessons" />
    <Step1 />
  </div>;
};

export default NewLessonStep1Page;