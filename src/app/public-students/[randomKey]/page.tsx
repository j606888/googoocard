"use client";

import StudentDetail from "@/features/students/StudentDetail";
import { useGetPublicStudentQuery } from "@/store/slices/students";
import { useParams } from "next/navigation";
import ListSkeleton from "@/components/skeletons/ListSkeleton";

const PublicStudentPage = () => {
  const { randomKey } = useParams();
  const { data: student, isLoading } = useGetPublicStudentQuery({ randomKey: randomKey as string }, { skip: !randomKey });

  return (
    <>
      <div className="relative h-16 bg-primary-500 w-full flex items-center justify-center">
        <h2 className="text-white text-lg font-semibold">{student?.classroom.name} - {student?.name}</h2>
      </div>
      {isLoading || !student ? <ListSkeleton /> : <StudentDetail student={student} isPublic />}
    </>
  );
};

export default PublicStudentPage;
