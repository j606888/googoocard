import NewStudent from "./NewStudent";
import { useGetStudentsQuery } from "@/store/slices/students";
import SingleStudent from "./SingleStudent";

const StudentList = () => {
  const { data: students } = useGetStudentsQuery();

  return <div className="px-5 py-3">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-semibold">Students</h2>
      <NewStudent />
    </div>
    <div className="flex flex-col gap-4">
      {students?.map((student) => (
        <SingleStudent key={student.id} student={student} />
      ))}
    </div>
  </div>;
};

export default StudentList;