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
    <div className="flex items-center border-b border-gray-300 mb-4">
      {TABS.map((tab) => (
        <div
          key={tab.value}
          className={`flex items-center justify-center px-3 py-2 gap-1  text-sm  border-primary-500 -mb-px  ${
            activeTab === tab.value
              ? "text-primary-700 border-primary-500 bg-primary-50 border-b-3 font-medium "
              : "text-gray-500 border-transparent"
          }`}
          onClick={() => setActiveTab(tab.value)}
        >
          <span>{tab.label}</span>
          <span>
            ({tabsCount?.[tab.value as keyof typeof tabsCount] ?? 0})
          </span>
        </div>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="ml-auto">
          <div
            className="flex items-center gap-1 text-gray-700 cursor-pointer"
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
                  className="flex items-center justify-between gap-2 text-sm"
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
