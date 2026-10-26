import { Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const Searchbar = ({
  onSearch,
  inputRef,
  compact = false,
}: {
  onSearch: (search: string) => void;
  /** 給鍵盤捷徑（/）聚焦用 */
  inputRef?: React.Ref<HTMLInputElement>;
  /** 分割檢視左欄用：字級小一階 */
  compact?: boolean;
}) => {
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-3 rounded-xl border-[1.5px] border-neutral-300 bg-white focus-within:border-primary-700 focus-within:ring-[3px] focus-within:ring-primary-100 transition-colors ${
          compact ? "h-11 pl-3.5 pr-1.5 text-sm" : "h-12 pl-4 pr-1.5 text-base"
        }`}
      >
        <Search
          className={`text-neutral-400 flex-shrink-0 ${compact ? "w-4 h-4" : "w-5 h-5"}`}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={compact ? "搜尋姓名或卡號" : "搜尋學生姓名或卡號"}
          className="w-full bg-transparent text-neutral-900 outline-none placeholder:text-neutral-400"
          onChange={handleSearch}
          value={search}
        />
        {search ? (
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            aria-label="清除搜尋"
            className="ml-auto text-neutral-500"
            onClick={() => {
              setSearch("");
              onSearch("");
            }}
          >
            <X className={compact ? "w-4 h-4" : "w-5 h-5"} />
          </Button>
        ) : (
          // 只有接了鍵盤捷徑（分割檢視）才提示 /，手機沒有鍵盤
          inputRef && (
            <kbd className="ml-auto mr-2 shrink-0 px-1.5 py-px border border-neutral-200 rounded-sm bg-white text-[11px] text-neutral-500">
              /
            </kbd>
          )
        )}
      </div>
    </div>
  );
};

export default Searchbar;
