import { StudentWithDetail } from "@/store/slices/students";
import { useState } from "react";
import AttendanceByLesson from "./AttendanceByLesson";
import AttendanceByDate from "./AttendanceByDate";

const TABS = [
  {
    label: "Group by Date",
    value: "group_by_date",
  },
  {
    label: "Group by Lesson",
    value: "group_by_lesson",
  },
];

const AttendSection = ({ student }: { student: StudentWithDetail }) => {
  const { attendancesByLesson, attendancesByDate } = student;
  const [activeTab, setActiveTab] = useState(TABS[0].value);

  if (attendancesByLesson.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="w-full p-5 bg-primary-50 text-center rounded-sm font-light">
          No class attend yet Q_Q
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex bg-[#F4F4F5] p-1 rounded-sm">
        {TABS.map((tab) => (
          <div
            key={tab.value}
            className={`w-full text-center px-2 py-1 text-[#777777] text-sm font-medium ${
              activeTab === tab.value ? "bg-white text-black rounded-sm" : ""
            }`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </div>
        ))}
      </div>
      {activeTab === "group_by_lesson" ? (
        <AttendanceByLesson attendancesByLesson={attendancesByLesson} />
      ) : (
        <AttendanceByDate attendancesByDate={attendancesByDate} />        
      )}
    </div>
  );
};

export default AttendSection;
