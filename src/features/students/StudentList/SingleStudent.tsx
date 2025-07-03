import { Student } from "@/store/slices/students";
import { useRouter } from "next/navigation";

const SingleStudent = ({ student }: { student: Student }) => {
  const router = useRouter();
  const studentCards = student.studentCards;

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
      {studentCards.length === 0 ? (
          <div className="w-full bg-[#E2E2E2] rounded-sm text-gray-700 p-3 text-center">
          No class card remained
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {studentCards.map((studentCard) => (
            <div key={studentCard.id} className="px-3 py-2 bg-primary-50">
              <div className="flex justify-between">
                <span className="text font-medium">{studentCard.card.name}</span>
                <span className="text-sm font-medium">{studentCard.remainingSessions} / {studentCard.totalSessions}</span>
              </div>
              <div className="flex justify-between">
                <span className='text-[#555555] font-medium'>${studentCard.finalPrice}</span>
                <span className='text-sm text-[#555555] font-medium'>sessions</span>
              </div>
            </div>
          ))}
        </div>
      )}
      
    </div>
  );
};

export default SingleStudent;
