"use client";

import { MapPin } from "lucide-react";
import { useLocations } from "@/hooks/useLocations";
import FilterChip from "@/components/FilterChip";
import { FieldError, FieldLabel } from "@/components/Field";

/**
 * 分部：一排 chip（通常只有兩三個地點），再點一次取消。教室沒有分部就整段不顯示。
 * `required`（財務開啟的教室，每門課都要有分部）：沒有分部時改顯示提醒，沒選時不寫「未指定」。
 * An archived location stays visible while it's the current value, so editing
 * an old lesson doesn't silently drop it.
 */
const LocationSelect = ({
  locationId,
  onChange,
  required = false,
  error,
}: {
  locationId: number | null;
  onChange: (value: number | null) => void;
  required?: boolean;
  error?: string;
}) => {
  const { all, locations, isLoading } = useLocations();
  const current = all.find((l) => l.id === locationId);
  const options = current?.archivedAt ? [...locations, current] : locations;
  if (options.length === 0) {
    if (!required || isLoading) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel>分部</FieldLabel>
        <FieldError>這間教室開了財務，每門課都要有分部——請先到「教室設定 › 分部」新增一個。</FieldError>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>分部</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((location) => {
          const on = location.id === locationId;
          return (
            <FilterChip
              key={location.id}
              active={on}
              onClick={() => onChange(on ? null : location.id)}
            >
              <MapPin className="h-3.5 w-3.5" />
              {location.name}
            </FilterChip>
          );
        })}
      </div>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        locationId === null && !required && <p className="text-xs text-neutral-500">未指定分部</p>
      )}
    </div>
  );
};

export default LocationSelect;
