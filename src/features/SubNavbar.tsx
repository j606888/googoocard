import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

const SubNavbar = ({ title, backUrl }: { title: string, backUrl?: string }) => {
  return <div className="relative h-16 bg-primary-500 w-full flex items-center justify-center sticky top-0 z-10">
  <div className="absolute left-5 top-1/2 -translate-y-1/2">
  {backUrl && (
    <Link href={backUrl}>
      <ArrowLeftIcon className="w-6 h-6 text-white" />
      </Link>
  )}
  </div>
  <h2 className="text-white text-lg font-semibold">{title}</h2>
</div>
};

export default SubNavbar;