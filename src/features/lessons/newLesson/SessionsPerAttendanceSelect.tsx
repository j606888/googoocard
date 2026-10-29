import { SESSIONS_PER_ATTENDANCE_OPTIONS } from "@/lib/lessonKind";
import { FieldLabel } from "@/components/Field";

// 每次出席扣幾格課卡（Lesson.sessionsPerAttendance）。預設 1 格；外師課常用 2 格。
const SessionsPerAttendanceSelect = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>每次上課扣幾格</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {SESSIONS_PER_ATTENDANCE_OPTIONS.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`h-11 px-3 rounded-xl border-[1.5px] text-sm font-medium transition-colors cursor-pointer
                ${selected
                  ? "bg-primary-100 border-primary-700 text-primary-900 font-semibold"
                  : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-300"
                }`}
            >
              {option} 格
            </button>
          );
        })}
      </div>
      {value > 1 && (
        <p className="text-xs text-neutral-500">剩不到 {value} 格的卡不能用，學生要買新卡</p>
      )}
    </div>
  );
};

export default SessionsPerAttendanceSelect;
