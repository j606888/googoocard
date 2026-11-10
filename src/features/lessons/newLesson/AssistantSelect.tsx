import MultiSelect from "@/components/MultiSelect";
import { FieldLabel } from "@/components/Field";
import { assistantsFirst } from "@/lib/teachers";
import { useGetTeachersQuery } from "@/store/slices/teachers";

/**
 * 課程小幫手（整門課，可以好幾位，選填）。從教室的老師資料挑——會當助教的排前面；
 * 已經是這門課老師的人不列出（同一個人不能兩邊都是）。封存的不給新選，已掛著的照樣顯示。
 */
const AssistantSelect = ({
  selectedAssistantIds,
  teacherIds,
  onChange,
}: {
  selectedAssistantIds: number[];
  /** 這門課的老師——不能再選成小幫手。 */
  teacherIds: number[];
  onChange: (value: number[]) => void;
}) => {
  const { data: teachers } = useGetTeachersQuery();

  const options = assistantsFirst(teachers ?? [])
    .filter(
      (teacher) =>
        !teacherIds.includes(teacher.id) &&
        (!teacher.archivedAt || selectedAssistantIds.includes(teacher.id))
    )
    .map((teacher) => ({ label: teacher.name, value: teacher.id }));

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>小幫手</FieldLabel>
      <MultiSelect
        options={options}
        values={selectedAssistantIds}
        placeholder="選擇小幫手（選填）"
        onChange={(values) => onChange(values as number[])}
      />
    </div>
  );
};

export default AssistantSelect;
