"use client";

import Drawer from "@/components/Drawer";
import { DanceType } from "@prisma/client";
import { danceTypeLabel } from "@/lib/danceTypes";
import { StudentTag } from "@/store/slices/students";
import { LessonSummary } from "@/store/slices/lessons";
import { EMPTY_FILTERS, StudentFilters, tagLabel } from "./studentFilters";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: StudentFilters;
  onChange: (next: StudentFilters) => void;
  tags: StudentTag[];
  lessons: Pick<LessonSummary, "id" | "name">[];
  availableQualifications: DanceType[];
  resultCount: number;
}

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const Chip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors cursor-pointer ${
      active
        ? "bg-primary-500 border-primary-500 text-white shadow-sm"
        : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-300"
    }`}
  >
    {label}
  </button>
);

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
  tags,
  lessons,
  availableQualifications,
  resultCount,
}: FilterDrawerProps) => {
  const hasAny =
    tags.length > 0 || availableQualifications.length > 0 || lessons.length > 0;

  return (
    <Drawer
      open={open}
      title="篩選"
      onClose={onClose}
      onSubmit={onClose}
      submitText={`查看 ${resultCount} 位學生`}
    >
      <div className="flex justify-end -mt-4 mb-2">
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-sm text-neutral-500 hover:text-primary-600 cursor-pointer"
        >
          清除
        </button>
      </div>

      <Section title="狀態">
        <Chip
          label="上課中"
          active={filters.inActiveLesson}
          onClick={() => onChange({ ...filters, inActiveLesson: !filters.inActiveLesson })}
        />
      </Section>

      {tags.length > 0 && (
        <Section title="標籤">
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tagLabel(tag.name)}
              active={filters.tags.includes(tag.name)}
              onClick={() => onChange({ ...filters, tags: toggle(filters.tags, tag.name) })}
            />
          ))}
        </Section>
      )}

      {availableQualifications.length > 0 && (
        <Section title="過課">
          {availableQualifications.map((type) => (
            <Chip
              key={type}
              label={`${danceTypeLabel(type)} Lv1`}
              active={filters.qualifications.includes(type)}
              onClick={() =>
                onChange({ ...filters, qualifications: toggle(filters.qualifications, type) })
              }
            />
          ))}
        </Section>
      )}

      {lessons.length > 0 && (
        <Section title="依課程">
          {lessons.map((lesson) => (
            <Chip
              key={lesson.id}
              label={lesson.name}
              active={filters.lessonIds.includes(lesson.id)}
              onClick={() =>
                onChange({ ...filters, lessonIds: toggle(filters.lessonIds, lesson.id) })
              }
            />
          ))}
        </Section>
      )}

      {!hasAny && (
        <p className="text-sm text-neutral-400 text-center py-4">尚無可用的篩選條件</p>
      )}
    </Drawer>
  );
};

export default FilterDrawer;
