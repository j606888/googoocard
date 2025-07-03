"use client";

import StudentDetail from "@/features/students/StudentDetail";
import { useGetStudentQuery } from "@/store/slices/students";
import { ArrowLeftIcon } from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";

const StudentPage = () => {
  const { id } = useParams();
  const { data: student } = useGetStudentQuery({ id: Number(id) });
  return (
    <>
      <div className="relative h-16 bg-primary-500 w-full flex items-center justify-center">
        <div className="absolute left-5 top-1/2 -translate-y-1/2">
          <Link href="/students">
            <ArrowLeftIcon className="w-6 h-6 text-white" />
          </Link>
        </div>
        <h2 className="text-white text-lg font-semibold">{student?.name}</h2>
      </div>
      {student && <StudentDetail student={student} />}
    </>
  );
};

export default StudentPage;
