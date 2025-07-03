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
  const { data: lesson } = useGetLessonQuery(id as string);
  const { data: students } = useGetLessonStudentsQuery({
    id: parseInt(id as string),
  });

  if (!lesson) return <div>Loading...</div>;

  return (
    <>
      <SubNavbar title={lesson?.name || ""} backUrl={`/lessons`} />
      <LessonTabs activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "periods" && (
        <PeriodSection lesson={lesson} periods={lesson?.periods || []} />
      )}
      {activeTab === "students" && <StudentSection students={students || []} />}
      {activeTab === "settings" && <SettingSection lesson={lesson} />}
    </>
  );
};

export default LessonDetail;
