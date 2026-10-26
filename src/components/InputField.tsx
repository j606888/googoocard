import Field from "./Field";

/**
 * Older call-site API kept for convenience; renders the design-system `Field`.
 * New code should use `Field` directly.
 */
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
}) => (
  <Field
    label={label}
    value={value}
    placeholder={placeholder}
    type={type}
    step={step}
    inputMode={type === "number" ? "numeric" : "text"}
    pattern={type === "number" ? "\\d*" : undefined}
    onChange={onChange}
    error={error}
    className={`w-full ${className}`}
  />
);

export default InputField;
