"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Ban,
  Check,
  CircleDollarSign,
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

const actionButton =
  "flex-1 min-w-0 h-11 rounded-xl border border-primary-300 bg-white text-primary-900 text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-primary-50 transition-colors";

/**
 * 一張課卡的詳情：票根（剩幾堂、每堂一顆圓點、購買／售價／剩餘價值）、收款、
 * 「紀錄」時間線（購買、收款、上課、轉換、轉讓、停用排成一條），以及
 * 轉讓／轉換／備註，停用與刪除收在「⋯」。手機是底部面板、桌面是置中對話框。
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
      <Link href={`/students/${link.student.id}`} className="text-primary-700 hover:text-primary-900 font-semibold">
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
        className="text-primary-700 hover:text-primary-900 font-semibold cursor-pointer"
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
          meta: `${format(entry.at, "HH:mm")} · 扣 1 堂 · ${entry.source === "STUDENT" ? "學生自助簽到" : "老師點名"}`,
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

  const startLabel = isPurchase ? "購買" : studentCard.origin === "TRANSFER" ? "轉入" : "轉換";
  const priceLabel = isPurchase ? "售價" : "帶入價值";
  const endAt = studentCard.expiredAt ?? (lastUse !== null ? lastUse : null);

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        className="p-0 min-h-0 max-h-[90vh] max-w-[560px] overflow-hidden"
      >
        <div className="flex-none flex flex-col gap-1.5 px-6 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 text-[13px] text-neutral-600">
              <span className="shrink-0 rounded-sm bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700 tabular-nums">
                {serial}
              </span>
              <span className="truncate">{studentName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {outcome && <StatusTag tone="neutral">{OUTCOME_TAG[outcome]}</StatusTag>}
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={onClose}
                aria-label="關閉"
                className="-mr-2 text-neutral-500"
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>
          <ResponsiveDialogTitle
            className={cn("text-[22px] font-extrabold leading-tight", ended ? "text-neutral-700" : "text-neutral-900")}
          >
            {studentCard.card.name}
          </ResponsiveDialogTitle>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-6 flex flex-col gap-4">
          {/* 票根 */}
          <div
            className={cn(
              "rounded-2xl border flex flex-col",
              ended ? "bg-neutral-50 border-neutral-200" : "bg-primary-50 border-primary-100"
            )}
          >
            <div className="px-5 py-5 flex flex-col gap-4">
              {ended && outcome ? (
                <EndedHero
                  outcome={outcome}
                  remaining={studentCard.remainingSessions}
                  total={studentCard.totalSessions}
                  link={
                    outcome === "transferred" && transferredTo
                      ? otherStudentCard(transferredTo)
                      : outcome === "converted" && convertedTo
                        ? sameStudentCard(convertedTo)
                        : null
                  }
                />
              ) : (
                <div className="flex items-end justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-primary-900">剩餘</span>
                    <div className="flex items-baseline gap-2 leading-none tabular-nums">
                      <span
                        className={cn(
                          "text-[56px] font-extrabold tracking-tight",
                          low ? "text-warning-950" : "text-primary-900"
                        )}
                      >
                        {studentCard.remainingSessions}
                      </span>
                      <span className="text-base font-semibold text-primary-900">/ {studentCard.totalSessions} 堂</span>
                    </div>
                  </div>
                  <span className="pb-1.5 text-[13px] text-neutral-700">已上 {usedSessions} 堂</span>
                </div>
              )}
              <SessionDots
                total={studentCard.totalSessions}
                remaining={studentCard.remainingSessions}
                outcome={outcome}
                low={low}
                size="lg"
              />
            </div>
            <div
              aria-hidden
              className={cn(
                "mx-4 border-t-[1.5px] border-dashed",
                ended ? "border-neutral-200" : "border-primary-300"
              )}
            />
            <dl className="m-0 px-5 pt-3.5 pb-4 grid grid-cols-3 gap-3">
              <Stat label={startLabel} value={fullDate(studentCard.createdAt)} />
              <Stat label={priceLabel} value={`$${formatMoney(studentCard.finalPrice)}`} />
              {ended ? (
                <Stat label="結束" value={endAt !== null ? fullDate(endAt) : "—"} />
              ) : (
                <Stat label="剩餘價值" value={`$${formatMoney(residualValueOf(studentCard))}`} />
              )}
            </dl>
          </div>

          {/* 收款：未付款只在這裡出現一次，按鈕就在旁邊 */}
          {!isPublic && isUnpaid && (
            <div className="flex items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3.5">
              <CircleDollarSign className="size-[22px] shrink-0 text-warning-950" aria-hidden />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-warning-950">
                <span className="text-[15px] font-bold">還沒收款 ${formatMoney(studentCard.finalPrice)}</span>
                {!ended && <span className="text-[13px]">收款後才能轉讓或轉換</span>}
              </div>
              <Button type="button" onClick={() => setPendingAction("pay")} className="shrink-0">
                確認收款
              </Button>
            </div>
          )}
          {!isPublic && !isUnpaid && isPurchase && studentCard.finalPrice > 0 && (
            <p className="m-0 flex items-center gap-2 text-sm text-neutral-600">
              <Check className="size-[18px] shrink-0 text-primary-700" strokeWidth={2.2} aria-hidden />
              <span>
                已收款 ${formatMoney(studentCard.finalPrice)}
                {paymentMethodLabel(studentCard.paymentMethod) ? ` · ${paymentMethodLabel(studentCard.paymentMethod)}` : ""}
                {studentCard.paidBy?.name ? ` · ${studentCard.paidBy.name} 收` : ""}
              </span>
            </p>
          )}

          {studentCard.note && (
            <p className="m-0 text-sm text-neutral-700 whitespace-pre-line bg-neutral-50 rounded-xl px-3.5 py-2.5">
              {studentCard.note}
            </p>
          )}

          <section className="flex flex-col gap-3 mt-2">
            <h3 className="m-0 text-[15px] font-bold text-neutral-900">紀錄</h3>
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
                      <span className="text-sm font-bold text-neutral-900 tabular-nums">{format(entry.at, "M/d")}</span>
                      <span className="text-xs text-neutral-500">週{WEEKDAYS[new Date(entry.at).getDay()]}</span>
                    </div>
                    <div aria-hidden className="flex flex-col items-center self-stretch pt-[5px]">
                      <span className={cn("size-2.5 rounded-full box-border shrink-0", nodeClass(entry))} />
                      {!isLast && <span className="w-0.5 flex-1 bg-neutral-100 mt-1" />}
                    </div>
                    <div className={cn("flex flex-col gap-0.5 min-w-0", !isLast && "pb-5")}>
                      <span className="text-sm font-semibold text-neutral-900">{title}</span>
                      {meta && <span className="text-[13px] text-neutral-500">{meta}</span>}
                    </div>
                    <span>{tag}</span>
                  </li>
                );
              })}
            </ol>
            {hiddenEntries > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => setShowAllEntries(true)}
              >
                再顯示 {hiddenEntries} 筆
              </Button>
            )}
          </section>
        </div>

        {!isPublic && (
          <div className="flex-none flex gap-2 border-t border-neutral-100 px-6 pt-4 pb-5">
            {canTransfer && (
              <button type="button" className={actionButton} onClick={() => setTransferOpen(true)}>
                <Forward className="size-[17px] shrink-0" aria-hidden />
                轉讓
              </button>
            )}
            {canMove && (
              <button type="button" className={actionButton} onClick={() => setConvertOpen(true)}>
                <Repeat2 className="size-[17px] shrink-0" aria-hidden />
                轉換
              </button>
            )}
            <button
              type="button"
              className={actionButton}
              onClick={() => {
                setNoteDraft(studentCard.note ?? "");
                setNoteOpen(true);
              }}
            >
              <PencilLine className="size-[17px] shrink-0" aria-hidden />
              {studentCard.note ? "編輯備註" : "備註"}
            </button>
            {(canExpire || canDelete) && (
              <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="更多操作"
                    className="size-11 shrink-0 rounded-xl border border-neutral-300 bg-white text-neutral-700 flex items-center justify-center cursor-pointer hover:bg-neutral-50"
                  >
                    <Ellipsis className="size-[18px]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" side="top" className="w-60 p-1.5">
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
        <p className="text-xs text-neutral-500 mt-1">留白即清除備註。</p>
      </Drawer>
    </>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <dt className="text-xs text-neutral-600">{label}</dt>
    <dd className="m-0 text-[15px] font-bold text-neutral-900 tabular-nums truncate">{value}</dd>
  </div>
);

/** 已結束的卡的票根上半：怎麼結束的、那幾堂、轉去哪裡。 */
const EndedHero = ({
  outcome,
  remaining,
  total,
  link,
}: {
  outcome: CardOutcome;
  remaining: number;
  total: number;
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
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-neutral-600">{label}</span>
        <div className="flex items-baseline gap-2 leading-none tabular-nums">
          <span className="text-[44px] font-extrabold tracking-tight text-neutral-900">{sessions}</span>
          <span className="text-base font-semibold text-neutral-700">堂</span>
        </div>
        {legend && <span className="text-[13px] text-neutral-600">{legend}</span>}
      </div>
      {link && (
        <span className="flex items-center gap-1.5 h-10 rounded-xl border border-primary-300 bg-white px-3.5 text-sm text-primary-900">
          {outcome === "transferred" ? (
            <Forward className="size-4 shrink-0" aria-hidden />
          ) : (
            <Repeat2 className="size-4 shrink-0" aria-hidden />
          )}
          {link}
        </span>
      )}
    </div>
  );
};

export default CardDetailDialog;
