import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

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
    <Button className={cn("mb-4", className)} onClick={onClick}>
      <Plus />
      <span>{children}</span>
    </Button>
  );
};

export default AddButton;
