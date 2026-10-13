import { StudentWithDetail } from "@/store/slices/students";
import { useState } from "react";
import SegmentedTabs, { type SegmentedOption } from "@/components/SegmentedTabs";
import AttendanceByLesson from "./AttendanceByLesson";
import AttendanceByDate from "./AttendanceByDate";

type AttendView = "group_by_lesson" | "group_by_date";

const TABS: SegmentedOption<AttendView>[] = [
  { label: "依課程", value: "group_by_lesson" },
  { label: "依日期", value: "group_by_date" },
];

const AttendSection = ({ student }: { student: StudentWithDetail }) => {
  const { attendancesByLesson, attendancesByDate } = student;
  const [activeTab, setActiveTab] = useState<AttendView>(TABS[0].value);

  if (attendancesByLesson.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="w-full p-6 bg-primary-50 text-primary-700 text-center rounded-2xl text-sm">
          還沒有上課紀錄 Q_Q
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SegmentedTabs
        ariaLabel="出席紀錄的顯示方式"
        options={TABS}
        value={activeTab}
        onChange={setActiveTab}
        fill
      />
      {activeTab === "group_by_lesson" ? (
        <AttendanceByLesson attendancesByLesson={attendancesByLesson} />
      ) : (
        <AttendanceByDate attendancesByDate={attendancesByDate} />        
      )}
    </div>
  );
};

export default AttendSection;
