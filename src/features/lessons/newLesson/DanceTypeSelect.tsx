// import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import Select from "react-select"
import { DanceType } from "@prisma/client";

const danceTypeOptions = [
  { label: "Bachata", value: DanceType.BACHATA.toString() },
  { label: "Salsa", value: DanceType.SALSA.toString() },
];

const DanceTypeSelect = ({ danceType, onChange }: { danceType: DanceType, onChange: (value: DanceType) => void }) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="block font-medium mb-1">Dance Type</label>
      <Select
        value={danceTypeOptions.find((option) => option.value === danceType.toString())}
        options={danceTypeOptions}
        onChange={(option) => onChange(option?.value as DanceType)}
      />
    </div>
  );
};

export default DanceTypeSelect;