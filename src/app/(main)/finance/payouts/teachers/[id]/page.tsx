"use client";

import { useParams } from "next/navigation";
import TeacherStatement from "@/features/finance/v2/TeacherStatement";

const TeacherStatementPage = () => {
  const { id } = useParams<{ id: string }>();
  return <TeacherStatement teacherId={Number(id)} />;
};

export default TeacherStatementPage;
