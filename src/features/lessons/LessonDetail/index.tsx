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
import LessonDetailHeader from "./LessonDetailHeader";
import AttendanceMatrix from "./AttendanceMatrix";

export const TABS = [
  { name: "Periods", query: "periods" },
  { name: "Students", query: "students" },
  { name: "Settings", query: "settings" },
];

const LessonDetail = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("periods");
  const [showSettings, setShowSettings] = useState(false);
  const { data: lesson, isLoading: isLessonLoading } = useGetLessonQuery(
    id as string
  );
  const { data: students, isLoading: isStudentsLoading } =
    useGetLessonStudentsQuery({ id: parseInt(id as string) });

  return (
    <>
      <SubNavbar
        title={lesson?.name || ""}
        backUrl="/lessons"
        withUnpaidBell
        className="lg:hidden"
      />
      {isLessonLoading || isStudentsLoading || !lesson ? (
        <ListSkeleton />
      ) : (
        <>
          {/* Mobile: tab-based layout */}
          <div className="lg:hidden">
            <LessonTabs activeTab={activeTab} onTabChange={setActiveTab} />
            {activeTab === "periods" && (
              <PeriodSection lesson={lesson} periods={lesson?.periods || []} />
            )}
            {activeTab === "students" && (
              <StudentSection students={students || []} />
            )}
            {activeTab === "settings" && <SettingSection lesson={lesson} />}
          </div>

          {/* Desktop: 2-panel layout (+ optional settings panel) */}
          <div className="hidden lg:flex lg:flex-col lg:min-h-[calc(100vh-0px)]">
            <LessonDetailHeader
              lesson={lesson}
              students={students || []}
              showSettings={showSettings}
              onToggleSettings={() => setShowSettings((v) => !v)}
            />
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Periods */}
              <div className="w-96 flex-shrink-0 border-r border-gray-200 overflow-y-auto py-4">
                <PeriodSection lesson={lesson} periods={lesson?.periods || []} />
              </div>
              {/* Center: Attendance matrix */}
              <div className="flex-1 overflow-auto p-6 bg-gray-50/30">
                <AttendanceMatrix
                  periods={lesson?.periods || []}
                  students={students || []}
                />
              </div>
              {/* Right: Settings (toggleable) */}
              {showSettings && (
                <div className="w-72 flex-shrink-0 border-l border-gray-200 overflow-y-auto py-4">
                  <SettingSection lesson={lesson} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default LessonDetail;
