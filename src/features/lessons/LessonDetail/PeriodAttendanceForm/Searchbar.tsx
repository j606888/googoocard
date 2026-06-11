import { Search, X } from "lucide-react";
import { Student } from "@/store/slices/students";
import { useState } from "react";
import CreateStudent from "./CreateStudent";

const Searchbar = ({ onSearch, selectedStudents, error, onCreateStudent }: { onSearch: (search: string) => void, selectedStudents: Student[], error: string | null, onCreateStudent: (id: number) => void }) => {
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-700">Selected ({selectedStudents.length})</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <CreateStudent
          defaultName={search}
          onCreate={(student) => {
            onCreateStudent(student.id);
          }}
        />
      </div>
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus-within:border-primary-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-100 transition-colors">
        <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search students"
          className="w-full bg-transparent outline-none placeholder:text-gray-400"
          onChange={handleSearch}
          value={search}
        />
        {search && <X className="ml-auto w-5 h-5 text-gray-400 cursor-pointer" onClick={() => {setSearch(""); onSearch("")}} />}
      </div>
    </div>
  );
};

export default Searchbar;
