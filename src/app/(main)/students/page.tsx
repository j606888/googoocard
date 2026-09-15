"use client";

import Navbar from "@/features/Navbar";
import StudentList from "@/features/students/StudentList";
import StudentsSplitView from "@/features/students/StudentsSplitView";
import { useSizeClass } from "@/hooks/useMediaQuery";

const StudentsPage = () => {
  // 只掛載其中一棵樹：兩棵都掛的話兩份篩選狀態會各自寫 localStorage 而分岔。
  const sizeClass = useSizeClass();

  return (
    <>
      <Navbar />
      {sizeClass === "expanded" ? <StudentsSplitView /> : <StudentList />}
    </>
  );
};

export default StudentsPage;
