import { Student } from "@/store/slices/students";
import { useRouter } from "next/navigation";
import { CreditCard, ChevronRight } from "lucide-react";

const SingleStudent = ({ student }: { student: Student }) => {
  const router = useRouter();
  const studentCards = student.studentCards;

  return (
    <div
      className="flex flex-col gap-3 px-4 py-3 border-1 border-[#eeeeee] shadow-sm rounded-[10px] w-full cursor-pointer hover:bg-gray-50"
      onClick={() => router.push(`/students/${student.id}`)}
    >
      <div className="flex items-center gap-3">
        <img
          src={student.avatarUrl}
          className={`w-12 h-12 rounded-full object-cover`}
        />
        <div>
          <h2 className="text-lg font-semibold">{student.name}</h2>
          <div>
            <p className="flex gap-1 items-center text-sm text-gray-500">
              <CreditCard className="w-4 h-4" />
              {studentCards.length}
            </p>
          </div>
        </div>
        <ChevronRight className="w-6 h-6 ml-auto text-gray-500" />
      </div>
    </div>
  );
};

export default SingleStudent;
