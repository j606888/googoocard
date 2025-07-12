import { BookOpenText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import TabAndSort from "./TabAndSort";
import LessonCard from "./LessonCard";
import { useState } from "react";

const LessonsList = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inProgress");
  const [sort, setSort] = useState("name");
  const { data: lessons, isLoading } = useGetLessonsQuery({
    tab: activeTab,
    sort,
  });

  if (isLoading) return <ListSkeleton />;

  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Lessons</h2>
        <button
          className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2"
          onClick={() => router.push("/lessons/new")}
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">New Lesson</span>
        </button>
      </div>
      <TabAndSort
        tabsCount={lessons?.tabsCount}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sort={sort}
        setSort={setSort}
      />
      {lessons?.lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm ">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <BookOpenText className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">No lessons yet</p>
            <p className="text-sm text-gray-500 text-center">
              Create lesson to start teaching!
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lessons?.lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonsList;
