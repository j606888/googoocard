import { formatDate } from "@/lib/utils";
import { StudentWithDetail } from "@/store/slices/students";
import { useState } from "react";
import { MdFlag } from "react-icons/md";
import { Frown, Smile } from "lucide-react";

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
        <div className="flex flex-col gap-2">
          {attendancesByLesson.map((lesson) => (
            <div
              key={lesson.lessonId}
            >
              <div className="font-medium mb-1">
                {lesson.lessonName}
              </div>
              <div className="flex gap-2 flex-wrap border-b border-[#e2e2e2] pb-3">
                {lesson.studentAttendances.map((attendance) => (
                  <div
                    key={attendance.periodStartTime}
                    className={`flex items-center gap-1 justify-center px-3 py-2 w-19 rounded-full ${
                      attendance.periodAttendantCheck
                        ? attendance.studentAttend
                          ? "bg-primary-500"
                          : "bg-gray-400"
                        : "border border-[#cccccc]"
                    }`}
                  >
                    {attendance.periodAttendantCheck &&
                      (attendance.studentAttend ? (
                        <Smile className="w-4 h-4 text-white" />
                      ) : (
                        <Frown className="w-4 h-4 text-white" />
                      ))}
                    <span className={`text-xs text-center ${attendance.periodAttendantCheck ? "text-white" : "text-gray-700"}`}>
                      {formatDate(attendance.periodStartTime, "MM/dd")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {attendancesByDate.map((attendances) => (
            <div
              key={attendances.date}
              className="rounded-sm bg-white shadow-sm overflow-hidden"
            >
              <div className="px-3 py-2 bg-primary-500 text-white font-medium">
                {formatDate(attendances.date)}
              </div>
              <div className="flex flex-col py-2">
                {attendances.attendances.map((attendance) => (
                  <div
                    key={attendance.lessonName}
                    className="flex items-center justify-between px-3 py-1"
                  >
                    <span className="text-sm">{attendance.lessonName}</span>
                    <div className="bg-primary-100 text-primary-700 px-2 py-1 rounded-sm text-sm flex items-center gap-1">
                      <span>
                        {attendance.periodNumber}/{attendance.totalPeriods}
                      </span>
                      {attendance.periodNumber === attendance.totalPeriods && (
                        <MdFlag className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttendSection;
