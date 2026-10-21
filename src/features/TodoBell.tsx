import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import CardSerial from "@/components/CardSerial";
import { useGetTodosQuery, type TodoStudent } from "@/store/slices/todos";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { studentDetailHref } from "@/lib/studentNav";

/**
 * 「待處理」：待確認收款、需續約、出席沒綁課卡（src/service/todos.ts）。
 * 跟 App 的待處理分頁與推播 badge 同一份資料。沒有事項時整個隱藏。
 */
const TodoBell = ({
  className = "ml-auto",
  tone = "default",
}: {
  className?: string;
  /** `onPrimary`: sits on the green mobile app-bar (SubNavbar). */
  tone?: "default" | "onPrimary";
}) => {
  const [open, setOpen] = useState(false);
  const { data: todos, isLoading } = useGetTodosQuery(undefined, {
    refetchOnFocus: true,
  });

  // 加到主畫面的網站：圖示上的數字跟著待處理總數（推播來時 public/sw.js 也會設）。
  const total = todos?.total;
  useEffect(() => {
    if (total === undefined || !("setAppBadge" in navigator)) return;
    navigator.setAppBadge(total).catch(() => {});
  }, [total]);

  // 載入中先佔位，免得鈴鐺晚一拍才跳出來；載完確定 0 件才隱藏。
  if (isLoading) {
    return (
      <Skeleton
        data-in-app="hide"
        className={`${className} w-10 h-10 rounded-xl ${
          tone === "onPrimary" ? "bg-white/20" : ""
        }`}
      />
    );
  }

  if (!todos || todos.total === 0) return null;

  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-in-app="hide"
        className={`${className} w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer ${
          tone === "onPrimary" ? "hover:bg-white/15" : "hover:bg-neutral-100"
        }`}
        aria-label={`${todos.total} 件待處理`}
        title={`${todos.total} 件待處理`}
      >
        <div className="flex items-center gap-2 relative">
          <Bell className={`w-6 h-6 ${tone === "onPrimary" ? "text-white" : "text-neutral-700"}`} />
          <span
            className={`absolute -right-2.5 -top-2 bg-danger-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ring-2 ${
              tone === "onPrimary" ? "ring-primary-500" : "ring-white"
            }`}
          >
            {todos.total}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="mr-3 mt-2 w-80 p-0">
        <div className="flex flex-col max-h-[400px] overflow-y-auto py-2">
          <TodoSection title="待確認收款" count={todos.unpaidCards.length}>
            {todos.unpaidCards.map((item) => (
              <TodoRow
                key={`unpaid-${item.id}`}
                href={studentDetailHref(item.student.id)}
                student={item.student}
                onNavigate={close}
                meta={formatDate(item.createdAt)}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{item.cardName}</span>
                  <CardSerial serialNumber={item.serialNumber} />
                  <span className="shrink-0">NT${formatMoney(item.finalPrice)}</span>
                </span>
              </TodoRow>
            ))}
          </TodoSection>

          <TodoSection title="需續約" count={todos.needsRenewal.length}>
            {todos.needsRenewal.map((item) => (
              <TodoRow
                key={`renewal-${item.student.id}`}
                href={studentDetailHref(item.student.id)}
                student={item.student}
                onNavigate={close}
                meta={formatDate(item.since)}
              >
                課卡已用完
              </TodoRow>
            ))}
          </TodoSection>

          <TodoSection title="出席沒綁課卡" count={todos.unboundAttendance.length}>
            {todos.unboundAttendance.map((item) => (
              <TodoRow
                key={`unbound-${item.id}`}
                href={`/lessons/${item.lessonId}/periods/${item.lessonPeriodId}/check-success`}
                student={item.student}
                onNavigate={close}
                meta={formatDate(item.lessonPeriodStartTime)}
              >
                <span className="truncate">
                  {item.lessonName}
                  {item.source === "STUDENT" && "（自助簽到）"}
                </span>
              </TodoRow>
            ))}
          </TodoSection>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const TodoSection = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) => {
  if (count === 0) return null;
  return (
    <section className="flex flex-col">
      <h3 className="px-4 pt-2 pb-1 text-xs font-semibold text-neutral-500">
        {title}（{count}）
      </h3>
      {children}
    </section>
  );
};

const TodoRow = ({
  href,
  student,
  meta,
  onNavigate,
  children,
}: {
  href: string;
  student: TodoStudent;
  meta: string;
  onNavigate: () => void;
  children: ReactNode;
}) => (
  <Link
    href={href}
    onClick={onNavigate}
    className="flex gap-3 items-center px-4 py-2 hover:bg-neutral-50"
  >
    <img
      src={student.avatarUrl}
      alt=""
      className="w-8 h-8 rounded-full object-cover shrink-0"
    />
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold truncate">{student.name}</span>
        <span className="text-xs text-neutral-500 shrink-0">{meta}</span>
      </div>
      <span className="text-sm text-neutral-500 min-w-0">{children}</span>
    </div>
  </Link>
);

export default TodoBell;
