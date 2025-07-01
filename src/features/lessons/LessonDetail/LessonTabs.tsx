import { TABS } from ".";

const LessonTabs = ({
  activeTab,
  onTabChange,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => {
  return (
    <div className="flex px-5 py-3">
      {TABS.map((tab) => (
        <div
          key={tab.query}
          className={`flex-1 text-center p-2.5 border-b-1 border-gray-200 cursor-pointer ${
            activeTab === tab.query
              ? "border-b-2 border-primary-500 text-primary-500 font-semibold"
              : ""
          }`}
          onClick={() => onTabChange(tab.query)}
        >
          {tab.name}
        </div>
      ))}
    </div>
  );
};

export default LessonTabs;
