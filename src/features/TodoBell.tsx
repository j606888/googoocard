import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import CardSerial from "@/components/CardSerial";
import SegmentedTabs from "@/components/SegmentedTabs";
import StatusTag from "@/components/StatusTag";
import { Button } from "@/components/ui/button";
import { useGetTodosQuery, type Todos, type TodoStudent } from "@/store/slices/todos";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { studentDetailHref } from "@/lib/studentNav";
import ConfirmPaymentDrawer, { type ConfirmPaymentTarget } from "@/features/students/ConfirmPaymentDrawer";
import BindAttendanceCardDialog, { type BindCardTarget } from "@/features/BindAttendanceCardDialog";

/** 未付款超過這麼多天就標紅。 */
const UNPAID_OVERDUE_DAYS = 7;

type Tab = "urgent" | "reminders";

/**
 * 「待處理」（src/service/todos.ts），跟 App 的待處理分頁與推播 badge 同一份資料。
 * 分兩頁：
 *  - 要處理：點名沒課卡、買卡未付款——紅色數字只算這兩類，可以就地「補卡」「確認收款」
 *  - 提醒：需續約（近 30 天有來）、體驗後還沒買卡、可能重複——只顯示灰點
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
  const [tab, setTab] = useState<Tab>("urgent");
  // 對話框掛在 Popover 外面：Popover 一被點到外面就會關掉，掛在裡面會連對話框一起卸載。
  const [payTarget, setPayTarget] = useState<ConfirmPaymentTarget | null>(null);
  const [bindTarget, setBindTarget] = useState<BindCardTarget | null>(null);
  const { data: todos, isLoading } = useGetTodosQuery(undefined, {
    refetchOnFocus: true,
  });

  // 加到主畫面的網站：圖示上的數字跟著「要處理」（推播來時 public/sw.js 也會設）。
  const urgentCount = todos?.urgentCount;
  useEffect(() => {
    if (urgentCount === undefined || !("setAppBadge" in navigator)) return;
    navigator.setAppBadge(urgentCount).catch(() => {});
  }, [urgentCount]);

  // 載入中先佔位，免得鈴鐺晚一拍才跳出來。
  if (isLoading) {
    return (
      <Skeleton
        data-in-app="hide"
        className={`${className} size-11 rounded-xl ${
          tone === "onPrimary" ? "bg-white/20" : ""
        }`}
      />
    );
  }

  if (!todos) return null;

  const handleOpenChange = (next: boolean) => {
    // 每次打開都從「要處理」開始；沒有要處理的才直接看提醒。
    if (next) setTab(todos.urgentCount > 0 || todos.reminderCount === 0 ? "urgent" : "reminders");
    setOpen(next);
  };
  const close = () => setOpen(false);

  const label =
    todos.urgentCount > 0
      ? `${todos.urgentCount} 件要處理`
      : todos.reminderCount > 0
        ? `${todos.reminderCount} 件提醒`
        : "待處理";

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          data-in-app="hide"
          className={`${className} size-11 rounded-xl flex items-center justify-center cursor-pointer ${
            tone === "onPrimary" ? "hover:bg-white/15" : "hover:bg-neutral-100"
          }`}
          aria-label={label}
          title={label}
        >
          <div className="flex items-center gap-2 relative">
            <Bell className={`w-6 h-6 ${tone === "onPrimary" ? "text-white" : "text-neutral-700"}`} />
            {todos.urgentCount > 0 ? (
              <span
                className={`absolute -right-2.5 -top-2 bg-danger-600 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ring-2 ${
                  tone === "onPrimary" ? "ring-primary-900" : "ring-white"
                }`}
              >
                {todos.urgentCount}
              </span>
            ) : (
              todos.reminderCount > 0 && (
                <span
                  className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ${
                    tone === "onPrimary" ? "bg-white ring-primary-900" : "bg-neutral-500 ring-white"
                  }`}
                />
              )
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="mr-3 mt-2 w-[min(24rem,calc(100vw-1.5rem))] p-0">
          <div className="flex flex-col max-h-[min(560px,calc(100dvh-6rem))]">
            <div className="px-3 pt-3 pb-2">
              <SegmentedTabs
                ariaLabel="待處理分類"
                fill
                value={tab}
                onChange={setTab}
                options={[
                  {
                    value: "urgent",
                    label: (
                      <span className="flex items-center justify-center gap-1.5">
                        要處理
                        {todos.urgentCount > 0 && <CountPill tone="danger">{todos.urgentCount}</CountPill>}
                      </span>
                    ),
                  },
                  {
                    value: "reminders",
                    label: (
                      <span className="flex items-center justify-center gap-1.5">
                        提醒
                        {todos.reminderCount > 0 && <CountPill tone="neutral">{todos.reminderCount}</CountPill>}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
            <div className="flex flex-col overflow-y-auto pb-2">
              {tab === "urgent" ? (
                <UrgentTab
                  todos={todos}
                  onNavigate={close}
                  onShowReminders={() => setTab("reminders")}
                  onBind={(target) => {
                    close();
                    setBindTarget(target);
                  }}
                  onPay={(target) => {
                    close();
                    setPayTarget(target);
                  }}
                />
              ) : (
                <RemindersTab todos={todos} onNavigate={close} />
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <ConfirmPaymentDrawer target={payTarget} onClose={() => setPayTarget(null)} />
      <BindAttendanceCardDialog target={bindTarget} onClose={() => setBindTarget(null)} />
    </>
  );
};

const UrgentTab = ({
  todos,
  onNavigate,
  onShowReminders,
  onBind,
  onPay,
}: {
  todos: Todos;
  onNavigate: () => void;
  onShowReminders: () => void;
  onBind: (target: BindCardTarget) => void;
  onPay: (target: ConfirmPaymentTarget) => void;
}) => {
  const unpaidTotal = todos.unpaidCards.reduce((sum, item) => sum + item.finalPrice, 0);
  const otherReminders =
    todos.trialFollowUps.length + todos.possibleDuplicates.length;

  return (
    <>
      {todos.urgentCount === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-neutral-500">要處理的都處理完了</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-3 pb-2">
          <SummaryTile
            tone="danger"
            title="點名沒課卡"
            value={todos.unboundAttendance.length}
            unit="位"
            hint="這幾堂沒扣到"
          />
          <SummaryTile
            tone="warning"
            title="買卡未付款"
            value={todos.unpaidCards.length}
            unit="筆"
            hint={`共 NT$${formatMoney(unpaidTotal)} 待收`}
          />
        </div>
      )}

      <TodoSection title="點名沒課卡" count={todos.unboundAttendance.length} dot="bg-danger-600">
        {todos.unboundAttendance.map((item) => (
          <TodoRow
            key={`unbound-${item.id}`}
            href={`/lessons/${item.lessonId}/periods/${item.lessonPeriodId}/check-success`}
            student={item.student}
            onNavigate={onNavigate}
            subtitle={
              <span className="block truncate">
                {formatDate(item.lessonPeriodStartTime)} {item.lessonName}
                {item.source === "STUDENT" && "（自助簽到）"}
              </span>
            }
            action={
              <Button
                size="sm"
                onClick={() =>
                  onBind({
                    lessonId: item.lessonId,
                    lessonPeriodId: item.lessonPeriodId,
                    lessonName: item.lessonName,
                    lessonPeriodStartTime: item.lessonPeriodStartTime,
                    studentId: item.student.id,
                    studentName: item.student.name,
                  })
                }
              >
                補卡
              </Button>
            }
          />
        ))}
      </TodoSection>

      <TodoSection title="買卡未付款" count={todos.unpaidCards.length} dot="bg-warning-600">
        {todos.unpaidCards.map((item) => {
          const days = daysSince(item.createdAt);
          return (
            <TodoRow
              key={`unpaid-${item.id}`}
              href={studentDetailHref(item.student.id)}
              student={item.student}
              onNavigate={onNavigate}
              tag={
                <StatusTag tone={days > UNPAID_OVERDUE_DAYS ? "danger" : "neutral"}>
                  未付 {days} 天
                </StatusTag>
              }
              subtitle={
                <>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{item.cardName}</span>
                    <CardSerial serialNumber={item.serialNumber} />
                  </span>
                  {item.usedSessions > 0 && (
                    <span className="block text-xs">已用 {item.usedSessions} / {item.totalSessions} 堂</span>
                  )}
                </>
              }
              action={
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-neutral-900">
                    ${formatMoney(item.finalPrice)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      onPay({
                        studentId: item.student.id,
                        studentCardId: item.id,
                        studentName: item.student.name,
                        cardName: item.cardName,
                        serialNumber: item.serialNumber,
                        finalPrice: item.finalPrice,
                      })
                    }
                  >
                    確認收款
                  </Button>
                </div>
              }
            />
          );
        })}
      </TodoSection>

      {todos.reminderCount > 0 && (
        <button
          type="button"
          onClick={onShowReminders}
          className="mx-3 mt-2 flex items-center gap-3 rounded-xl bg-neutral-100 px-3.5 py-3 text-left hover:bg-neutral-200/70 cursor-pointer"
        >
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-neutral-900">
              還有 {todos.reminderCount} 件提醒
            </span>
            <span className="text-xs text-neutral-600">
              {[
                todos.needsRenewal.length > 0 && `下次會沒卡 ${todos.needsRenewal.length}`,
                otherReminders > 0 && `其他 ${otherReminders}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <ChevronRight className="size-4 text-neutral-500" />
        </button>
      )}
    </>
  );
};

const RemindersTab = ({ todos, onNavigate }: { todos: Todos; onNavigate: () => void }) => (
  <>
    {todos.reminderCount === 0 && (
      <p className="px-4 py-6 text-center text-sm text-neutral-500">目前沒有提醒</p>
    )}

    <TodoSection
      title="下次上課會沒卡"
      hint="課卡用完、近 30 天有來上課"
      count={todos.needsRenewal.length}
    >
      {todos.needsRenewal.map((item) => (
        <TodoRow
          key={`renewal-${item.student.id}`}
          href={studentDetailHref(item.student.id)}
          student={item.student}
          onNavigate={onNavigate}
          subtitle={`課卡已用完 · 上次上課 ${formatDate(item.lastAttendedAt)}`}
          action={
            item.lastRemindedAt ? (
              <StatusTag tone="positive">LINE 已提醒 {formatShortDate(item.lastRemindedAt)}</StatusTag>
            ) : !item.lineBound ? (
              <StatusTag tone="neutral">未綁 LINE</StatusTag>
            ) : null
          }
        />
      ))}
    </TodoSection>

    <TodoSection
      title="體驗後還沒買卡"
      hint="上完體驗課 14 天內"
      count={todos.trialFollowUps.length}
    >
      {todos.trialFollowUps.map((item) => (
        <TodoRow
          key={`trial-${item.student.id}`}
          href={studentDetailHref(item.student.id)}
          student={item.student}
          onNavigate={onNavigate}
          subtitle={
            <span className="block truncate">
              {formatDate(item.trialAt)} 體驗 {item.lessonName}
            </span>
          }
        />
      ))}
    </TodoSection>

    <TodoSection title="可能重複" hint="同名學員，確認後合併" count={todos.possibleDuplicates.length}>
      {todos.possibleDuplicates.map((group) => {
        // Newest is usually the one that registered itself at the door;
        // open it with the oldest preselected as the merge target.
        const newest = group.students[group.students.length - 1];
        const oldest = group.students[0];
        return (
          <TodoRow
            key={`dup-${newest.id}`}
            href={`${studentDetailHref(newest.id)}?mergeInto=${oldest.id}`}
            student={newest}
            onNavigate={onNavigate}
            subtitle={`${group.students.length} 位同名 · 可能是同一人，確認後合併`}
          />
        );
      })}
    </TodoSection>

    {todos.inactiveRenewalCount > 0 && (
      <div className="mx-3 mt-2 rounded-xl border border-dashed border-neutral-300 px-3.5 py-3">
        <p className="text-sm font-semibold text-neutral-900">
          久未上課 {todos.inactiveRenewalCount} 位
        </p>
        <p className="text-xs text-neutral-600">
          課卡用完、超過 30 天沒來，不列在這裡；在學生列表用「需續約」篩選查看
        </p>
      </div>
    )}
  </>
);

const daysSince = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

const formatShortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const CountPill = ({ tone, children }: { tone: "danger" | "neutral"; children: ReactNode }) => (
  <span
    className={`min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold flex items-center justify-center ${
      tone === "danger" ? "bg-danger-600 text-white" : "bg-neutral-200 text-neutral-700"
    }`}
  >
    {children}
  </span>
);

const SummaryTile = ({
  tone,
  title,
  value,
  unit,
  hint,
}: {
  tone: "danger" | "warning";
  title: string;
  value: number;
  unit: string;
  hint: string;
}) => (
  <div
    className={`flex flex-col gap-0.5 rounded-xl border p-3 ${
      tone === "danger"
        ? "bg-danger-50 border-danger-200 text-danger-700"
        : "bg-warning-100 border-warning-300 text-warning-950"
    }`}
  >
    <span className="text-[13px] font-medium">{title}</span>
    <span className="text-2xl font-bold leading-tight">
      {value}
      <span className="ml-0.5 text-[13px] font-medium">{unit}</span>
    </span>
    <span className="text-xs">{hint}</span>
  </div>
);

const TodoSection = ({
  title,
  hint,
  count,
  dot,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  /** 要處理那兩類的色點 */
  dot?: string;
  children: ReactNode;
}) => {
  if (count === 0) return null;
  return (
    <section className="flex flex-col">
      <div className="px-4 pt-3 pb-1">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-600">
          {dot && <span className={`size-2 rounded-full ${dot}`} />}
          {title}（{count}）
        </h3>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
};

const TodoRow = ({
  href,
  student,
  subtitle,
  tag,
  action,
  onNavigate,
}: {
  href: string;
  student: TodoStudent;
  subtitle: ReactNode;
  /** 名字旁的小標籤（未付 N 天） */
  tag?: ReactNode;
  /** 右側：就地操作的按鈕或狀態 */
  action?: ReactNode;
  onNavigate: () => void;
}) => (
  <div className="flex gap-3 items-center px-4 py-2 hover:bg-neutral-50">
    <Link href={href} onClick={onNavigate} className="flex flex-1 min-w-0 gap-3 items-center">
      <img
        src={student.avatarUrl}
        alt=""
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-neutral-900 truncate">{student.name}</span>
          {tag}
        </span>
        <span className="text-[13px] text-neutral-600 min-w-0">{subtitle}</span>
      </div>
    </Link>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default TodoBell;
