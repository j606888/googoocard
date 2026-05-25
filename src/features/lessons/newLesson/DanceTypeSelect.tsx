import Select from "react-select";
import { DanceType } from "@prisma/client";
import { DANCE_TYPE_STYLES } from "../danceTypeStyles";

const danceTypeOptions = [
  { label: "Bachata", value: DanceType.BACHATA.toString() },
  { label: "Salsa", value: DanceType.SALSA.toString() },
  { label: "Zouk", value: DanceType.ZOUK.toString() },
  { label: "Hustle", value: DanceType.HUSTLE.toString() },
];

const DANCE_LABELS: Record<string, string> = {
  BACHATA: "Bachata",
  SALSA: "Salsa",
  ZOUK: "Zouk",
  HUSTLE: "Hustle",
};

const DanceTypeSelect = ({
  danceType,
  onChange,
}: {
  danceType: DanceType;
  onChange: (value: DanceType) => void;
}) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="block font-medium mb-1">Dance Type</label>

      {/* Mobile: react-select dropdown */}
      <div className="lg:hidden">
        <Select
          value={danceTypeOptions.find((o) => o.value === danceType.toString())}
          options={danceTypeOptions}
          onChange={(option) => onChange(option?.value as DanceType)}
        />
      </div>

      {/* Desktop: 4-button radio group */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-2">
        {(Object.keys(DANCE_TYPE_STYLES) as DanceType[]).map((type) => {
          const style = DANCE_TYPE_STYLES[type];
          const selected = danceType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer
                ${selected
                  ? `${style.light} ${style.border} ${style.text}`
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
            >
              <span className={`w-3 h-3 rounded-full shrink-0 ${style.bg}`} />
              {DANCE_LABELS[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DanceTypeSelect;
