import { Search, X } from "lucide-react";
import { useState } from "react";

const Searchbar = ({ onSearch }: { onSearch: (search: string) => void }) => {
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus-within:border-primary-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-100 transition-colors">
        <Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search students"
          className="w-full bg-transparent outline-none placeholder:text-neutral-400"
          onChange={handleSearch}
          value={search}
        />
        {search && (
          <button
            className="ml-auto text-neutral-400 hover:text-neutral-600"
            onClick={() => {
              setSearch("");
              onSearch("");
            }}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Searchbar;
