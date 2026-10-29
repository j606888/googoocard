import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

/**
 * 搜尋框＋「新增學生」圖示按鈕。高度固定——勾選時名單上方什麼都不會長高或縮短。
 */
const Searchbar = ({
  value,
  onSearch,
  onCreateClick,
  error,
}: {
  value: string;
  onSearch: (search: string) => void;
  onCreateClick: () => void;
  error: string | null;
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="搜尋學生姓名"
            aria-label="搜尋學生姓名"
            className={cn(fieldControlClass(), "h-12 pl-11 pr-12")}
            onChange={(e) => onSearch(e.target.value)}
            value={value}
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              aria-label="清除搜尋"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500"
              onClick={() => onSearch("")}
            >
              <X className="size-5" />
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="新增學生"
          className="size-12 shrink-0 border-[1.5px] border-neutral-300 bg-white text-neutral-700"
          onClick={onCreateClick}
        >
          <UserPlus className="size-5" />
        </Button>
      </div>
      <FieldError>{error}</FieldError>
    </div>
  );
};

export default Searchbar;
