"use client";

import { useParams, useSearchParams } from "next/navigation";
import Navbar from "@/features/Navbar";
import TeacherDetail from "@/features/teachers/TeacherDetail";
import { currentMonthKey } from "@/features/teachers/format";

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const TeacherPage = () => {
  const { id } = useParams();
  // The overview links here with the month it was showing.
  const month = useSearchParams().get("month");

  return (
    <>
      <Navbar />
      <TeacherDetail
        key={String(id)}
        id={Number(id)}
        initialMonth={month && MONTH_KEY.test(month) ? month : currentMonthKey()}
      />
    </>
  );
};

export default TeacherPage;
