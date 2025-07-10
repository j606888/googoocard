import { useParams } from "next/navigation";
import LessonTabs from "./LessonTabs";
import {
  useGetLessonQuery,
  useGetLessonStudentsQuery,
} from "@/store/slices/lessons";
import SubNavbar from "@/features/SubNavbar";
import { useState } from "react";
import PeriodSection from "./PeriodSection";
import StudentSection from "./StudentSection";
import SettingSection from "./SettingSection";
import ListSkeleton from "@/components/skeletons/ListSkeleton";

export const TABS = [
  {
    name: "Periods",
    query: "periods",
  },
  {
    name: "Students",
    query: "students",
  },
  {
    name: "Settings",
    query: "settings",
  },
];

const LessonDetail = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("periods");
  const { data: lesson, isLoading: isLessonLoading } = useGetLessonQuery(
    id as string
  );
  const { data: students, isLoading: isStudentsLoading } =
    useGetLessonStudentsQuery({
      id: parseInt(id as string),
    });

  return (
    <>
      <SubNavbar title={lesson?.name || ""} backUrl={`/lessons`} withUnpaidBell />
      {isLessonLoading || isStudentsLoading || !lesson ? (
        <ListSkeleton />
      ) : (
        <>
          <LessonTabs activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === "periods" && (
            <PeriodSection lesson={lesson} periods={lesson?.periods || []} />
          )}
          {activeTab === "students" && (
            <StudentSection students={students || []} />
          )}
          {activeTab === "settings" && <SettingSection lesson={lesson} />}
        </>
      )}
    </>
  );
};

export default LessonDetail;
