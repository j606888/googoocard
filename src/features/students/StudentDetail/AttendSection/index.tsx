import { StudentWithDetail } from "@/store/slices/students";
import { useState } from "react";
import AttendanceByLesson from "./AttendanceByLesson";
import AttendanceByDate from "./AttendanceByDate";

const TABS = [
  {
    label: "Group by Lesson",
    value: "group_by_lesson",
  },
  {
    label: "Group by Date",
    value: "group_by_date",
  },
];

const AttendSection = ({ student }: { student: StudentWithDetail }) => {
  const { attendancesByLesson, attendancesByDate } = student;
  const [activeTab, setActiveTab] = useState(TABS[0].value);

  if (attendancesByLesson.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="w-full p-6 bg-primary-50 text-primary-700 text-center rounded-2xl text-sm">
          No class attend yet Q_Q
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex bg-gray-100 p-1 rounded-xl">
        {TABS.map((tab) => (
          <div
            key={tab.value}
            className={`w-full text-center px-2 py-1.5 text-sm font-medium cursor-pointer transition-colors rounded-lg ${
              activeTab === tab.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
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
