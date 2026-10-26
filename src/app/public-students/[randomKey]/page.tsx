"use client";

import StudentDetail from "@/features/students/StudentDetail";
import { useGetPublicStudentQuery } from "@/store/slices/students";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import LiffSkeleton from "@/features/liff/LiffSkeleton";

const PublicStudentPage = () => {
  const { randomKey } = useParams();
  const { data: student, isLoading } = useGetPublicStudentQuery({ randomKey: randomKey as string }, { skip: !randomKey });

  return (
    <>
      <div className="relative h-16 bg-primary-900 w-full flex items-center justify-center">
        <h2 className="text-white text-lg font-semibold">{student?.classroom.name} - {student?.name}</h2>
      </div>
      {isLoading || !student ? (
        <>
          <div className="px-5 pt-3">
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <LiffSkeleton rows={3} />
        </>
      ) : (
        <StudentDetail student={student} isPublic />
      )}
    </>
  );
};

export default PublicStudentPage;
