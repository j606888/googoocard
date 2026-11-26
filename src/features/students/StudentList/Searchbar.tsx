import { Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** 學生名單的搜尋框：淺底、沒有框（跟課程頁同一個樣子）。搜尋本身在伺服器做。 */
const Searchbar = ({
  onSearch,
  inputRef,
}: {
  onSearch: (search: string) => void;
  /** 給鍵盤捷徑（/）聚焦用；有給才顯示「/」提示（手機沒有鍵盤）。 */
  inputRef?: React.Ref<HTMLInputElement>;
}) => {
  const [search, setSearch] = useState("");

  const update = (value: string) => {
    setSearch(value);
    onSearch(value);
  };

  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3"
      />
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => update(e.target.value)}
        placeholder="搜尋姓名或卡號"
        aria-label="搜尋學生姓名或卡號"
        // 手機維持 16px：再小 iOS 聚焦時會自己放大整個畫面。
        className="h-11 w-full rounded-lg bg-band pr-11 pl-10 text-base text-ink outline-none placeholder:text-ink-3 focus-visible:ring-[3px] focus-visible:ring-primary-300 lg:text-sm"
      />
      {search ? (
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          aria-label="清除搜尋"
          className="absolute top-1 right-1 text-ink-3 hover:bg-primary-50 hover:text-ink"
          onClick={() => update("")}
        >
          <X className="size-4" />
        </Button>
      ) : (
        inputRef && (
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-sm border border-line bg-white px-1.5 py-px text-[11px] text-ink-3"
          >
            /
          </kbd>
        )
      )}
    </div>
  );
};

export default Searchbar;
