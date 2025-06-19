"use client";

const Button = ({
  children,
  isLoading = false,
  className = "",
  onClick = () => {},
  outline = false,
}: {
  children: React.ReactNode;
  outline?: boolean;
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}) => {
  return (
    <button
      className={`w-full ${outline ? "bg-white text-primary-500 border border-primary-500" : "bg-primary-500 text-white"} font-semibold py-2 rounded ${
        isLoading ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
      onClick={() => !isLoading && onClick()}
    >
      {children}
    </button>
  );
};

export default Button;
