import { BookOpenText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

const LessonsList = () => {
  const router = useRouter();
  const lessons = [];

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
      {lessons?.length === 0 && (
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
      )}
    </div>
  );
};

export default LessonsList;
