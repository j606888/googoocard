import { TABS } from ".";
import SegmentedTabs from "@/components/SegmentedTabs";

const LessonTabs = ({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => {
  return (
    <div className="px-5 py-3">
      <SegmentedTabs
        variant="underline"
        fill
        ariaLabel="課程分頁"
        className="border-b border-neutral-200"
        value={activeTab}
        onChange={onTabChange}
        options={TABS.map((tab) => ({ value: tab.query, label: tab.name }))}
      />
    </div>
  );
};

export default LessonTabs;
