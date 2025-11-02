import { Student } from "@/store/slices/students";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";

const SingleStudent = ({ student }: { student: Student }) => {
  const router = useRouter();
  const studentCards = student.studentCards;

  return (
    <div
      className="flex flex-col gap-3 w-full cursor-pointer hover:bg-gray-50"
      onClick={() => router.push(`/students/${student.id}`)}
    >
      <div className="flex items-center gap-3">
        <img
          src={student.avatarUrl}
          className={`w-10 h-10 rounded-full object-cover`}
        />
        <div className="border-b border-gray-200 w-full py-2">
          <h2 className="font-medium">{student.name}</h2>
          <div>
            <p className="flex gap-1 items-center text-sm text-gray-400">
              <CreditCard className="w-4 h-4" />
              {studentCards.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleStudent;
