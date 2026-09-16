"use client";

import StudentDetail from "@/features/students/StudentDetail";
import StudentDetailHeader from "@/features/students/StudentDetail/StudentDetailHeader";
import { useGetStudentQuery } from "@/store/slices/students";
import { ArrowLeftIcon } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { useEffect } from "react";
import { resolveBackHref } from "@/lib/studentNav";
import { useSizeClass } from "@/hooks/useMediaQuery";

const StudentPage = () => {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const backHref = resolveBackHref(searchParams.get("from"));
  const sizeClass = useSizeClass();
  const { data: student, isLoading } = useGetStudentQuery({ id: Number(id) });

  // Start at the top when opening a student (otherwise the scroll position
  // from the student list carries over while the detail content loads).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // 單樹：一次只掛一個頁首。桌面版頁首裡有 EditStudent 的狀態，
  // 用 `hidden lg:block` 藏起來等於手機也照掛一份看不見的表單。
  return (
    <>
      {sizeClass === "compact" && (
        <div className="relative h-16 bg-primary-500 w-full flex items-center justify-center">
          <div className="absolute left-5 top-1/2 -translate-y-1/2">
            <Link href={backHref}>
              <ArrowLeftIcon className="w-6 h-6 text-white" />
            </Link>
          </div>
          <h2 className="text-white text-lg font-semibold">{student?.name}</h2>
        </div>
      )}

      {isLoading || !student ? (
        <ListSkeleton />
      ) : (
        <>
          {sizeClass === "expanded" && (
            <StudentDetailHeader student={student} backHref={backHref} />
          )}
          <StudentDetail student={student} />
        </>
      )}
    </>
  );
};

export default StudentPage;
