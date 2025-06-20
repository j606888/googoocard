const InputField = ({
  label,
  value,
  placeholder,
  onChange,
  error,
  type = "text",
  step = "",
  className = "",
}: {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  step?: string;
  type?: "text" | "number" | "date" | "time";
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) => {
  return (
    <div className={`w-full relative ${className}`}>
      <label className="block mb-2 font-medium">{label}</label>
      <input
        className={`w-full p-2 rounded bg-gray-100 focus:outline-primary-500 ${error ? "border-1 border-red-500" : ""}`}
        value={value}
        placeholder={placeholder}
        type={type}
        step={step}
        inputMode={type === "number" ? "numeric" : "text"}
        pattern={type === "number" ? "\d*" : undefined}
        onChange={onChange}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default InputField;
