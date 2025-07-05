import { useState } from "react";
import Basic from "./Basic";
import CardsSection from "./CardsSection";
import AttendSection from "./AttendSection";
import { StudentWithDetail } from "@/store/slices/students";
import { useRouter, useSearchParams } from "next/navigation";

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

const StudentDetail = ({ student }: { student: StudentWithDetail }) => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tab || tabs[0].query);
  const router = useRouter();

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    router.push(`/students/${student.id}?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="px-5 py-3">
      <div className="flex w-full mb-3">
        {tabs.map((tab) => (
          <div
            key={tab.query}
            className={`flex-1 text-center border-b-1 border-b-gray-300 p-2.5 text-sm ${
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
      {activeTab === "basic" && <Basic student={student} />}
      {activeTab === "cards" && <CardsSection student={student} studentCards={student.studentCards} />}
      {activeTab === "attend" && <AttendSection student={student} />}
    </div>
  );
};

export default StudentDetail;
