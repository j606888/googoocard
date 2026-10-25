"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Ban,
  CircleDollarSign,
  NotebookPen,
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
import CardStatusPills from "./CardStatusPills";
import { cardEndReason, isCardEnded, isLowRemaining, shortDate } from "./cardStatus";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const actionButton =
  "min-h-12 inline-flex items-center gap-2 px-3 rounded-xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-900 text-left cursor-pointer hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed";

const Tile = ({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) => (
  <div className="bg-neutral-50 rounded-xl px-3 py-2 min-w-0">
    <div className="text-[11px] text-neutral-600">{label}</div>
    <div className={`text-base font-bold tabular-nums truncate ${warn ? "text-danger-600" : "text-neutral-900"}`}>
      {value}
    </div>
  </div>
);

const SourcePill = ({ source, pending }: { source: "TEACHER" | "STUDENT"; pending: boolean }) => {
  const [label, tone] = pending
    ? ["待確認", "bg-warning-100 text-warning-900"]
    : source === "STUDENT"
      ? ["自助簽到", "bg-primary-100 text-primary-900"]
      : ["老師點名", "bg-neutral-100 text-neutral-700"];
  return <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone}`}>{label}</span>;
};

/**
 * 一張課卡的詳情：剩餘／購買日／剩餘價值、轉換鏈、備註、使用紀錄，以及
 * 備註／轉換／確認付款／停用／刪除。手機是底部面板、桌面是置中對話框
 * （ResponsiveDialog）。操作沿用既有的 mutation 與 ConvertCard 抽屜。
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
  /** 點「來自 #A0412」/「已轉換為 #A0873」時關掉對話框、捲到那張卡 */
  onJumpToCard?: (studentCardId: number) => void;
}) => {
  const [expireStudentCard, { isLoading: isExpiring }] = useExpireStudentCardMutation();
  const [deleteStudentCard, { isLoading: isDeleting }] = useDeleteStudentCardMutation();
  const [updateNote, { isLoading: isSavingNote }] = useUpdateStudentCardNoteMutation();
  const [pendingAction, setPendingAction] = useState<"pay" | "expire" | "delete" | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  // 還沒點過任何一張卡。
  if (!studentCard) return null;

  const ended = isCardEnded(studentCard);
  const low = !ended && isLowRemaining(studentCard);
  const isUnpaid = studentCard.isPaid === false;
  const usedSessions = studentCard.totalSessions - studentCard.remainingSessions;
  const convertedFrom = studentCard.convertedFrom ?? [];
  const convertedTo = studentCard.convertedTo ?? null;
  // 停用：還有效的卡才需要；刪除：買錯卡用，只有完全沒扣過的卡才安全。
  const canExpire = !ended;
  const canDelete = studentCard.attendanceRecords.length === 0;
  // 轉換只對「還有剩餘堂數、還沒轉換過」的卡開放；未付款要先確認付款，
  // 不然新卡一律視為已付清、那筆欠款會消失。
  const showConvert = !ended && !studentCard.convertedToId;
  const canConvert = showConvert && !isUnpaid;
  const serial = formatCardSerial(studentCard.serialNumber);
  const ids = { id: studentCard.studentId, studentCardId: studentCard.id };

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

  const jump = (studentCardId: number) => {
    if (!onJumpToCard) return;
    onClose();
    onJumpToCard(studentCardId);
  };

  return (
    <>
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        className="p-0 min-h-0 max-h-[90vh] max-w-[540px] overflow-hidden"
      >
        {/* 標題列 */}
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 flex-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900 leading-tight truncate">
                {studentCard.card.name}
              </ResponsiveDialogTitle>
              <p className="text-xs text-neutral-500 tabular-nums mt-0.5">
                {serial} · {studentName} · {shortDate(studentCard.createdAt)} 購買
                {!isPublic && (
                  <>
                    {" · "}
                    {studentCard.purchaseSource === "STUDENT"
                      ? "學生自購"
                      : `由 ${studentCard.purchasedBy?.name ?? "後台"} 購買`}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-start gap-2 shrink-0">
              <CardStatusPills studentCard={studentCard} showPaid={!ended} />
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="-mr-1 -mt-1 p-1 rounded-lg text-neutral-500 hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {ended ? (
              <>
                <Tile label="使用" value={`${usedSessions} / ${studentCard.totalSessions} 堂`} />
                <Tile label="購買日" value={format(new Date(studentCard.createdAt), "yyyy/M/d")} />
                {/* 轉換的目標卡在下面的轉換鏈，這格只放短的原因 */}
                <Tile label="結束" value={convertedTo ? "已轉換" : cardEndReason(studentCard)} />
              </>
            ) : (
              <>
                <Tile label="剩餘" value={`${studentCard.remainingSessions} / ${studentCard.totalSessions} 堂`} warn={low} />
                <Tile label="購買日" value={format(new Date(studentCard.createdAt), "yyyy/M/d")} />
                <Tile label="剩餘價值" value={`$${formatMoney(residualValueOf(studentCard))}`} />
              </>
            )}
          </div>
        </div>

        {/* 內容 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {(convertedFrom.length > 0 || convertedTo) && (
            <div className="flex flex-col gap-1.5 text-xs">
              {convertedFrom.map((from) => (
                <ConversionLink key={from.id} onClick={onJumpToCard ? () => jump(from.id) : undefined}>
                  來自 <strong className="tabular-nums">{formatCardSerial(from.serialNumber)}</strong> {from.card.name} · 剩{" "}
                  {from.remainingSessions} 堂轉入
                </ConversionLink>
              ))}
              {convertedTo && (
                <ConversionLink onClick={onJumpToCard ? () => jump(convertedTo.id) : undefined}>
                  已轉換為 <strong className="tabular-nums">{formatCardSerial(convertedTo.serialNumber)}</strong>{" "}
                  {convertedTo.card.name} · {convertedTo.totalSessions} 堂
                </ConversionLink>
              )}
            </div>
          )}

          {studentCard.note && (
            <p className="text-sm text-neutral-700 whitespace-pre-line bg-neutral-50 rounded-xl px-3 py-2.5">
              {studentCard.note}
            </p>
          )}

          {!isPublic && (
            <div className="flex items-center justify-between gap-3 text-sm">
              {isUnpaid ? (
                <>
                  <span className="text-danger-600 font-medium">
                    尚未付款 · ${formatMoney(studentCard.finalPrice)}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-success-600 text-white rounded-full px-3 py-1.5 cursor-pointer hover:bg-success-700"
                    onClick={() => setPendingAction("pay")}
                  >
                    <CircleDollarSign className="w-3.5 h-3.5" />
                    確認付款
                  </button>
                </>
              ) : (
                <span className="text-neutral-600">
                  已收款 ${formatMoney(studentCard.finalPrice)}
                  {studentCard.paymentMethod
                    ? ` · ${studentCard.paymentMethod === "TRANSFER" ? "轉帳" : "現金"}`
                    : ""}
                  {studentCard.paymentReference ? ` 末五碼 ${studentCard.paymentReference}` : ""}
                  {studentCard.paidBy?.name ? ` · ${studentCard.paidBy.name} 收` : ""}
                  {studentCard.paidAt ? ` · ${shortDate(studentCard.paidAt)}` : ""}
                </span>
              )}
            </div>
          )}

          <section>
            <h3 className="m-0 mb-1.5 text-[13px] font-semibold text-neutral-700 flex items-center justify-between">
              使用紀錄
              <span className="font-normal text-neutral-500">已用 {usedSessions} 堂</span>
            </h3>
            {studentCard.attendanceRecords.length === 0 ? (
              <p className="text-sm text-neutral-500 border border-dashed border-neutral-200 rounded-xl px-3 py-3 text-center">
                還沒用過
              </p>
            ) : (
              <ul className="m-0 p-0 list-none border border-neutral-200 rounded-xl overflow-hidden">
                {studentCard.attendanceRecords.map((record, index) => {
                  const at = new Date(record.periodStartTime);
                  return (
                    <li
                      key={`${record.periodStartTime}-${index}`}
                      className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-2.5 items-center px-3 py-2 border-t first:border-t-0 border-neutral-100 text-[13px]"
                    >
                      <span className="font-semibold text-neutral-900 tabular-nums">{shortDate(at)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-neutral-900">{record.lessonName}</span>
                        <span className="block text-xs text-neutral-500">
                          週{WEEKDAYS[at.getDay()]} {format(at, "HH:mm")}
                        </span>
                      </span>
                      <SourcePill source={record.source} pending={record.pending} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {!isPublic && (
            <section>
              <h3 className="m-0 mb-1.5 text-[13px] font-semibold text-neutral-700">操作</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={actionButton}
                  onClick={() => {
                    setNoteDraft(studentCard.note ?? "");
                    setNoteOpen(true);
                  }}
                >
                  <NotebookPen className="w-4 h-4 text-primary-900 shrink-0" />
                  {studentCard.note ? "編輯備註" : "卡片備註"}
                </button>
                {showConvert && (
                  <button
                    type="button"
                    className={actionButton}
                    disabled={!canConvert}
                    title={isUnpaid ? "請先確認付款" : undefined}
                    onClick={() => setConvertOpen(true)}
                  >
                    <Repeat2 className="w-4 h-4 text-primary-900 shrink-0" />
                    <span className="min-w-0">
                      轉換成其他卡
                      {isUnpaid && <span className="block text-[11px] font-normal text-neutral-500">請先確認付款</span>}
                    </span>
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        {!isPublic && (canExpire || canDelete) && (
          <div className="flex-none flex items-center justify-center gap-6 px-5 py-3 border-t border-neutral-100">
            {canExpire && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 hover:text-neutral-900 cursor-pointer"
                onClick={() => setPendingAction("expire")}
              >
                <Ban className="w-4 h-4" />
                停用卡片
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger-700 hover:text-danger-600 cursor-pointer"
                onClick={() => setPendingAction("delete")}
              >
                <Trash2 className="w-4 h-4" />
                刪除（買錯卡時用）
              </button>
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
        open={pendingAction === "expire"}
        title="停用卡片"
        message={`確定要停用「${studentCard.card.name}」嗎？停用後剩餘的 ${studentCard.remainingSessions} 堂將無法再使用。`}
        confirmLabel="停用"
        isLoading={isExpiring}
        onConfirm={() => run(() => expireStudentCard(ids).unwrap(), "已停用卡片", "停用失敗")}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
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

      <Drawer
        title="卡片備註"
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        onSubmit={handleSaveNote}
        submitText="儲存"
        isLoading={isSavingNote}
      >
        <textarea
          className="w-full p-2 rounded bg-neutral-100 focus:outline-primary-500 text-sm"
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

const ConversionLink = ({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) => {
  const className =
    "flex items-center gap-2 w-full rounded-xl px-3 py-2 text-left bg-primary-50 border border-primary-200 text-primary-900";
  // 公開頁／LIFF 不給 onClick：只顯示，不做成看起來能點的按鈕。
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} cursor-pointer hover:bg-primary-100`}>
      <Repeat2 className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">{children}</span>
    </button>
  ) : (
    <div className={className}>
      <Repeat2 className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
};

export default CardDetailDialog;
