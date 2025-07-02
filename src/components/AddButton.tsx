import { Plus } from "lucide-react";

const AddButton = ({
  onClick = () => {},
  children,
  className,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <button
      className={`bg-primary-500 text-white px-4 py-1.5 rounded-sm flex items-center justify-center gap-2 mb-4 ${className || ""}`}
      onClick={onClick}
    >
      <Plus className="w-4 h-4" />
      <span className="font-medium">{children}</span>
    </button>
  );
};

export default AddButton;
