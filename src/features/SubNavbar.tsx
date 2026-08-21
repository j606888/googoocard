import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import UnpaidBell from "./UnpaidBell";

const SubNavbar = ({
  title,
  subtitle,
  backUrl,
  withUnpaidBell,
  className,
}: {
  title: string;
  /** Optional secondary line under the title — e.g. "週日課 · 14:00–15:00". */
  subtitle?: string;
  backUrl?: string;
  withUnpaidBell?: boolean;
  className?: string;
}) => {
  return (
    <div
      className={`sticky bg-primary-500 w-full flex flex-col items-center justify-center top-0 z-10 ${
        subtitle ? "py-3" : "h-16"
      } ${className ?? ""}`}
    >
      <div className="absolute left-5 top-1/2 -translate-y-1/2">
        {backUrl && (
          <Link href={backUrl}>
            <ArrowLeftIcon className="w-6 h-6 text-white" />
          </Link>
        )}
      </div>
      <h2 className="text-white text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-white/85 text-xs mt-0.5">{subtitle}</p>}
      {withUnpaidBell && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <UnpaidBell />
        </div>
      )}
    </div>
  );
};

export default SubNavbar;
