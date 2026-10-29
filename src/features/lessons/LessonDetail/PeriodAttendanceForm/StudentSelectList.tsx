import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Student } from "@/store/slices/students";
import type { RowTag } from "@/hooks/attendanceFlow";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import StudentOption from "./StudentOption";

/**
 * 點名名單：先「這門課的學生」，再收合的「其他學生」。
 * 搜尋時「其他學生」自動展開（只列符合的）；這門課還沒有名冊時直接展開。
 */
const StudentSelectList = ({
  rosterStudents,
  otherStudents,
  selectedIds,
  keyword,
  rowTags,
  selfCheckInStudentIds = [],
  trialStudentIds = [],
  onToggle,
  onSetMany,
  onCreateClick,
}: {
  rosterStudents: Student[];
  otherStudents: Student[];
  selectedIds: number[];
  keyword: string;
  rowTags: Map<number, RowTag>;
  selfCheckInStudentIds?: number[];
  trialStudentIds?: number[];
  onToggle: (studentId: number) => void;
  onSetMany: (studentIds: number[], checked: boolean) => void;
  onCreateClick: () => void;
}) => {
  const [othersOpen, setOthersOpen] = useState(false);
  const isSearching = keyword.trim().length > 0;
  const selected = new Set(selectedIds);

  if (isSearching && rosterStudents.length === 0 && otherStudents.length === 0) {
    const name = keyword.trim();
    return (
      <EmptyState
        kind="filtered"
        title={`沒有「${name}」`}
        action={
          <Button variant="secondary" size="sm" onClick={onCreateClick}>
            新增「{name}」為學生
          </Button>
        }
      />
    );
  }

  const renderRow = (student: Student, inRoster: boolean) => {
    const isChecked = selected.has(student.id);
    return (
      <StudentOption
        key={student.id}
        student={student}
        isChecked={isChecked}
        onClick={() => onToggle(student.id)}
        isFirstTime={!inRoster && isChecked}
        isSelfCheckIn={selfCheckInStudentIds.includes(student.id)}
        isTrial={trialStudentIds.includes(student.id)}
        // 名冊外的人多半沒有這堂課能用的卡，整串「沒卡」只是雜訊——勾了才標。
        tag={inRoster || isChecked ? rowTags.get(student.id) : undefined}
      />
    );
  };

  const allRosterChecked =
    rosterStudents.length > 0 && rosterStudents.every((student) => selected.has(student.id));
  const showRoster = rosterStudents.length > 0;
  // 這門課還沒有人（第一堂）時，「其他學生」就是全部，不用再按一下才看得到。
  const othersExpanded = isSearching || !showRoster || othersOpen;

  return (
    <div className="flex flex-col gap-1.5">
      {showRoster && (
        <>
          <div className="flex h-9 items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-700">
              這門課的學生
              <span className="font-medium text-neutral-500"> · {rosterStudents.length}</span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 text-primary-900 font-bold"
              onClick={() =>
                onSetMany(
                  rosterStudents.map((student) => student.id),
                  !allRosterChecked
                )
              }
            >
              {allRosterChecked ? "全不選" : "全選"}
            </Button>
          </div>
          {rosterStudents.map((student) => renderRow(student, true))}
        </>
      )}

      {otherStudents.length > 0 &&
        (showRoster || isSearching ? (
          <button
            type="button"
            aria-expanded={othersExpanded}
            disabled={isSearching}
            onClick={() => setOthersOpen((open) => !open)}
            className={cn(
              "flex h-12 items-center gap-1.5 px-1 text-sm text-neutral-600",
              showRoster && "mt-1 border-t border-neutral-200",
              isSearching ? "cursor-default" : "cursor-pointer"
            )}
          >
            其他學生
            <span className="text-neutral-500">{otherStudents.length}</span>
            {!isSearching && (
              <ChevronRight
                aria-hidden="true"
                className={cn("size-4 transition-transform", othersExpanded && "rotate-90")}
              />
            )}
          </button>
        ) : (
          <h2 className="flex h-9 items-center text-sm font-bold text-neutral-700">
            學生
            <span className="font-medium text-neutral-500"> · {otherStudents.length}</span>
          </h2>
        ))}
      {othersExpanded && otherStudents.map((student) => renderRow(student, false))}
    </div>
  );
};

export default StudentSelectList;
