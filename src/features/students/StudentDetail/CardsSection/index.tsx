import { StudentCardWithCard, StudentWithDetail } from "@/store/slices/students";
import StudentCard from "./StudentCard";
import BuyCard from "./BuyCard";

const CardsSection = ({ student, studentCards }: { student: StudentWithDetail, studentCards: StudentCardWithCard[] }) => {
  return (
    <div className="flex flex-col gap-3">
      <BuyCard student={student} />

      {studentCards.length > 0 ? (
        <div className="flex flex-col gap-3">
          {studentCards.map((studentCard) => (
            <StudentCard key={studentCard.id} studentCard={studentCard} />
          ))}
        </div>
      ) : (
        <div className="w-full p-5 bg-primary-50 text-center rounded-sm font-light">
          No card yet Q_Q
        </div>
      )}

    </div>
  );
};

export default CardsSection;
