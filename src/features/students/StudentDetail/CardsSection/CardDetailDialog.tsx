"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Ban,
  Ellipsis,
  Forward,
  PencilLine,
  Repeat2,
  Trash2,
  X,
} from "lucide-react";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import Drawer from "@/components/Drawer";
import ConfirmPaymentDrawer from "@/features/students/ConfirmPaymentDrawer";
import {
  StudentCardWithCard,
  useDeleteStudentCardMutation,
  useExpireStudentCardMutation,
  useUpdateStudentCardNoteMutation,
} from "@/store/slices/students";
import type { DanceLevels } from "@/domains/qualification";
import { residualValueOf } from "@/domains/cardConversion";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatMoney } from "@/lib/money";
import ConvertCard from "./ConvertCard";
import TransferCard from "./TransferCard";
import SessionDots from "./SessionDots";
import { buildCardTimeline, paidAtPurchase, type CardTimelineEntry } from "./cardTimeline";
import { cardOutcome, isCardEnded, isLowRemaining, lastUsedAt, type CardOutcome } from "./cardStatus";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fieldControlClass } from "@/components/Field";
import StatusTag from "@/components/StatusTag";
import MenuItem from "@/components/MenuItem";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
/** 紀錄預設只列這麼多筆，其餘收在「再顯示 N 筆」後面。 */
const INITIAL_ENTRIES = 6;

const OUTCOME_TAG: Record<CardOutcome, string> = {
  transferred: "已轉讓",
  converted: "已轉換",
  usedUp: "用完",
  expired: "已停用",
};

const fullDate = (value: string | number) => format(new Date(value), "yyyy/M/d");
const paymentMethodLabel = (method: string | null | undefined) =>
  method === "TRANSFER" ? "轉帳" : method === "CASH" ? "現金" : null;

/**
 * 一張課卡的詳情，沒有框：大字剩幾堂＋每堂一顆圓點、一列一件的事實清單
 * （購買日／售價／付款／剩餘價值／來源／備註）、「紀錄」時間線（購買、收款、上課、
 * 轉換、轉讓、停用排成一條），底下轉讓／轉換／備註是文字按鈕，停用與刪除收在「⋯」；
 * 未付款時「確認收款」是唯一的實心按鈕。手機是底部面板、桌面是置中對話框。
 *
 * 一個課卡分頁只掛一份：`studentCard` 由呼叫端依選到的 id 從最新資料找出來，
 * 所以 mutation 後畫面會跟著更新。
 */
