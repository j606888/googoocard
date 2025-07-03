import { Search, X } from "lucide-react";
import { useState } from "react";

const Searchbar = ({ onSearch }: { onSearch: (search: string) => void }) => {
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-center gap-3 p-3 rounded-sm border-1 border-[#e2e2e2]">
        <Search className="w-5 h-5 text-[#808080] flex-shrink-0" />
        <input
          type="text"
          placeholder="Search"
          className="w-full outline-none"
          onChange={handleSearch}
          value={search}
        />
        {search && <X className="ml-auto w-5 h-5 text-[#808080]" onClick={() => {setSearch(""); onSearch("")}} />}
      </div>
    </div>
  );
};

export default Searchbar;
