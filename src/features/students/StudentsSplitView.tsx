"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import StudentList from "./StudentList";
import StudentDetail from "./StudentDetail";
import StudentDetailHeader from "./StudentDetail/StudentDetailHeader";
import { Student, useGetStudentQuery } from "@/store/slices/students";
import { studentDetailHref } from "@/lib/studentNav";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import SplitView, { useSelectionMirroredToUrl } from "@/components/SplitView";

const selHref = (studentId: number) => `/students?sel=${studentId}`;

/**
 * 桌面版學生頁：左邊名單常駐、右邊換人不換頁。
 *
 * 版面與「選取鏡射到網址」的行為都在 `SplitView`——為什麼 state 是真相、
 * 網址只是鏡射，理由寫在那裡。
 *
 * 右欄只放日常會看的三個分頁；轉換卡片、停用、備註這類深度操作維持在原本的
 * 三欄完整頁面（右上角「完整頁面」）。
 */
const StudentsSplitView = () => {
  const router = useRouter();
  const { selectedId, select } = useSelectionMirroredToUrl("sel");

  const { data: student, isLoading } = useGetStudentQuery(
    { id: selectedId as number },
    { skip: selectedId == null }
  );

  const handleSelect = useCallback((next: Student) => select(next.id), [select]);

  const openFull = useCallback(
    (next: Student) => router.push(studentDetailHref(next.id, selHref(next.id))),
    [router]
  );

  return (
    <SplitView
      list={
        <StudentList
          variant="roster"
          selectedId={selectedId}
          onSelect={handleSelect}
          onOpenFull={openFull}
        />
      }
      detail={
        selectedId == null ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full">
              <Users className="w-6 h-6 text-primary-700" />
            </div>
            <p className="text-neutral-500 text-sm">從左邊選一位學生</p>
          </div>
        ) : isLoading || !student ? (
          <ListSkeleton />
        ) : (
          <>
            <StudentDetailHeader
              student={student}
              variant="pane"
              fullHref={studentDetailHref(student.id, selHref(student.id))}
            />
            <StudentDetail student={student} layout="tabs" />
          </>
        )
      }
    />
  );
};

export default StudentsSplitView;
