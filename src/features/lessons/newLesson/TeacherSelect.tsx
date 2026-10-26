import { useState } from "react";
import MultiSelect from "@/components/MultiSelect";
import { FieldLabel } from "@/components/Field";
import TeacherForm from "@/features/teachers/TeacherForm";
import { useGetTeachersQuery } from "@/store/slices/teachers";

const TeacherSelect = ({ selectedTeacherIds, onChange, error }: { selectedTeacherIds: number[], onChange: (value: number[]) => void, error?: string }) => {
  const { data: teachers } = useGetTeachersQuery();
  const [formKey, setFormKey] = useState<number | null>(null);

  // Archived teachers aren't offered for new picks, but a lesson that already
  // has one keeps showing them.
  const teacherOptions = teachers
    ?.filter((teacher) => !teacher.archivedAt || selectedTeacherIds.includes(teacher.id))
    .map((teacher) => ({
      label: teacher.name,
      value: teacher.id,
    })) || [];

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>老師</FieldLabel>
      <MultiSelect
        options={teacherOptions}
        values={selectedTeacherIds}
        newOptionLabel="新增老師"
        placeholder="選擇老師"
        newOptionOnClick={() => {
          setFormKey(Date.now());
        }}
        onChange={(values) => {
          onChange(values as number[]);
        }}
        error={error}
      />
      {formKey !== null && (
        <TeacherForm
          key={formKey}
          open
          onClose={() => setFormKey(null)}
          onCreated={(teacher) => onChange([...selectedTeacherIds, teacher.id])}
        />
      )}
    </div>
  );
};

export default TeacherSelect;
