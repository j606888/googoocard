import { ChevronDown, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useState } from "react";
import { fieldControlClass } from "./Field";
import { cn } from "@/lib/utils";


const MultiSelect = ({
  options,
  values,
  onChange,
  placeholder,
  newOptionLabel,
  newOptionOnClick,
  error,
}: {
  options: { value: string | number; label: string }[];
  values: (string | number)[];
  placeholder?: string;
  onChange: (values: (string | number)[]) => void;
  newOptionLabel?: string;
  newOptionOnClick?: () => void;
  error?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const displayOptions = options.filter((option) => !values.includes(option.value));
  
  const selectedOptions = options.filter((option) =>
    values.includes(option.value)
  );

  const handleNewOptionClick = () => {
    if (newOptionOnClick) {
      newOptionOnClick();
    }
    setIsOpen(false);
  };

  const handleOptionClick = (e: React.MouseEvent<HTMLDivElement>, value: string | number) => {
    e.stopPropagation();
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      setIsOpen(false);
      onChange([...values, value]);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="flex flex-col items-start gap-1.5 cursor-pointer">
        <div className={cn(fieldControlClass(!!error), "flex min-h-12 items-center justify-between gap-2 py-2 text-left")}>
          {values?.length === 0 ? (
            <>
              <span className="text-neutral-400">{placeholder}</span>
              <ChevronDown className="w-4 h-4 shrink-0 text-neutral-500" />
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {selectedOptions.map((option) => (
                  <div
                    key={option.value}
                    className="text-sm font-medium bg-primary-100 text-primary-900 pl-3 pr-2 py-1 rounded-full flex items-center gap-1"
                    onClick={(e) => handleOptionClick(e, option.value)}
                  >
                    <span>{option.label}</span>
                    <X className="w-4 h-4 text-primary-700" />
                  </div>
                ))}
              </div>
              <ChevronDown className="w-4 h-4 shrink-0 text-neutral-500" />
            </>
          )}
        </div>
        {error && <p className="text-[13px] text-danger-700">{error}</p>}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="p-1 min-w-[var(--radix-popper-anchor-width)] max-h-[240px] overflow-y-auto"
      >
        <div className="flex flex-col">
          {displayOptions.map((option) => (
            <div
              key={option.value}
              className="flex items-center justify-between py-1 px-2 hover:bg-primary-50 hover:cursor-pointer rounded-lg"
              onClick={(e) => handleOptionClick(e, option.value)}
            >
              <span className="p-1 text-sm">{option.label}</span>
            </div>
          ))}
          {newOptionLabel && (
            <div
              className="flex items-center py-1 px-2 text-primary-900 font-medium hover:bg-primary-50 rounded-lg hover:cursor-pointer border-t border-neutral-200 mt-1"
              onClick={handleNewOptionClick}
            >
              <Plus className="w-4 h-4" />
              <span className="p-1 text-sm">{newOptionLabel}</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MultiSelect;
