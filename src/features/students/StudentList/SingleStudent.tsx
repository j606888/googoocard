"use client";

import { Student } from "@/store/slices/students";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import DanceBadge from "./DanceBadge";

const tagStyle = (name: string) =>
  name === "Needs Renewal"
    ? "text-danger-700 bg-danger-100"
    : "text-neutral-600 bg-neutral-100";

/**
 * 手機版列表的一列。桌面版走分割檢視（見 StudentsSplitView / RosterRow），
 * 不再共用這個元件。
 */
const SingleStudent = ({ student }: { student: Student }) => {
  const router = useRouter();
  const studentCards = student.studentCards;
  const firstTag = student.tags?.[0];

  return (
    <div
      className="cursor-pointer"
      onClick={() => router.push(`/students/${student.id}`)}
    >
      <div className="flex items-center gap-3 py-2 px-1 border-b border-neutral-100 hover:bg-neutral-50">
        <img
          src={student.avatarUrl}
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="flex flex-1 items-center justify-between min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-neutral-400 shrink-0">#{student.number}</span>
              <h2 className="font-medium">{student.name}</h2>
              {student.note && (
                <p className="text-sm text-neutral-500">({student.note})</p>
              )}
              {firstTag && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tagStyle(firstTag.name)}`}>
                  {firstTag.name}
                </span>
              )}
            </div>
            <p className="flex gap-1 items-center text-sm text-neutral-400">
              <CreditCard className="w-4 h-4" />
              {studentCards.length}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mr-1">
            {student.danceQualifications?.map((type) => (
              <DanceBadge key={type} type={type} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleStudent;
