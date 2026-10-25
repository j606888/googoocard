"use client";

import { MapPin } from "lucide-react";
import { useLocations } from "@/hooks/useLocations";

/**
 * 分部：一排 chip（通常只有兩三個地點），再點一次取消。教室沒有分部就整段不顯示。
 * An archived location stays visible while it's the current value, so editing
 * an old lesson doesn't silently drop it.
 */
const LocationSelect = ({
  locationId,
  onChange,
}: {
  locationId: number | null;
  onChange: (value: number | null) => void;
}) => {
  const { all, locations } = useLocations();
  const current = all.find((l) => l.id === locationId);
  const options = current?.archivedAt ? [...locations, current] : locations;
  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <label className="mb-1 block font-medium">分部</label>
      <div className="flex flex-wrap gap-2">
        {options.map((location) => {
          const on = location.id === locationId;
          return (
            <button
              key={location.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : location.id)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium cursor-pointer ${
                on
                  ? "border-primary-700 bg-primary-700 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              {location.name}
            </button>
          );
        })}
      </div>
      {locationId === null && <p className="text-xs text-neutral-500">未指定分部</p>}
    </div>
  );
};

export default LocationSelect;
