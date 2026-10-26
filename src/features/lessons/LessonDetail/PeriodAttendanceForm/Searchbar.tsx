import { Search, X } from "lucide-react";
import { Student } from "@/store/slices/students";
import { useState } from "react";
import CreateStudent from "./CreateStudent";
import { Button } from "@/components/ui/button";
import { FieldError, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

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
          <p className="text-sm font-medium text-neutral-700">已選 {selectedStudents.length} 人</p>
          <FieldError>{error}</FieldError>
        </div>
        <CreateStudent
          defaultName={search}
          onCreate={(student) => {
            onCreateStudent(student.id);
          }}
        />
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          placeholder="搜尋學生姓名"
          aria-label="搜尋學生姓名"
          className={cn(fieldControlClass(), "h-12 pl-11 pr-12")}
          onChange={handleSearch}
          value={search}
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            aria-label="清除搜尋"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500"
            onClick={() => {setSearch(""); onSearch("")}}
          >
            <X className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default Searchbar;
