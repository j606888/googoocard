"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/features/Navbar";
import TeacherDetail, { isTeacherTab, type TeacherTab } from "@/features/teachers/TeacherDetail";
import { currentMonthKey } from "@/features/teachers/format";

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

const TeacherPage = () => {
  const { id } = useParams();
  // The overview links here with the month it was showing.
  const searchParams = useSearchParams();
  const month = searchParams.get("month");
  const tabParam = searchParams.get("tab");
  const tab: TeacherTab = isTeacherTab(tabParam) ? tabParam : "lessons";
  const router = useRouter();
  const pathname = usePathname();
  // 分頁記在網址：重新整理、從學生頁返回都回到同一個分頁。
  const changeTab = (next: TeacherTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "lessons") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <>
      <Navbar />
      <TeacherDetail
        key={String(id)}
        id={Number(id)}
        initialMonth={month && MONTH_KEY.test(month) ? month : currentMonthKey()}
        tab={tab}
        onTabChange={changeTab}
      />
    </>
  );
};

export default TeacherPage;
