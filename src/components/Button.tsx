"use client";

const Button = ({
  children,
  isLoading = false,
  className = "",
  onClick = () => {},
  outline = false,
  disabled = false,
}: {
  children: React.ReactNode;
  outline?: boolean;
  isLoading?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) => {
  return (
    <button
      className={`w-full ${outline ? "bg-white text-primary-500 border border-primary-500" : "bg-primary-500 text-white"} font-semibold py-2 rounded ${
        isLoading ? "opacity-50 cursor-not-allowed" : ""
      } ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={() => !isLoading && !disabled && onClick()}
    >
      {children}
    </button>
  );
};

export default Button;
