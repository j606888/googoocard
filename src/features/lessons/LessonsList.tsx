import { BookOpenText, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGetLessonsQuery } from "@/store/slices/lessons";
import ListSkeleton from "@/components/skeletons/ListSkeleton";

const LessonsList = () => {
  const router = useRouter();
  const { data: lessons, isLoading } = useGetLessonsQuery();

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
      {lessons?.length === 0 ? (
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
          {lessons?.map((lesson) => (
            <div
              key={lesson.id}
              className="flex flex-col border-1 border-gray-200 rounded-sm p-3 gap-2 shadow-sm"
              onClick={() => router.push(`/lessons/${lesson.id}`)}
            >
              <h3 className="text-lg font-semibold">{lesson.name}</h3>
              <div className="flex gap-2 text-gray-600">
                <div className="w-1/2 flex gap-1 items-center">
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {lesson.students.length}
                  </span>
                </div>
                <div className="w-1/2 flex gap-1 items-center">
                  <BookOpenText className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {lesson.periods.length}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonsList;
