import { Student } from "@/store/slices/students";
import { useRouter } from "next/navigation";

const SingleStudent = ({ student }: { student: Student }) => {
  const router = useRouter();

  return (
    <div
      className="flex flex-col gap-3 p-4 border-1 border-[#eeeeee] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.1)] rounded-sm w-full"
      onClick={() => router.push(`/students/${student.id}`)}
    >
      <div className="flex items-center gap-3">
        <img
          src={student.avatarUrl}
          className={`w-10 h-10 rounded-full object-cover`}
        />
        <h2 className="text-xl font-semibold">{student.name}</h2>
      </div>
      <div className="w-full bg-[#E2E2E2] rounded-sm text-gray-700 p-3 text-center">
        No class card remained
      </div>
    </div>
  );
};

export default SingleStudent;
