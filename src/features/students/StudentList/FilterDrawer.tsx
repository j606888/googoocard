"use client";

import { SortDirection, SortDirectionToggle } from "@/components/SortMenu";
import Drawer from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import { StudentTag } from "@/store/slices/students";
import {
  EMPTY_FILTERS,
  NEEDS_RENEWAL_TAG,
  SORT_OPTIONS,
  StudentFilters,
  StudentSort,
} from "./studentFilters";

/** 抽屜「條件」區的一個開關（剩 2 堂以下、未付款、未綁 LINE）。 */
export interface StatusFilterOption {
  key: string;
  label: string;
  count: number;
  active: boolean;
  toggle: () => void;
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: StudentFilters;
  onChange: (next: StudentFilters) => void;
  sort: StudentSort;
  onSortChange: (sort: StudentSort) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (direction: SortDirection) => void;
  statusOptions: StatusFilterOption[];
  /** 教室的標籤；系統的「Needs Renewal」不在這裡選（名單上方有「已經沒卡」）。 */
  tags: StudentTag[];
  availableQualifications: DanceStyleSummary[];
  resultCount: number;
}

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** 一組選項：標題＋細線分隔的整列（整列都點得到，44px 高）。 */
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-6">
    <h3 className="mb-1 text-[13px] font-semibold text-ink-2">{title}</h3>
    <div className="flex flex-col divide-y divide-line border-b border-line">{children}</div>
  </section>
);

const OptionRow = ({
  type,
  name,
  checked,
  onChange,
  hint,
  children,
}: {
  type: "radio" | "checkbox";
  name?: string;
  checked: boolean;
  onChange: () => void;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink">
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {hint !== undefined && <span className="text-[13px] tabular-nums text-ink-3">{hint}</span>}
    <input
      type={type}
      name={name}
      checked={checked}
      onChange={onChange}
      className="size-4 accent-primary-700"
    />
  </label>
);

const FilterDrawer = ({
  open,
  onClose,
  filters,
  onChange,
  sort,
  onSortChange,
  sortDirection,
  onSortDirectionChange,
  statusOptions,
  tags,
  availableQualifications,
  resultCount,
}: FilterDrawerProps) => {
  // 自由標籤：教室真的有建才有這一區（系統標籤不算）。
  const freeTags = tags.filter((tag) => tag.name !== NEEDS_RENEWAL_TAG);
  const currentSortDirections = SORT_OPTIONS.find((option) => option.value === sort)?.directions;

  return (
    <Drawer
      open={open}
      title="篩選與排序"
      onClose={onClose}
      onSubmit={onClose}
      submitText={`顯示 ${resultCount} 位學生`}
    >
      <Group title="排序">
        {SORT_OPTIONS.map((option) => (
          <OptionRow
            key={option.value}
            type="radio"
            name="student-sort"
            checked={sort === option.value}
            onChange={() => onSortChange(option.value)}
          >
            {option.label}
          </OptionRow>
        ))}
      </Group>
      {currentSortDirections && (
        <div className="-mt-3 mb-6">
          <SortDirectionToggle
            labels={currentSortDirections}
            direction={sortDirection}
            onChange={onSortDirectionChange}
          />
        </div>
      )}

      <Group title="條件">
        {statusOptions.map((option) => (
          <OptionRow
            key={option.key}
            type="checkbox"
            checked={option.active}
            onChange={option.toggle}
            hint={`${option.count} 位`}
          >
            {option.label}
          </OptionRow>
        ))}
      </Group>

      {availableQualifications.length > 0 && (
        <Group title="舞種資格">
          {availableQualifications.map((style) => (
            <OptionRow
              key={style.id}
              type="checkbox"
              checked={filters.qualifications.includes(style.id)}
              onChange={() =>
                onChange({ ...filters, qualifications: toggle(filters.qualifications, style.id) })
              }
            >
              {style.name}
            </OptionRow>
          ))}
        </Group>
      )}

      {freeTags.length > 0 && (
        <Group title="標籤">
          {freeTags.map((tag) => (
            <OptionRow
              key={tag.id}
              type="checkbox"
              checked={filters.tags.includes(tag.name)}
              onChange={() => onChange({ ...filters, tags: toggle(filters.tags, tag.name) })}
            >
              {tag.name}
            </OptionRow>
          ))}
        </Group>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="text" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          清除全部條件
        </Button>
      </div>
    </Drawer>
  );
};

export default FilterDrawer;
