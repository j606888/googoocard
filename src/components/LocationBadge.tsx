import { MapPin } from "lucide-react";
import type { LocationSummary } from "@/lib/locations";

/** 分部標籤（台南／高雄…）。Renders nothing when the lesson has no location. */
const LocationBadge = ({ location, className = "" }: { location: LocationSummary | null | undefined; className?: string }) => {
  if (!location) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 ${className}`}
    >
      <MapPin className="h-3 w-3" />
      {location.name}
    </span>
  );
};

export default LocationBadge;
