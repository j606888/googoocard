"use client";

import {
  useGetTeachersQuery,
  useCreateTeacherMutation,
} from "@/store/slices/teachers";
import { GraduationCap, Plus } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import TeacherCard from "@/features/teachers/TeacherCard";
import ListSkeleton from "@/components/skeletons/ListSkeleton";

const TeacherList = () => {
  const { data: teachers, isLoading } = useGetTeachersQuery();
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherModalOpen, setNewTeacherModalOpen] = useState(false);
  const [createTeacher] = useCreateTeacherMutation();

  const handleCreateTeacher = async () => {
    await createTeacher({ name: newTeacherName, classroomId: 1 }).unwrap();
    setNewTeacherModalOpen(false);
    setNewTeacherName("");
  };

  if (isLoading) return <ListSkeleton />;

  return (
    <>
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-semibold">Teachers</h2>
          <button className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span
              className="font-medium"
              onClick={() => setNewTeacherModalOpen(true)}
            >
              New Teacher
            </span>
          </button>
        </div>
        {teachers?.length === 0 && (
          <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm ">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-lg font-bold">No teachers found</p>
              <p className="text-sm text-gray-500 text-center">
                We can&apos;t have a lesson without teacher, right?
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {teachers?.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </div>
      </div>
      <Drawer
        title="Create Teacher"
        open={newTeacherModalOpen}
        onClose={() => setNewTeacherModalOpen(false)}
        onSubmit={handleCreateTeacher}
      >
        <form>
          <label className="block mb-2 font-medium">Name</label>
          <input
            className="w-full mb-4 p-2 rounded bg-gray-100"
            placeholder="Enter name"
            value={newTeacherName}
            onChange={(e) => setNewTeacherName(e.target.value)}
          />
        </form>
      </Drawer>
    </>
  );
};

export default TeacherList;
