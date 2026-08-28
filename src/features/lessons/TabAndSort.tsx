import { ArrowDownUp, Check, Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { DanceType } from "@prisma/client";
import { DANCE_TYPE_META } from "@/lib/danceTypes";

const TABS = [
  { label: "上課中", value: "inProgress" },
  { label: "已結束", value: "finished" },
];

const SORT_OPTIONS = [
  { label: "下次上課", value: "nextSession" },
  { label: "名稱", value: "name" },
  { label: "結束時間", value: "endAt" },
];

const DANCE_TYPE_ORDER = Object.keys(DANCE_TYPE_META) as DanceType[];

const TabAndSort = ({
  activeTab,
  setActiveTab,
  sort,
  setSort,
  tabsCount,
  search,
  setSearch,
  danceType,
  setDanceType,
  availableDanceTypes,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sort: string;
  setSort: (sort: string) => void;
  tabsCount: { inProgress: number; finished: number } | undefined;
  search: string;
  setSearch: (search: string) => void;
  danceType: DanceType | null;
  setDanceType: (danceType: DanceType | null) => void;
  availableDanceTypes: DanceType[];
}) => {
  const [open, setOpen] = useState(false);

  // Only offer dance types this classroom actually teaches; hide the whole row
  // when there's nothing meaningful to filter by (0 or 1 dance type).
  const danceChips = DANCE_TYPE_ORDER.filter((t) => availableDanceTypes.includes(t));
  const showDanceFilter = danceChips.length > 1;

  const handleSort = (value: string) => {
    setSort(value);
    setTimeout(() => setOpen(false), 300);
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋課程或老師"
          className="w-full rounded-full border border-neutral-200 bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            aria-label="清除搜尋"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dance-type filter chips */}
      {showDanceFilter && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
          <button
            onClick={() => setDanceType(null)}
            className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              danceType === null
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-neutral-500 hover:text-neutral-700"
            }`}
          >
            全部
          </button>
          {danceChips.map((type) => {
            const meta = DANCE_TYPE_META[type];
            const active = danceType === type;
            return (
              <button
                key={type}
                onClick={() => setDanceType(active ? null : type)}
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

      {/* Tabs + Sort */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              className={`flex items-center justify-center px-3.5 py-1.5 gap-1 text-sm rounded-full cursor-pointer transition-colors ${
                activeTab === tab.value
                  ? "bg-white text-primary-700 font-semibold shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
              onClick={() => setActiveTab(tab.value)}
            >
              <span>{tab.label}</span>
              <span className={activeTab === tab.value ? "text-primary-400" : "text-neutral-400"}>
                {tabsCount?.[tab.value as keyof typeof tabsCount] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <div
              className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 cursor-pointer px-2 py-1.5"
              onClick={() => setOpen(!open)}
            >
              <ArrowDownUp className="w-4 h-4" />
              <span className="text-sm">排序</span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-44">
            <div className="flex flex-col gap-3">
              <div className="text-xs text-neutral-500 font-medium">排序依據</div>
              <div className="flex flex-col gap-1">
                {SORT_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center justify-between gap-2 text-sm cursor-pointer"
                    onClick={() => handleSort(option.value)}
                  >
                    <span
                      className={
                        sort === option.value ? "text-primary-500" : "text-neutral-500"
                      }
                    >
                      {option.label}
                    </span>
                    {sort === option.value && (
                      <Check className="w-4 h-4 text-primary-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default TabAndSort;
