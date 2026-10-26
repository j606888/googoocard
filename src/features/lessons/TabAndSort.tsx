import { ArrowDownUp, Check, MapPin, Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { useLocations } from "@/hooks/useLocations";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import FilterChip from "@/components/FilterChip";
import SegmentedTabs from "@/components/SegmentedTabs";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "進行中", value: "inProgress" },
  { label: "已結束", value: "finished" },
];

const SORT_OPTIONS = [
  { label: "下次上課", value: "nextSession" },
  { label: "名稱", value: "name" },
  { label: "結束時間", value: "endAt" },
];

const TabAndSort = ({
  activeTab,
  setActiveTab,
  sort,
  setSort,
  tabsCount,
  search,
  setSearch,
  danceStyleId,
  setDanceStyleId,
  availableDanceStyleIds,
  locationId,
  setLocationId,
  availableLocationIds,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sort: string;
  setSort: (sort: string) => void;
  tabsCount: { inProgress: number; finished: number } | undefined;
  search: string;
  setSearch: (search: string) => void;
  danceStyleId: number | null;
  setDanceStyleId: (danceStyleId: number | null) => void;
  availableDanceStyleIds: number[];
  locationId: number | null;
  setLocationId: (locationId: number | null) => void;
  availableLocationIds: number[];
}) => {
  const [open, setOpen] = useState(false);

  // Only offer dance styles this classroom actually has lessons in (archived
  // ones included — old lessons are still listed); hide the whole row when
  // there's nothing meaningful to filter by (0 or 1 style).
  const { byId } = useDanceStyles();
  const danceChips = [...byId.values()].filter((style) =>
    availableDanceStyleIds.includes(style.id)
  );
  const showDanceFilter = danceChips.length > 1;
  // 分部 chips: same rule — only locations that have lessons, only when ≥2.
  const { all: allLocations } = useLocations();
  const locationChips = allLocations.filter((l) => availableLocationIds.includes(l.id));
  const showLocationFilter = locationChips.length > 1;

  const handleSort = (value: string) => {
    setSort(value);
    setTimeout(() => setOpen(false), 300);
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋課程或老師"
          className={cn(fieldControlClass(), "h-11 pl-10 pr-11 text-sm")}
        />
        {search && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={() => setSearch("")}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-500"
            aria-label="清除搜尋"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Dance-style filter chips */}
      {showDanceFilter && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
          <FilterChip size="sm" active={danceStyleId === null} onClick={() => setDanceStyleId(null)}>
            全部
          </FilterChip>
          {danceChips.map((style) => {
            const meta = danceStyleMeta(style);
            const active = danceStyleId === style.id;
            return (
              <button
                key={style.id}
                type="button"
                aria-pressed={active}
                onClick={() => setDanceStyleId(active ? null : style.id)}
                className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                  active
                    ? `${meta.badge} border-transparent`
                    : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-400"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 分部 filter chips */}
      {showLocationFilter && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
          <FilterChip size="sm" active={locationId === null} onClick={() => setLocationId(null)}>
            所有分部
          </FilterChip>
          {locationChips.map((location) => {
            const active = locationId === location.id;
            return (
              <FilterChip
                key={location.id}
                size="sm"
                active={active}
                onClick={() => setLocationId(active ? null : location.id)}
              >
                <MapPin className="w-3 h-3" />
                {location.name}
              </FilterChip>
            );
          })}
        </div>
      )}

      {/* Tabs + Sort */}
      <div className="flex items-center justify-between gap-2">
        <SegmentedTabs
          ariaLabel="課程狀態"
          value={activeTab}
          onChange={setActiveTab}
          options={TABS.map((tab) => ({
            value: tab.value,
            label: tab.label,
            hint: tabsCount ? tabsCount[tab.value as keyof typeof tabsCount] : "–",
          }))}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
              <ArrowDownUp className="size-4" />
              排序
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44">
            <div className="flex flex-col gap-3">
              <div className="text-xs text-neutral-500 font-medium">排序依據</div>
              <div className="flex flex-col gap-0.5">
                {SORT_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-neutral-100"
                    onClick={() => handleSort(option.value)}
                  >
                    <span
                      className={
                        sort === option.value ? "font-semibold text-primary-900" : "text-neutral-700"
                      }
                    >
                      {option.label}
                    </span>
                    {sort === option.value && (
                      <Check className="w-4 h-4 text-primary-700" />
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
