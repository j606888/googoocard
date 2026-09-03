import { DanceType } from "@prisma/client";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

export type CardTypeFilter = "all" | "general" | "practice";

const TYPE_CHIPS: { label: string; value: CardTypeFilter }[] = [
  { label: "全部", value: "all" },
  { label: "一般卡", value: "general" },
  { label: "複習卡", value: "practice" },
];

const DANCE_TYPE_ORDER = Object.keys(DANCE_TYPE_META) as DanceType[];

const chipClass = (active: boolean, activeStyle = "bg-neutral-800 text-white") =>
  `shrink-0 text-xs font-medium px-3 py-1 rounded-full transition-colors cursor-pointer ${
    active ? activeStyle : "bg-white text-neutral-500 hover:text-neutral-700"
  }`;

const CardFilters = ({
  typeFilter,
  setTypeFilter,
  danceFilter,
  setDanceFilter,
  availableDanceTypes,
  sortMenu,
}: {
  typeFilter: CardTypeFilter;
  setTypeFilter: (value: CardTypeFilter) => void;
  danceFilter: DanceType | null;
  setDanceFilter: (value: DanceType | null) => void;
  availableDanceTypes: DanceType[];
  /** 排序下拉；由列表傳進來，跟篩選共用同一條工具列。 */
  sortMenu?: React.ReactNode;
}) => {
  // Only offer dance types the classroom actually has cards for; hide the row
  // entirely when there's nothing meaningful to filter (0 or 1 dance type).
  const danceChips = DANCE_TYPE_ORDER.filter((t) => availableDanceTypes.includes(t));
  const showDanceFilter = danceChips.length > 1;

  return (
    <div className="flex flex-col gap-2.5 mb-4 p-3 bg-neutral-50 border border-neutral-100 rounded-lg">
      {/* Card-type chips + sort. 排序放不下時整顆換行，不必渲染兩份。 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="shrink-0 w-8 text-xs font-medium text-neutral-400">類型</span>
        <div className="flex items-center gap-2">
          {TYPE_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setTypeFilter(chip.value)}
              className={chipClass(typeFilter === chip.value)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {sortMenu && <div className="shrink-0 ml-auto">{sortMenu}</div>}
      </div>

      {/* Dance-type chips */}
      {showDanceFilter && (
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-8 text-xs font-medium text-neutral-400">舞種</span>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <button
              onClick={() => setDanceFilter(null)}
              className={chipClass(danceFilter === null)}
            >
              全部
            </button>
            {danceChips.map((type) => {
              const meta = DANCE_TYPE_META[type];
              const active = danceFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => setDanceFilter(active ? null : type)}
                  className={chipClass(active, meta.badge)}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CardFilters;
