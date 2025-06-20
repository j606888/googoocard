import { Check } from "lucide-react";

const RoundCheckbox = ({
  isChecked,
  onClick,
  className,
}: {
  isChecked: boolean;
  onClick?: () => void;
  className?: string;
}) => {
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center ${
        isChecked ? "bg-primary-500" : "border-1 border-gray-300"
      } ${className}`}
      onClick={onClick}
    >
      {isChecked && <Check className="w-4 h-4 text-white" />}
    </div>
  );
};

export default RoundCheckbox;
