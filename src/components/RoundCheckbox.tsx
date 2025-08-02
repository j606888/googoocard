import { Check } from "lucide-react";

const RoundCheckbox = ({
  isChecked,
  onClick,
  className,
  disabled = false
}: {
  isChecked: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) => {
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer ${
        isChecked ? "bg-primary-500" : "border-1 border-gray-300"
      } ${disabled ? "cursor-not-allowed bg-gray-100" : ""} ${className}`}
      onClick={disabled ? undefined : onClick}
    >
      {isChecked && <Check className="w-4 h-4 text-white" />}
    </div>
  );
};

export default RoundCheckbox;
