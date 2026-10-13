"use client";

import StudentDetail from "@/features/students/StudentDetail";
import StudentDetailHeader from "@/features/students/StudentDetail/StudentDetailHeader";
import { useGetStudentQuery } from "@/store/slices/students";
import { ChevronLeft } from "lucide-react";
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

  // 單樹：一次只掛一個頁首（桌面或手機），頁首裡有 EditStudent 的狀態，
  // 用 `hidden lg:block` 藏起來等於另一邊也照掛一份看不見的表單。
  if (isLoading || !student) {
    return (
      <>
        {sizeClass === "compact" && (
          <div className="px-2 py-1.5">
            <Link
              href={backHref}
              aria-label="返回學生列表"
              className="w-11 h-11 grid place-items-center rounded-xl text-neutral-900"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
          </div>
        )}
        <ListSkeleton />
      </>
    );
  }

  return (
    <>
      <StudentDetailHeader
        student={student}
        backHref={backHref}
        variant={sizeClass === "compact" ? "compact" : "page"}
      />
      <StudentDetail student={student} />
    </>
  );
};

export default StudentPage;
