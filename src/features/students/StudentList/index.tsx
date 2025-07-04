import NewStudent from "./NewStudent";
import { useGetStudentsQuery } from "@/store/slices/students";
import SingleStudent from "./SingleStudent";
import Searchbar from "./Searchbar";
import { useState } from "react";
import { Users } from "lucide-react";

const StudentList = () => {
  const [query, setQuery] = useState("");
  const { data: students } = useGetStudentsQuery({ query });

  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Students</h2>
        <NewStudent />
      </div>
      <Searchbar onSearch={setQuery} />
      {students?.length === 0 && (
        <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm ">
          <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-lg font-bold">No students yet</p>
            <p className="text-sm text-gray-500 text-center">
            Create student so they can start lesson
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {students?.map((student) => (
          <SingleStudent key={student.id} student={student} />
        ))}
      </div>
    </div>
  );
};

export default StudentList;
