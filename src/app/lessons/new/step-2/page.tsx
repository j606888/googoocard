'use client';

import SubNavbar from "@/features/SubNavbar";
import Step2 from "@/features/lessons/newLesson/Step2";

const NewLessonStep2Page = () => {
  return <div>
    <SubNavbar title="New Lesson" backUrl="/lessons" />
    <Step2 />
  </div>;
};

export default NewLessonStep2Page;