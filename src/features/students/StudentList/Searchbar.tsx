import { Search, X } from "lucide-react";
import { useState } from "react";

const Searchbar = ({
  onSearch,
  inputRef,
  compact = false,
}: {
  onSearch: (search: string) => void;
  /** 給鍵盤捷徑（/）聚焦用 */
  inputRef?: React.Ref<HTMLInputElement>;
  /** 分割檢視左欄用：不留下方外距、字級小一階 */
  compact?: boolean;
}) => {
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <div className={compact ? "" : "mb-4"}>
      <div
        className={`flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 focus-within:border-primary-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-100 transition-colors ${
          compact ? "px-3.5 py-2 text-sm" : "px-4 py-2.5"
        }`}
      >
        <Search
          className={`text-neutral-400 flex-shrink-0 ${compact ? "w-4 h-4" : "w-5 h-5"}`}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={compact ? "搜尋姓名或編號" : "搜尋學生姓名"}
          className="w-full bg-transparent outline-none placeholder:text-neutral-400"
          onChange={handleSearch}
          value={search}
        />
        {search ? (
          <button
            className="ml-auto text-neutral-400 hover:text-neutral-600 cursor-pointer"
            onClick={() => {
              setSearch("");
              onSearch("");
            }}
          >
            <X className={compact ? "w-4 h-4" : "w-5 h-5"} />
          </button>
        ) : (
          compact && (
            <kbd className="ml-auto shrink-0 px-1.5 py-px border border-neutral-200 rounded bg-white text-[11px] text-neutral-400">
              /
            </kbd>
          )
        )}
      </div>
    </div>
  );
};

export default Searchbar;
