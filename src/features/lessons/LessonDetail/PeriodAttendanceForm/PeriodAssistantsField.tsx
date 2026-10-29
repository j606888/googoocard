import { useState } from "react";
import MultiSelect from "@/components/MultiSelect";
import { FieldLabel } from "@/components/Field";
import TeacherForm from "@/features/teachers/TeacherForm";
import { canAssist } from "@/lib/teachers";
import { useGetTeachersQuery } from "@/store/slices/teachers";

/**
 * 「今天的助教」：這堂誰來幫忙。這堂的授課老師、只教課的老師不列出；只當助教的排前面；
 * 封存的老師不能新選，已經掛著的照樣顯示。
 */
const PeriodAssistantsField = ({
  value,
  onChange,
  lessonTeacherIds,
}: {
  value: number[];
  onChange: (teacherIds: number[]) => void;
  lessonTeacherIds: number[];
}) => {
  const { data: teachers } = useGetTeachersQuery();
  const [formKey, setFormKey] = useState<number | null>(null);

  const options = (teachers ?? [])
    .filter(
      (teacher) =>
        !lessonTeacherIds.includes(teacher.id) &&
        ((!teacher.archivedAt && canAssist(teacher.kind)) || value.includes(teacher.id))
    )
    .sort((a, b) => Number(b.kind === "ASSISTANT") - Number(a.kind === "ASSISTANT"))
    .map((teacher) => ({ label: teacher.name, value: teacher.id }));

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel hint="（選填）">今天的助教</FieldLabel>
      <MultiSelect
        options={options}
        values={value}
        placeholder="沒有助教"
        newOptionLabel="新增助教"
        newOptionOnClick={() => setFormKey(Date.now())}
        onChange={(values) => onChange(values as number[])}
      />
      {formKey !== null && (
        <TeacherForm
          key={formKey}
          open
          defaultKind="ASSISTANT"
          onClose={() => setFormKey(null)}
          onCreated={(teacher) => onChange([...value, teacher.id])}
        />
      )}
    </div>
  );
};

export default PeriodAssistantsField;
