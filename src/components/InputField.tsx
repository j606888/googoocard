const InputField = ({
  label,
  value,
  placeholder,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  type?: "text" | "number";
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  return (
    <div className="w-full relative">
      <label className="block mb-2 font-medium">{label}</label>
      <input
        className={`w-full p-2 rounded bg-gray-100 focus:outline-primary-500 ${error ? "border-1 border-red-500" : ""}`}
        value={value}
        placeholder={placeholder}
        type={type}
        inputMode={type === "number" ? "numeric" : "text"}
        pattern={type === "number" ? "\d*" : undefined}
        onChange={onChange}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default InputField;
