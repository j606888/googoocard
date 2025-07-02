import { useState } from "react";
import Basic from "./Basic";
import Cards from "./Cards";
import Attend from "./Attend";
import { Student } from "@/store/slices/students";

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

const StudentDetail = ({ student }: { student: Student }) => {
  const [activeTab, setActiveTab] = useState(tabs[0].query);

  return (
    <div className="px-5 py-3">
      <div className="flex w-full mb-3">
        {tabs.map((tab) => (
          <div
            key={tab.query}
            className={`flex-1 text-center border-b-1 border-b-gray-300 p-2.5 text-sm ${
              activeTab === tab.query
                ? "text-primary-500 font-bold border-b-primary-500 border-b-2"
                : ""
            }`}
            onClick={() => setActiveTab(tab.query)}
          >
            {tab.label}
          </div>
        ))}
      </div>
      {activeTab === "basic" && <Basic student={student} />}
      {activeTab === "cards" && <Cards />}
      {activeTab === "attend" && <Attend />}
    </div>
  );
};

export default StudentDetail;
