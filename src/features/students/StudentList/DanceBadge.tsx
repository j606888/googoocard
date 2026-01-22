const DanceBadge = ({ type }: { type: "bachata" | "salsa" }) => {
  const text = type === "bachata" ? "B" : "S";
  return (
    <div className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
      {text}
    </div>
  );
};

export default DanceBadge;