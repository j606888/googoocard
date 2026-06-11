"use client";

import NewStudent from "./NewStudent";
import { useGetStudentsQuery } from "@/store/slices/students";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import SingleStudent from "./SingleStudent";
import Searchbar from "./Searchbar";
import { useState, useMemo } from "react";
import { Users } from "lucide-react";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { DanceType } from "@prisma/client";
import { ALL_DANCE_TYPES, danceTypeLabel } from "@/lib/danceTypes";

type FilterChip = "all" | "needsRenewal" | "inActiveLesson" | "byLesson" | `qual:${DanceType}`;

const StudentList = () => {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterChip>("all");
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  const { data: allStudents = [], isLoading } = useGetStudentsQuery({ query });
  const { data: lessonsData } = useGetLessonsQuery({ tab: "inProgress", sort: "createdAt" });
  const inProgressLessons = lessonsData?.lessons ?? [];

  const students = useMemo(() => {
    if (activeFilter === "needsRenewal") return allStudents.filter((s) => s.tags?.some((t) => t.name === "Needs Renewal"));
    if (activeFilter.startsWith("qual:")) {
      const danceType = activeFilter.slice("qual:".length) as DanceType;
      return allStudents.filter((s) => s.danceQualifications?.includes(danceType));
    }
    if (activeFilter === "inActiveLesson") return allStudents.filter((s) => s.isInActiveLesson);
    if (activeFilter === "byLesson" && selectedLessonId)
      return allStudents.filter((s) => s.activeLessonIds.includes(selectedLessonId));
    return allStudents;
  }, [allStudents, activeFilter, selectedLessonId]);

  if (isLoading) return <ListSkeleton />;

  const handleChipClick = (chip: FilterChip) => {
    setActiveFilter(chip);
    if (chip !== "byLesson") setSelectedLessonId(null);
  };

  const qualificationChips = ALL_DANCE_TYPES.filter((type) =>
    allStudents.some((s) => s.danceQualifications?.includes(type))
  ).map((type) => ({
    key: `qual:${type}` as FilterChip,
    label: `${danceTypeLabel(type)} Lv1`,
  }));

  const chips: { key: FilterChip; label: string; disabled?: boolean }[] = [
    { key: "all", label: "全部" },
    { key: "needsRenewal", label: "需續約" },
    ...qualificationChips,
    { key: "inActiveLesson", label: "上課中" },
    { key: "byLesson", label: "依課程", disabled: inProgressLessons.length === 0 },
  ];

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Students</h2>
        <NewStudent />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {chips.map(({ key, label, disabled }) => (
          <button
            key={key}
            disabled={disabled}
            className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeFilter === key
                ? "bg-primary-500 border-primary-500 text-white shadow-sm"
                : "bg-white border-gray-300 text-gray-700 hover:border-primary-300"
            }`}
            onClick={() => handleChipClick(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lesson sub-chips */}
      {activeFilter === "byLesson" && inProgressLessons.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 pl-1">
          {inProgressLessons.map((lesson) => (
            <button
              key={lesson.id}
              className={`px-3 py-1 rounded-full text-xs border transition-colors cursor-pointer ${
                selectedLessonId === lesson.id
                  ? "bg-primary-100 border-primary-400 text-primary-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-primary-300"
              }`}
              onClick={() =>
                setSelectedLessonId(selectedLessonId === lesson.id ? null : lesson.id)
              }
            >
              {lesson.name}
            </button>
          ))}
        </div>
      )}

      <Searchbar onSearch={setQuery} />

      {students.length === 0 && (
        <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">No students yet</p>
            <p className="text-sm text-gray-500 text-center">
              Create student so they can start lesson
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3">
        {students.map((student) => (
          <SingleStudent key={student.id} student={student} />
        ))}
      </div>
    </div>
  );
};

export default StudentList;
