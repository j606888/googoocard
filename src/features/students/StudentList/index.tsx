"use client";

import NewStudent from "./NewStudent";
import { useGetStudentsQuery, useGetTagsQuery } from "@/store/slices/students";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import SingleStudent from "./SingleStudent";
import Searchbar from "./Searchbar";
import FilterDrawer from "./FilterDrawer";
import { useState, useMemo, useEffect } from "react";
import { Users, SlidersHorizontal, X } from "lucide-react";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { DanceType } from "@prisma/client";
import { ALL_DANCE_TYPES, danceTypeLabel } from "@/lib/danceTypes";
import {
  StudentFilters,
  StudentSort,
  EMPTY_FILTERS,
  applyStudentFilters,
  countActiveFilters,
  loadStudentFilters,
  saveStudentFilters,
  loadStudentSort,
  saveStudentSort,
  tagLabel,
} from "./studentFilters";

const StudentList = () => {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<StudentSort>("name");
  const [hydratedClassroomId, setHydratedClassroomId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: allStudents = [], isLoading } = useGetStudentsQuery({ query, sort });
  const { data: lessonsData } = useGetLessonsQuery({ tab: "inProgress", sort: "createdAt" });
  const { data: tags = [] } = useGetTagsQuery();
  const { data: classroomData } = useGetClassroomsQuery();
  const classroomId = classroomData?.currentClassroomId;

  const inProgressLessons = lessonsData?.lessons ?? [];

  // 學生資格中實際存在的舞種，動態決定「過課」可選項
  const availableQualifications = useMemo(
    () => ALL_DANCE_TYPES.filter((type) => allStudents.some((s) => s.danceQualifications?.includes(type))),
    [allStudents]
  );

  // 載入：教室就緒（或切換）後從 localStorage 還原（mount 先 EMPTY，避免 hydration mismatch）
  useEffect(() => {
    if (classroomId == null) return;
    setFilters(loadStudentFilters(classroomId));
    setSort(loadStudentSort(classroomId));
    setHydratedClassroomId(classroomId);
  }, [classroomId]);

  // 儲存：僅在「已還原當前教室」後才持久化，避免還原/切換當下用舊值覆寫
  useEffect(() => {
    if (classroomId == null || hydratedClassroomId !== classroomId) return;
    saveStudentFilters(classroomId, filters);
  }, [classroomId, hydratedClassroomId, filters]);

  useEffect(() => {
    if (classroomId == null || hydratedClassroomId !== classroomId) return;
    saveStudentSort(classroomId, sort);
  }, [classroomId, hydratedClassroomId, sort]);

  const students = useMemo(
    () => applyStudentFilters(allStudents, filters),
    [allStudents, filters]
  );

  if (isLoading) return <ListSkeleton />;

  const activeCount = countActiveFilters(filters);

  const lessonName = (id: number) => inProgressLessons.find((l) => l.id === id)?.name;

  // 已選條件 pill（可單獨移除）
  const activePills: { key: string; label: string; onRemove: () => void }[] = [
    ...(filters.inActiveLesson
      ? [{ key: "status", label: "上課中", onRemove: () => setFilters((f) => ({ ...f, inActiveLesson: false })) }]
      : []),
    ...filters.tags.map((name) => ({
      key: `tag:${name}`,
      label: tagLabel(name),
      onRemove: () => setFilters((f) => ({ ...f, tags: f.tags.filter((t) => t !== name) })),
    })),
    ...filters.qualifications.map((type) => ({
      key: `qual:${type}`,
      label: `${danceTypeLabel(type as DanceType)} Lv1`,
      onRemove: () =>
        setFilters((f) => ({ ...f, qualifications: f.qualifications.filter((q) => q !== type) })),
    })),
    ...filters.lessonIds
      .filter((id) => lessonName(id))
      .map((id) => ({
        key: `lesson:${id}`,
        label: lessonName(id) as string,
        onRemove: () => setFilters((f) => ({ ...f, lessonIds: f.lessonIds.filter((l) => l !== id) })),
      })),
  ];

  return (
    <div className="px-5 py-3 lg:px-8 lg:py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Students</h2>
        <NewStudent />
      </div>

      <div className="flex flex-wrap items-start gap-2 mb-3">
        <div className="flex-1 min-w-40">
          <Searchbar onSearch={setQuery} />
        </div>
        <div className="flex items-center rounded-xl border border-neutral-200 p-0.5 text-sm">
          {(["name", "number"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              className={`px-2.5 py-2 rounded-[10px] transition-colors cursor-pointer ${
                sort === option
                  ? "bg-primary-500 text-white"
                  : "text-neutral-600 hover:text-primary-600"
              }`}
            >
              {option === "name" ? "姓名" : "編號"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
            activeCount > 0
              ? "bg-primary-50 border-primary-400 text-primary-700"
              : "bg-white border-neutral-200 text-neutral-700 hover:border-primary-300"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          篩選
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary-500 text-white text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* 已選條件 pills */}
      {activePills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={pill.onRemove}
              className="flex items-center gap-1 pl-3 pr-2 py-1 rounded-full text-sm bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors cursor-pointer"
            >
              {pill.label}
              <X className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      )}

      {students.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 gap-3 bg-primary-50 rounded-2xl">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">No students yet</p>
            <p className="text-sm text-neutral-500 text-center">
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

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onChange={setFilters}
        tags={tags}
        lessons={inProgressLessons}
        availableQualifications={availableQualifications}
        resultCount={students.length}
      />
    </div>
  );
};

export default StudentList;
