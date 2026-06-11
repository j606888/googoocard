import { ArrowDownUp } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { Check } from "lucide-react";

const TABS = [
  {
    label: "In progress",
    value: "inProgress",
  },
  {
    label: "Finished",
    value: "finished",
  },
];

const SORT_OPTIONS = [
  {
    label: "Name",
    value: "name",
  },
  {
    label: "End at",
    value: "endAt",
  },
];

const TabAndSort = ({
  activeTab,
  setActiveTab,
  sort,
  setSort,
  tabsCount,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sort: string;
  setSort: (sort: string) => void;
  tabsCount: { inProgress: number; finished: number } | undefined;
}) => {
  const [open, setOpen] = useState(false);

  const handleSort = (sort: string) => {
    setSort(sort);
    setTimeout(() => {
      setOpen(false);
    }, 300);
  };

  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`flex items-center justify-center px-3.5 py-1.5 gap-1 text-sm rounded-full cursor-pointer transition-colors ${
              activeTab === tab.value
                ? "bg-white text-primary-700 font-semibold shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab(tab.value)}
          >
            <span>{tab.label}</span>
            <span className={activeTab === tab.value ? "text-primary-400" : "text-gray-400"}>
              {tabsCount?.[tab.value as keyof typeof tabsCount] ?? 0}
            </span>
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <div
            className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 cursor-pointer px-2 py-1.5"
            onClick={() => setOpen(!open)}
          >
            <ArrowDownUp className="w-4 h-4" />
            <span className="text-sm">Sort</span>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-40">
          <div className="flex flex-col gap-3">
            <div className="text-xs text-gray-500 font-medium">Sort by</div>
            <div className="flex flex-col gap-1">
              {SORT_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center justify-between gap-2 text-sm cursor-pointer"
                  onClick={() => handleSort(option.value)}
                >
                  <span
                    className={`${
                      sort === option.value
                        ? "text-primary-500"
                        : "text-gray-500"
                    }`}
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
  );
};

export default TabAndSort;
