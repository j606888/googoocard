import { DanceType } from "@prisma/client";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

export type CardTypeFilter = "all" | "general" | "practice";

const TYPE_CHIPS: { label: string; value: CardTypeFilter }[] = [
  { label: "全部", value: "all" },
  { label: "一般", value: "general" },
  { label: "複習", value: "practice" },
];

const DANCE_TYPE_ORDER = Object.keys(DANCE_TYPE_META) as DanceType[];

const CardFilters = ({
  typeFilter,
  setTypeFilter,
  danceFilter,
  setDanceFilter,
  availableDanceTypes,
}: {
  typeFilter: CardTypeFilter;
  setTypeFilter: (value: CardTypeFilter) => void;
  danceFilter: DanceType | null;
  setDanceFilter: (value: DanceType | null) => void;
  availableDanceTypes: DanceType[];
}) => {
  // Only offer dance types the classroom actually has cards for; hide the row
  // entirely when there's nothing meaningful to filter (0 or 1 dance type).
  const danceChips = DANCE_TYPE_ORDER.filter((t) => availableDanceTypes.includes(t));
  const showDanceFilter = danceChips.length > 1;

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Card-type chips */}
      <div className="flex items-center gap-2">
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setTypeFilter(chip.value)}
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              typeFilter === chip.value
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Dance-type chips */}
      {showDanceFilter && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
          <button
            onClick={() => setDanceFilter(null)}
            className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              danceFilter === null
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-neutral-500 hover:text-neutral-700"
            }`}
          >
            All
          </button>
          {danceChips.map((type) => {
            const meta = DANCE_TYPE_META[type];
            const active = danceFilter === type;
            return (
              <button
                key={type}
                onClick={() => setDanceFilter(active ? null : type)}
                className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                  active ? meta.badge : "bg-neutral-100 text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CardFilters;
