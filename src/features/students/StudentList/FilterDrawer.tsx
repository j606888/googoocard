"use client";

import FilterChip from "@/components/FilterChip";
import { SortDirection, SortDirectionToggle } from "@/components/SortMenu";
import Drawer from "@/components/Drawer";
import { Button } from "@/components/ui/button";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import { StudentTag } from "@/store/slices/students";
import { LessonSummary } from "@/store/slices/lessons";
import {
  EMPTY_FILTERS,
  NEEDS_RENEWAL_TAG,
  SORT_OPTIONS,
  StudentFilters,
  StudentSort,
} from "./studentFilters";

/** 一個狀態條件——名單上方的快篩 chip 和抽屜的「狀態」區共用同一份。 */
export interface StatusFilterOption {
  key: string;
  label: string;
  count: number;
  active: boolean;
  alert?: boolean;
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
  tags: StudentTag[];
  lessons: Pick<LessonSummary, "id" | "name">[];
  availableQualifications: DanceStyleSummary[];
  resultCount: number;
}

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <h3 className="text-sm font-semibold text-neutral-500 mb-2">{title}</h3>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
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
  lessons,
  availableQualifications,
  resultCount,
}: FilterDrawerProps) => {
  // 需續約已經在「狀態」裡，標籤區不再重複一次
  const otherTags = tags.filter((tag) => tag.name !== NEEDS_RENEWAL_TAG);
  const currentSortDirections = SORT_OPTIONS.find((option) => option.value === sort)?.directions;

  return (
    <Drawer
      open={open}
      title="篩選與排序"
      onClose={onClose}
      onSubmit={onClose}
      submitText={`顯示 ${resultCount} 位學生`}
    >
      <div className="flex justify-end mb-1">
        <Button type="button" variant="link" className="text-sm font-semibold" onClick={() => onChange(EMPTY_FILTERS)}>
          清除全部
        </Button>
      </div>

      <div className="mb-5">
        <h3 className="text-sm font-semibold text-neutral-500 mb-2">排序</h3>
        <div className="flex flex-col rounded-xl border border-neutral-200 overflow-hidden">
          {SORT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center justify-between px-3.5 min-h-11 border-b border-neutral-100 last:border-b-0 text-sm cursor-pointer"
            >
              {option.label}
              <input
                type="radio"
                name="student-sort"
                checked={sort === option.value}
                onChange={() => onSortChange(option.value)}
                className="w-4 h-4 accent-primary-700"
              />
            </label>
          ))}
        </div>
        {currentSortDirections && (
          <div className="mt-2">
            <SortDirectionToggle
              labels={currentSortDirections}
              direction={sortDirection}
              onChange={onSortDirectionChange}
            />
          </div>
        )}
      </div>

      <Section title="狀態">
        {statusOptions.map((option) => (
          <FilterChip
            key={option.key}
            active={option.active}
            alert={option.alert}
            count={option.count}
            onClick={option.toggle}
          >
            {option.label}
          </FilterChip>
        ))}
      </Section>

      {availableQualifications.length > 0 && (
        <Section title="舞種資格">
          {availableQualifications.map((style) => (
            <FilterChip
              key={style.id}
              active={filters.qualifications.includes(style.id)}
              onClick={() =>
                onChange({ ...filters, qualifications: toggle(filters.qualifications, style.id) })
              }
            >
              {style.name}
            </FilterChip>
          ))}
        </Section>
      )}

      {lessons.length > 0 && (
        <Section title="正在上的課">
          {lessons.map((lesson) => (
            <FilterChip
              key={lesson.id}
              active={filters.lessonIds.includes(lesson.id)}
              onClick={() =>
                onChange({ ...filters, lessonIds: toggle(filters.lessonIds, lesson.id) })
              }
            >
              {lesson.name}
            </FilterChip>
          ))}
        </Section>
      )}

      {otherTags.length > 0 && (
        <Section title="標籤">
          {otherTags.map((tag) => (
            <FilterChip
              key={tag.id}
              active={filters.tags.includes(tag.name)}
              onClick={() => onChange({ ...filters, tags: toggle(filters.tags, tag.name) })}
            >
              {tag.name}
            </FilterChip>
          ))}
        </Section>
      )}
    </Drawer>
  );
};

export default FilterDrawer;
