import { useState } from "react";
import BasicSection from "./BasicSection";
import CardsSection from "./CardsSection";
import AttendSection from "./AttendSection";
import { StudentWithDetail } from "@/store/slices/students";
import { useSearchParams } from "next/navigation";

const tabs = [
  {
    label: "Basic",
    query: "basic",
  },
  {
    label: "Cards",
    query: "cards",
  },
  {
    label: "Attend",
    query: "attend",
  },
];

const StudentDetail = ({ student, isPublic = false }: { student: StudentWithDetail, isPublic?: boolean }) => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tab || tabs[0].query);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
  };

  return (
    <div className="px-5 py-3">
      <div className="flex w-full mb-3">
        {tabs.map((tab) => (
          <div
            key={tab.query}
            className={`flex-1 text-center border-b-1 border-b-gray-300 p-2.5 text-sm cursor-pointer ${
              activeTab === tab.query
                ? "text-primary-500 font-bold border-b-primary-500 border-b-3"
                : ""
            }`}
            onClick={() => handleTabClick(tab.query)}
          >
            {tab.label}
          </div>
        ))}
      </div>
      {activeTab === "basic" && <BasicSection student={student} isPublic={isPublic} />}
      {activeTab === "cards" && <CardsSection student={student} studentCards={student.studentCards} isPublic={isPublic} />}
      {activeTab === "attend" && <AttendSection student={student} />}
    </div>
  );
};

export default StudentDetail;
