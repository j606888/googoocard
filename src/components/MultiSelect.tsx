import { ChevronDown, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useState } from "react";


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
      <PopoverTrigger className="flex flex-col items-start cursor-pointer">
        <div className={`flex items-center justify-between p-3 border ${error ? "border-red-500" : "border-[#E4E8E8]"} rounded-md w-full`}>
          {values.length === 0 ? (
            <>
              <span className="text-sm text-[#A9AEB1]">{placeholder}</span>
              <ChevronDown className="w-4 h-4" />
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {selectedOptions.map((option) => (
                  <div
                    key={option.value}
                    className="text-xs bg-primary-300 px-3 py-2 rounded-sm flex items-center gap-1"
                    onClick={(e) => handleOptionClick(e, option.value)}
                  >
                    <span>{option.label}</span>
                    <X className="w-4 h-4 text-gray-500" />
                  </div>
                ))}
              </div>
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="p-1 min-w-[var(--radix-popper-anchor-width)] max-h-[240px] overflow-y-auto"
      >
        <div className="flex flex-col">
          {displayOptions.map((option) => (
            <div
              key={option.value}
              className="flex items-center justify-between py-1 px-2 hover:bg-primary-100 hover:cursor-pointer rounded-md"
              onClick={(e) => handleOptionClick(e, option.value)}
            >
              <span className="rounded-md p-1 text-sm">{option.label}</span>
            </div>
          ))}
          {newOptionLabel && (
            <div
              className="flex items-center py-1 px-2 hover:bg-primary-100 rounded-md hover:cursor-pointer bg-gray-100 mt-2"
              onClick={handleNewOptionClick}
            >
              <Plus className="w-4 h-4" />
              <span className="rounded-md p-1 text-sm">{newOptionLabel}</span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MultiSelect;
