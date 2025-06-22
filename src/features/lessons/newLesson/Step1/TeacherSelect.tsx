import { useState } from "react";
import Drawer from "@/components/Drawer";
import { useCreateTeacherMutation } from "@/store/slices/teachers";
import MultiSelect from "@/components/MultiSelect";
import { useGetTeachersQuery } from "@/store/slices/teachers";

const TeacherSelect = ({ selectedTeacherIds, onChange, error }: { selectedTeacherIds: number[], onChange: (value: number[]) => void, error?: string }) => {
  const { data: teachers } = useGetTeachersQuery();
  const [newTeacherModalOpen, setNewTeacherModalOpen] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [createTeacher, { isLoading }] = useCreateTeacherMutation();

  const teacherOptions = teachers?.map((teacher) => ({
    label: teacher.name,
    value: teacher.id,
  })) || [];

  const handleCreateTeacher = async () => {
    const teacher = await createTeacher({ name: newTeacherName, classroomId: 1 });

    if (teacher.data) {
      onChange([...selectedTeacherIds, teacher.data.id]);
    }
    setNewTeacherModalOpen(false);
    setNewTeacherName("");
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="block font-medium mb-1">Teachers</label>
      <MultiSelect
        options={teacherOptions}
        values={selectedTeacherIds}
        newOptionLabel="New teacher"
        placeholder="Select teachers"
        newOptionOnClick={() => {
          setNewTeacherModalOpen(true);
        }}
        onChange={(values) => {
          onChange(values as number[]);
        }}
        error={error}
      />
       <Drawer
        title="Create Teacher"
        open={newTeacherModalOpen}
        onClose={() => setNewTeacherModalOpen(false)}
        onSubmit={handleCreateTeacher}
        isLoading={isLoading}
      >
        <form>
          <label className="block mb-2 font-medium">Name</label>
          <input
            className="w-full mb-4 p-2 rounded bg-gray-100 focus:outline-primary-500"
            placeholder="Enter name"
            value={newTeacherName}
            onChange={(e) => setNewTeacherName(e.target.value)}
          />
        </form>
      </Drawer>
    </div>
  );
};

export default TeacherSelect;