const CardDetailDialog = ({
  studentCard,
  studentName,
  danceLevels = {},
  open,
  onClose,
  isPublic = false,
  onJumpToCard,
}: {
  studentCard: StudentCardWithCard | null;
  studentName: string;
  danceLevels?: DanceLevels;
  open: boolean;
  onClose: () => void;
  isPublic?: boolean;
  /** 點同一位學生轉換鏈另一端的卡時，關掉對話框、捲到那張卡 */
  onJumpToCard?: (studentCardId: number) => void;
}) => {
  const [expireStudentCard, { isLoading: isExpiring }] = useExpireStudentCardMutation();
  const [deleteStudentCard, { isLoading: isDeleting }] = useDeleteStudentCardMutation();
  const [updateNote, { isLoading: isSavingNote }] = useUpdateStudentCardNoteMutation();
  const [pendingAction, setPendingAction] = useState<"pay" | "expire" | "delete" | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);

  // 還沒點過任何一張卡。
  if (!studentCard) return null;

  const ended = isCardEnded(studentCard);
  const outcome = ended ? cardOutcome(studentCard) : null;
  const low = !ended && isLowRemaining(studentCard);
  const isUnpaid = studentCard.isPaid === false;
  const usedSessions = studentCard.totalSessions - studentCard.remainingSessions;
  const convertedFrom = studentCard.convertedFrom ?? [];
  const convertedTo = studentCard.convertedTo ?? null;
  const transferredTo = studentCard.transferredTo ?? null;
  const transferredFrom = studentCard.transferredFrom ?? null;
  const isPurchase = studentCard.origin === "PURCHASE";
  const inChain =
    !!studentCard.convertedToId || !!transferredTo || !!transferredFrom || convertedFrom.length > 0;
  // 停用：還有效的卡才需要；刪除：買錯卡用，只有沒扣過、也不在轉換／轉讓鏈上的卡才安全。
  const canExpire = !ended;
  const canDelete = studentCard.attendanceRecords.length === 0 && !inChain;
  // 轉換、轉讓只對還有效、已收款的卡開放——未付款的卡轉過去，那筆欠款就消失了。
  const canMove = !ended && !isUnpaid;
  const canTransfer = canMove && !studentCard.card.isTrial;
  const serial = formatCardSerial(studentCard.serialNumber);
  const ids = { id: studentCard.studentId, studentCardId: studentCard.id };
  const timeline = buildCardTimeline(studentCard);
  const shownEntries = showAllEntries ? timeline : timeline.slice(0, INITIAL_ENTRIES);
  const hiddenEntries = timeline.length - shownEntries.length;
  const lastUse = lastUsedAt(studentCard);

  const run = async (action: () => Promise<unknown>, success: string, failure: string, closeAfter = false) => {
    try {
      await action();
      toast.success(success);
      if (closeAfter) onClose();
    } catch {
      toast.error(failure);
    } finally {
      setPendingAction(null);
    }
  };

  const handleSaveNote = async () => {
    try {
      await updateNote({ ...ids, note: noteDraft.trim() || null }).unwrap();
      toast.success("已更新備註");
      setNoteOpen(false);
    } catch {
      toast.error("更新備註失敗");
    }
  };

  const jump = onJumpToCard
    ? (studentCardId: number) => {
        onClose();
        onJumpToCard(studentCardId);
      }
    : undefined;

  /** 另一位學生的卡：老師端連到那位學生，公開頁只寫編號。 */
  const otherStudentCard = (link: { serialNumber: number; student?: { id: number; name: string } }) =>
    link.student && !isPublic ? (
      <Link href={`/students/${link.student.id}`} className="text-primary-800 hover:text-primary-900 font-semibold">
        {link.student.name} {formatCardSerial(link.serialNumber)}
      </Link>
    ) : (
      <span className="font-semibold">{formatCardSerial(link.serialNumber)}</span>
    );

  /** 同一位學生的另一張卡（轉換鏈）：能跳就做成按鈕。 */
  const sameStudentCard = (link: { id: number; serialNumber: number }) =>
    jump ? (
      <button
        type="button"
        onClick={() => jump(link.id)}
        className="text-primary-800 hover:text-primary-900 font-semibold cursor-pointer"
      >
        {formatCardSerial(link.serialNumber)}
      </button>
    ) : (
      <span className="font-semibold">{formatCardSerial(link.serialNumber)}</span>
    );

  const purchaseMeta = () => {
    const parts: string[] = [];
    if (!isPublic) {
      parts.push(
        studentCard.purchaseSource === "STUDENT"
          ? "學生在 LINE 自購"
          : `${studentCard.purchasedBy?.name ?? "後台"} 登記`
      );
    }
    parts.push(`$${formatMoney(studentCard.finalPrice)}`);
    if (!isPublic && paidAtPurchase(studentCard) && studentCard.finalPrice > 0) {
      const method = paymentMethodLabel(studentCard.paymentMethod);
      if (method) parts.push(method);
      if (studentCard.paidBy?.name) parts.push(`${studentCard.paidBy.name} 收`);
    }
    return parts.join(" · ");
  };

  const describe = (entry: CardTimelineEntry): { title: React.ReactNode; meta?: string; tag?: React.ReactNode } => {
    switch (entry.kind) {
      case "purchase":
        return { title: `購買 ${studentCard.totalSessions} 堂`, meta: purchaseMeta() };
      case "convertedFrom":
        return {
          title: (
            <>
              由{" "}
              {convertedFrom.map((from, index) => (
                <span key={from.id}>
                  {index > 0 && "、"}
                  {sameStudentCard(from)}
                </span>
              ))}{" "}
              轉換而來
            </>
          ),
          meta: `${studentCard.totalSessions} 堂 · 帶入價值 $${formatMoney(studentCard.finalPrice)}`,
        };
      case "transferredIn":
        return {
          title: transferredFrom ? (
            <>
              從 {otherStudentCard(transferredFrom)} 轉入 {studentCard.totalSessions} 堂
            </>
          ) : (
            `轉入 ${studentCard.totalSessions} 堂`
          ),
          meta: `帶入價值 $${formatMoney(studentCard.finalPrice)}`,
        };
      case "payment": {
        const method = paymentMethodLabel(studentCard.paymentMethod);
        const meta = [
          method,
          studentCard.paymentReference ? `末五碼 ${studentCard.paymentReference}` : null,
          studentCard.paidBy?.name ? `${studentCard.paidBy.name} 收` : null,
        ].filter(Boolean);
        return { title: `收款 $${formatMoney(studentCard.finalPrice)}`, meta: meta.join(" · ") || undefined };
      }
      case "use":
        return {
          title: `上課 · ${entry.lessonName}`,
          meta: `${format(entry.at, "HH:mm")} · 扣 ${entry.sessionsUsed} 堂 · ${entry.source === "STUDENT" ? "學生自助簽到" : "老師點名"}`,
          tag: entry.pending ? <StatusTag tone="warning">待老師確認</StatusTag> : undefined,
        };
      case "transferredOut":
        return {
          title: transferredTo ? (
            <>
              轉讓 {studentCard.remainingSessions} 堂給 {otherStudentCard(transferredTo)}
            </>
          ) : (
            `轉讓 ${studentCard.remainingSessions} 堂`
          ),
        };
      case "convertedTo":
        return {
          title: convertedTo ? (
            <>
              轉換為 {sameStudentCard(convertedTo)}「{convertedTo.card.name}」{convertedTo.totalSessions} 堂
            </>
          ) : (
            "轉換"
          ),
          meta: `轉換時剩 ${studentCard.remainingSessions} 堂`,
        };
      case "expired":
        return { title: "停用", meta: `剩 ${studentCard.remainingSessions} 堂沒用到` };
    }
  };

  const nodeClass = (entry: CardTimelineEntry) => {
    switch (entry.kind) {
      case "purchase":
      case "convertedFrom":
      case "transferredIn":
        return "bg-primary-900";
      case "payment":
        return "bg-white border-2 border-primary-700";
      case "transferredOut":
        return "border-2 border-dashed border-primary-700";
      case "convertedTo":
      case "expired":
        return "bg-white border-2 border-neutral-400";
      default:
        return "bg-neutral-300";
    }
  };

  const startLabel = isPurchase ? "購買日" : studentCard.origin === "TRANSFER" ? "轉入日" : "轉換日";
  const priceLabel = isPurchase ? "售價" : "帶入價值";
  const endAt = studentCard.expiredAt ?? (lastUse !== null ? lastUse : null);
  const paidDetail = [
    "已收款",
    paymentMethodLabel(studentCard.paymentMethod),
    studentCard.paymentReference ? `末五碼 ${studentCard.paymentReference}` : null,
    studentCard.paidBy?.name ? `${studentCard.paidBy.name} 收` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const sessionsLabel = ended
    ? `上了 ${usedSessions} 堂，共 ${studentCard.totalSessions} 堂`
    : `剩 ${studentCard.remainingSessions} 堂，共 ${studentCard.totalSessions} 堂`;

  const dots = (
    <SessionDots
      total={studentCard.totalSessions}
      remaining={studentCard.remainingSessions}
      outcome={outcome}
      low={low}
      size="lg"
      label={sessionsLabel}
    />
  );

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        initialFocus="container"
        className="p-0 min-h-0 max-h-[90vh] max-w-[560px] overflow-hidden"
      >
        <div className="flex-none flex items-start justify-between gap-3 px-6 pt-5">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="m-0 truncate text-[13px] tabular-nums text-ink-3">
              {serial} · {studentName}
              {outcome && ` · ${OUTCOME_TAG[outcome]}`}
            </p>
            <ResponsiveDialogTitle className="m-0 text-xl font-semibold leading-tight text-ink">
              {studentCard.card.name}
            </ResponsiveDialogTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            aria-label="關閉"
            className="-mt-1 -mr-2 shrink-0 text-ink-3"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-6 flex flex-col">
          {/* 這張卡現在的樣子：大字堂數、一堂一顆圓點 */}
          <div className="flex flex-col gap-3">
            {ended && outcome ? (
              <EndedHero
                outcome={outcome}
                remaining={studentCard.remainingSessions}
                total={studentCard.totalSessions}
                dots={dots}
                link={
                  outcome === "transferred" && transferredTo
                    ? otherStudentCard(transferredTo)
                    : outcome === "converted" && convertedTo
                      ? sameStudentCard(convertedTo)
                      : null
                }
              />
            ) : (
              <div className="flex items-baseline gap-1.5 leading-none tabular-nums">
                <span className="text-[15px] text-ink-2">剩</span>
                <span
                  className={cn("text-[44px] font-semibold tracking-tight", low ? "text-warning-800" : "text-ink")}
                >
                  {studentCard.remainingSessions}
                </span>
                <span className="text-[15px] text-ink-3">/ {studentCard.totalSessions} 堂</span>
                {low && <span className="ml-1.5 text-[13px] font-semibold text-warning-800">快用完</span>}
              </div>
            )}
            {!ended && dots}
            {!ended && <p className="m-0 text-[13px] tabular-nums text-ink-3">已上 {usedSessions} 堂</p>}
          </div>

          {/* 這張卡的事實：一列一件，細線分隔 */}
          <dl className="m-0 mt-5 divide-y divide-line border-y border-line">
            <Fact label={startLabel}>{fullDate(studentCard.createdAt)}</Fact>
            {transferredFrom && <Fact label="來源">從 {otherStudentCard(transferredFrom)} 轉入</Fact>}
            {convertedFrom.length > 0 && (
              <Fact label="來源">
                由{" "}
                {convertedFrom.map((from, index) => (
                  <span key={from.id}>
                    {index > 0 && "、"}
                    {sameStudentCard(from)}
                  </span>
                ))}{" "}
                轉換
              </Fact>
            )}
            <Fact label={priceLabel}>${formatMoney(studentCard.finalPrice)}</Fact>
            {/* 未付款只在這裡寫一次，「確認收款」是底下唯一的實心按鈕 */}
            {!isPublic && isUnpaid && (
              <Fact label="付款" hint={!ended ? "收款後才能轉讓或轉換" : undefined}>
                <span className="font-semibold text-warning-800">未付款 ${formatMoney(studentCard.finalPrice)}</span>
              </Fact>
            )}
            {!isPublic && !isUnpaid && isPurchase && studentCard.finalPrice > 0 && (
              <Fact label="付款">{paidDetail}</Fact>
            )}
            {ended ? (
              <Fact label="結束日">{endAt !== null ? fullDate(endAt) : "—"}</Fact>
            ) : (
              <Fact label="剩餘價值">${formatMoney(residualValueOf(studentCard))}</Fact>
            )}
            {studentCard.note && (
              <Fact label="備註">
                <span className="whitespace-pre-line font-normal">{studentCard.note}</span>
              </Fact>
            )}
          </dl>

          <section className="mt-7 flex flex-col gap-3">
            <h3 className="m-0 text-[15px] font-semibold text-ink">紀錄</h3>
            <ol className="m-0 p-0 list-none flex flex-col">
              {shownEntries.map((entry, index) => {
                const { title, meta, tag } = describe(entry);
                const isLast = index === shownEntries.length - 1 && hiddenEntries === 0;
                return (
                  <li
                    key={`${entry.kind}-${entry.at}-${index}`}
                    className="grid grid-cols-[48px_16px_minmax(0,1fr)_auto] gap-x-3 items-start"
                  >
                    <div className="flex flex-col pt-px">
                      <span className="text-sm font-semibold text-ink tabular-nums">{format(entry.at, "M/d")}</span>
                      <span className="text-xs text-ink-3">週{WEEKDAYS[new Date(entry.at).getDay()]}</span>
                    </div>
                    <div aria-hidden className="flex flex-col items-center self-stretch pt-[5px]">
                      <span className={cn("size-2.5 rounded-full box-border shrink-0", nodeClass(entry))} />
                      {!isLast && <span className="w-px flex-1 bg-line mt-1" />}
                    </div>
                    <div className={cn("flex flex-col gap-0.5 min-w-0", !isLast && "pb-5")}>
                      <span className="text-sm font-medium text-ink">{title}</span>
                      {meta && <span className="text-[13px] tabular-nums text-ink-3">{meta}</span>}
                    </div>
                    <span>{tag}</span>
                  </li>
                );
              })}
            </ol>
            {hiddenEntries > 0 && (
              <Button
                type="button"
                variant="text"
                size="sm"
                className="-ml-2 self-start"
                onClick={() => setShowAllEntries(true)}
              >
                再顯示 {hiddenEntries} 筆
              </Button>
            )}
          </section>
        </div>

        {!isPublic && (
          <div className="flex-none flex items-center gap-1 border-t border-line px-4 py-3">
            {canTransfer && (
              <Button type="button" variant="text" onClick={() => setTransferOpen(true)}>
                <Forward className="size-[17px]" aria-hidden />
                轉讓
              </Button>
            )}
            {canMove && (
              <Button type="button" variant="text" onClick={() => setConvertOpen(true)}>
                <Repeat2 className="size-[17px]" aria-hidden />
                轉換
              </Button>
            )}
            <Button
              type="button"
              variant="text"
              onClick={() => {
                setNoteDraft(studentCard.note ?? "");
                setNoteOpen(true);
              }}
            >
              <PencilLine className="size-[17px]" aria-hidden />
              {studentCard.note ? "編輯備註" : "備註"}
            </Button>
            {(canExpire || canDelete) && (
              <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="更多操作" className="text-ink-2">
                    <Ellipsis className="size-[18px]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="top" className="w-60 p-1.5">
                  {canExpire && (
                    <MenuItem
                      icon={<Ban className="size-4" aria-hidden />}
                      onClick={() => {
                        setMoreOpen(false);
                        setPendingAction("expire");
                      }}
                    >
                      停用卡片
                    </MenuItem>
                  )}
                  {canDelete && (
                    <MenuItem
                      danger
                      icon={<Trash2 className="size-4" aria-hidden />}
                      onClick={() => {
                        setMoreOpen(false);
                        setPendingAction("delete");
                      }}
                    >
                      刪除（買錯卡時用）
                    </MenuItem>
                  )}
                </PopoverContent>
              </Popover>
            )}
            {isUnpaid && (
              <Button type="button" onClick={() => setPendingAction("pay")} className="ml-auto">
                確認收款
              </Button>
            )}
          </div>
        )}
      </ResponsiveDialog>

      <ConfirmPaymentDrawer
        target={
          pendingAction === "pay"
            ? {
                studentId: studentCard.studentId,
                studentCardId: studentCard.id,
                studentName,
                cardName: studentCard.card.name,
                serialNumber: studentCard.serialNumber,
                finalPrice: studentCard.finalPrice,
              }
            : null
        }
        onClose={() => setPendingAction(null)}
      />
      <ConfirmDialog
        variant="danger"
        open={pendingAction === "expire"}
        title="停用卡片"
        message={`確定要停用「${studentCard.card.name}」嗎？停用後剩餘的 ${studentCard.remainingSessions} 堂將無法再使用。`}
        confirmLabel="停用"
        isLoading={isExpiring}
        onConfirm={() => run(() => expireStudentCard(ids).unwrap(), "已停用卡片", "停用失敗")}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        variant="danger"
        open={pendingAction === "delete"}
        title="刪除卡片"
        message={`確定要刪除「${studentCard.card.name}」嗎？此操作無法復原，通常用於買錯卡片的情況。`}
        confirmLabel="刪除"
        isLoading={isDeleting}
        onConfirm={() => run(() => deleteStudentCard(ids).unwrap(), "已刪除卡片", "刪除失敗", true)}
        onCancel={() => setPendingAction(null)}
      />

      <ConvertCard
        studentCard={studentCard}
        danceLevels={danceLevels}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
      />
      <TransferCard
        studentCard={studentCard}
        studentName={studentName}
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
      />

      <Drawer
        title="卡片備註"
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        onSubmit={handleSaveNote}
        submitText="儲存"
        isLoading={isSavingNote}
      >
        <textarea
          className={cn(fieldControlClass(), "py-3")}
          aria-label="卡片備註"
          rows={4}
          maxLength={500}
          value={noteDraft}
          placeholder="例：朋友介紹、先繳一半"
          onChange={(e) => setNoteDraft(e.target.value)}
        />
        <p className="text-xs text-ink-3 mt-1">留白即清除備註。</p>
      </Drawer>
    </>
  );
};

