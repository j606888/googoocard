import Image from "next/image";
import { X } from "lucide-react";
import { Student } from "@/store/slices/students";
import { Button } from "@/components/ui/button";

/**
 * 送出前對一次：這門課還有誰沒勾（可補勾）、勾了誰（可取消）、其中誰不是這門課的學生。
 * 手機放在「已勾 N 人」打開的抽屜裡，桌面直接放在右欄。
 */
const AttendanceReview = ({
  selectedStudents,
  missingRosterStudents,
  rosterIds,
  onAdd,
  onRemove,
}: {
  selectedStudents: Student[];
  /** 這門課名冊上、還沒勾的學生。 */
  missingRosterStudents: Student[];
  rosterIds: number[];
  onAdd: (studentId: number) => void;
  onRemove: (studentId: number) => void;
}) => {
  const roster = new Set(rosterIds);
  const outsiders = selectedStudents.filter((student) => !roster.has(student.id));
  // 這門課的學生在前、名冊外的在後，跟名單同一個順序。
  const present = [
    ...selectedStudents.filter((student) => roster.has(student.id)),
    ...outsiders,
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* 一個都還沒勾時，「誰沒勾」就是整份名單——不用再列一次。 */}
      {missingRosterStudents.length > 0 && selectedStudents.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-warning-200 bg-warning-50 px-3.5 py-3">
          <h3 className="text-sm font-bold text-warning-950">
            這門課還有 {missingRosterStudents.length} 人沒勾
          </h3>
          {missingRosterStudents.map((student) => (
            <div key={student.id} className="flex items-center gap-2.5">
              <Image
                className="rounded-full object-cover shrink-0"
                width={30}
                height={30}
                src={student.avatarUrl}
                alt=""
              />
              <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-neutral-900">
                {student.name}
              </span>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`補勾 ${student.name}`}
                onClick={() => onAdd(student.id)}
              >
                補勾
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold tracking-wider text-neutral-500">
          出席 · {selectedStudents.length}
        </h3>
        {selectedStudents.length === 0 ? (
          <p className="text-sm text-neutral-500">還沒有勾任何人</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {present.map((student) => (
              <div
                key={student.id}
                className="flex h-11 min-w-0 items-center gap-2 rounded-xl bg-primary-50 pl-2.5 pr-1"
              >
                <Image
                  className="rounded-full object-cover shrink-0"
                  width={24}
                  height={24}
                  src={student.avatarUrl}
                  alt=""
                />
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-neutral-900">
                  {student.name}
                </span>
                <Button
                  variant="ghost"
                  size="iconSm"
                  className="text-neutral-500"
                  aria-label={`取消勾選 ${student.name}`}
                  onClick={() => onRemove(student.id)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {outsiders.length > 0 && rosterIds.length > 0 && (
          <p className="text-xs text-neutral-500">
            其中 {outsiders.length} 位不是這門課的學生：
            {outsiders.map((student) => student.name).join("、")}
          </p>
        )}
      </section>
    </div>
  );
};

export default AttendanceReview;
