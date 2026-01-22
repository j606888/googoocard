import { Star } from "lucide-react";

const StarBadge = ({ type }: { type: "bachata" | "salsa" }) => {
  const text = type === "bachata" ? "可使用 Bachata LV1 複習卷" : "可使用 Salsa LV1 複習卷";

  return (
    <div className="flex gap-1 items-center bg-[#DB9618] rounded-lg py-1.5 px-3">
      <Star className="w-4 h-4 text-white" />
      <p className="text-sm text-white">{text}</p>
    </div>
  );
};

export default StarBadge;