/** 一件事實一列：左邊名稱（淺字）、右邊內容；`hint` 是內容下面的一行說明。 */
const Fact = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-6 py-2.5">
    <dt className="shrink-0 text-sm text-ink-3">{label}</dt>
    <dd className="m-0 flex min-w-0 flex-col items-end gap-0.5 text-right text-sm font-medium tabular-nums text-ink">
      <span className="min-w-0 break-words">{children}</span>
      {hint && <span className="text-[13px] font-normal text-ink-3">{hint}</span>}
    </dd>
  </div>
);

/** 已結束的卡的開頭：怎麼結束的、那幾堂、轉去哪裡。 */
const EndedHero = ({
  outcome,
  remaining,
  total,
  dots,
  link,
}: {
  outcome: CardOutcome;
  remaining: number;
  total: number;
  /** 圓點排在大字和說明中間，跟有效的卡同一個順序。 */
  dots: React.ReactNode;
  link: React.ReactNode;
}) => {
  const used = total - remaining;
  const { label, sessions, legend } = {
    transferred: { label: "轉讓出去", sessions: remaining, legend: `自己上了 ${used} 堂 · 轉讓 ${remaining} 堂` },
    converted: { label: "轉換時剩", sessions: remaining, legend: `上了 ${used} 堂 · 轉換 ${remaining} 堂` },
    usedUp: { label: "全部上完", sessions: total, legend: null },
    expired: { label: "停用時剩", sessions: remaining, legend: `上了 ${used} 堂 · ${remaining} 堂沒用到` },
  }[outcome];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-1.5 leading-none tabular-nums">
        <span className="text-[15px] text-ink-2">{label}</span>
        <span className="text-[44px] font-semibold tracking-tight text-ink">{sessions}</span>
        <span className="text-[15px] text-ink-3">堂</span>
      </div>
      {dots}
      {(legend || link) && (
        <p className="m-0 text-[13px] tabular-nums text-ink-3">
          {legend}
          {legend && link && " · "}
          {link && (
            <>
              {outcome === "transferred" ? "給" : "轉成"} {link}
            </>
          )}
        </p>
      )}
    </div>
  );
};

export default CardDetailDialog;
