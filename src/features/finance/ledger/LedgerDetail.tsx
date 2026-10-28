"use client";

import { useId, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Archive, ArrowRight, History, Pencil, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import ResponsiveDialog from "@/components/ResponsiveDialog";
import Select, { textOptions } from "@/components/Select";
import SideSheet from "@/components/SideSheet";
import StatusTag from "@/components/StatusTag";
import { FieldError, fieldControlClass } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import Money, { EXPENSE_TEXT, INCOME_TEXT, moneyText } from "../Money";
import { BRANCH_OPTIONS, FUND_HOLDERS, isoFromShortDate, shortDateFromISO, shortDateLabel, stampNow } from "../mockData";
import type { EntryEvent, EntryField, EntryValues, Transaction, Transfer } from "../types";
import { LabeledControl, LaterAction, NeedsEditNotice } from "../ui";
import { categoriesFor } from "./EntryForm";
import { categoryTone, transferStatus } from "./ledgerDisplay";
import { itemKey, type LedgerItem } from "./ledgerFilters";
import {
  FIELD_LABELS,
  archiveEntry,
  archivedEvent,
  diffEntry,
  editCount,
  editEntry,
  entryValues,
  lastTouched,
  originalValues,
  recordedOf,
  restoreEntry,
} from "./ledgerHistory";

/**
 * 點流水帳的一列打開：誰記的、改過什麼、編輯／封存／還原，轉移則是確認收到。
 * 桌面是右側抽屜，手機是底部抽屜（只掛一棵，docs/ui-responsive.md）。
 */
export default function LedgerDetail({
  open,
  item,
  canEdit,
  onClose,
  onChangeEntry,
  onChangeTransfer,
}: {
  open: boolean;
  /** 關起來時仍是上一筆，退場動畫才有內容 */
  item: LedgerItem | null;
  canEdit: boolean;
  onClose: () => void;
  onChangeEntry: (tx: Transaction) => void;
  onChangeTransfer: (transfer: Transfer) => void;
}) {
  const sizeClass = useSizeClass();
  const content =
    item &&
    (item.kind === "entry" ? (
      <EntryDetail key={itemKey(item)} tx={item.entry} canEdit={canEdit} onClose={onClose} onChange={onChangeEntry} />
    ) : (
      <TransferDetail transfer={item.transfer} canEdit={canEdit} onClose={onClose} onChange={onChangeTransfer} />
    ));

  return sizeClass === "expanded" ? (
    <SideSheet open={open} onClose={onClose}>
      {content}
    </SideSheet>
  ) : (
    <ResponsiveDialog open={open} onClose={onClose} className="max-h-[90vh] p-0">
      {content}
    </ResponsiveDialog>
  );
}

// ── 一筆收支 ──

const fieldText = (field: EntryField, value: string | number) =>
  field === "amount" ? moneyText(Number(value), { sign: true }) : String(value);

type Mode = "view" | "edit" | "archive";

function EntryDetail({
  tx,
  canEdit,
  onClose,
  onChange,
}: {
  tx: Transaction;
  canEdit: boolean;
  onClose: () => void;
  onChange: (tx: Transaction) => void;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const archived = archivedEvent(tx);
  const edits = editCount(tx);

  const restore = () => {
    onChange(restoreEntry(tx, stampNow()));
    toast.success("（示意）已還原，重新算進收支");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailHeader onClose={onClose}>
        <span className="text-sm text-neutral-500">#{tx.id}</span>
        <StatusTag tone={categoryTone(tx)}>{tx.category}</StatusTag>
        {edits > 0 && <StatusTag tone="neutral">已編輯 {edits} 次</StatusTag>}
        {archived && <StatusTag tone="danger">已封存</StatusTag>}
      </DetailHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        {mode === "edit" ? (
          <EntryEditForm
            tx={tx}
            onCancel={() => setMode("view")}
            onSave={(next) => {
              onChange(next);
              setMode("view");
            }}
          />
        ) : (
          <EntrySummary tx={tx} />
        )}

        {archived && mode !== "edit" && (
          <div className="flex flex-col gap-3 rounded-2xl bg-danger-50 px-4 py-3.5">
            <p className="text-sm leading-relaxed text-neutral-800">
              <b className="text-danger-700">{archived.by}</b> 在 {archived.at} 封存了這筆：「{archived.reason}」。
              封存的不算進收支，但會一直留著。
            </p>
            {canEdit && (
              <Button variant="secondary" size="sm" className="self-start" onClick={restore}>
                <RotateCcw className="size-4" />
                還原
              </Button>
            )}
          </div>
        )}

        <RecordBox tx={tx} />
        <EntryHistory tx={tx} />
      </div>

      {mode === "archive" ? (
        <ArchiveConfirm
          onCancel={() => setMode("view")}
          onConfirm={(reason) => {
            onChange(archiveEntry(tx, stampNow(), reason));
            toast.success("（示意）已封存");
            setMode("view");
          }}
        />
      ) : (
        mode === "view" &&
        !archived && (
          <footer className="flex flex-col gap-2 border-t border-neutral-200 px-5 py-4">
            {canEdit ? (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setMode("edit")}>
                  <Pencil className="size-4" />
                  編輯
                </Button>
                <Button variant="dangerSecondary" className="flex-1" onClick={() => setMode("archive")}>
                  <Archive className="size-4" />
                  封存
                </Button>
              </div>
            ) : (
              <NeedsEditNotice action="編輯或封存" />
            )}
          </footer>
        )
      )}
    </div>
  );
}

function EntrySummary({ tx }: { tx: Transaction }) {
  const archived = archivedEvent(tx);
  return (
    <>
      <div className="flex flex-col gap-1">
        <Money
          value={tx.amount}
          sign
          colored={!archived}
          className={cn("text-[34px] font-bold leading-tight", archived && "text-neutral-500 line-through")}
        />
        <Dialog.Title className="text-lg font-semibold text-neutral-900">{tx.description}</Dialog.Title>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-[15px]">
        <Row label="日期">{shortDateLabel(tx.date)}</Row>
        <Row label="據點">{tx.branch}</Row>
        <Row label={tx.amount < 0 ? "錢從誰手上付" : "錢收到誰手上"}>{tx.holder}</Row>
        {tx.amount < 0 && (
          <Row label="收據">
            {tx.missingReceipt ? (
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <span className={EXPENSE_TEXT}>缺收據</span>
                <LaterAction size="sm">補上照片</LaterAction>
              </span>
            ) : (
              "已附"
            )}
          </Row>
        )}
      </dl>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900">{children}</dd>
    </>
  );
}

function RecordBox({ tx }: { tx: Transaction }) {
  const recorded = recordedOf(tx);
  const touched = lastTouched(tx);
  return (
    <section aria-label="記錄" className="flex flex-col gap-2.5 rounded-2xl bg-neutral-50 px-4 py-3.5 text-sm">
      <StampRow stamp={recorded} action="記錄" />
      {touched && <StampRow stamp={touched} action={`最後${EVENT_VERB[touched.type]}`} />}
    </section>
  );
}

function StampRow({ stamp, action }: { stamp: { by: string; at: string }; action: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-100 text-[13px] font-bold text-primary-900"
      >
        {stamp.by.slice(0, 1)}
      </span>
      <span className="flex-1">
        <b>{stamp.by}</b> {action}
      </span>
      <span className="tabular-nums text-neutral-500">{stamp.at}</span>
    </div>
  );
}

const EVENT_VERB: Record<EntryEvent["type"], string> = {
  created: "記錄",
  edited: "修改",
  archived: "封存",
  restored: "還原",
};

const EVENT_DOT: Record<EntryEvent["type"], string> = {
  created: "bg-primary-600",
  edited: "bg-warning-600",
  archived: "bg-danger-500",
  restored: "bg-primary-600",
};

/** 修改紀錄：新到舊，最底下是剛記下來時的樣子。 */
function EntryHistory({ tx }: { tx: Transaction }) {
  const original = originalValues(tx);
  const events = [...tx.history].reverse();
  return (
    <section aria-labelledby="ledger-history" className="flex flex-col gap-3">
      <h3 id="ledger-history" className="flex items-center gap-2 text-base font-bold text-neutral-900">
        <History className="size-[18px] text-neutral-600" aria-hidden="true" />
        修改紀錄
      </h3>
      <ol className="flex flex-col">
        {events.map((event, i) => (
          <li key={`${event.type}-${event.at}-${i}`} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3">
            <span aria-hidden="true" className="flex flex-col items-center">
              <span className={cn("mt-1 size-3 rounded-full", EVENT_DOT[event.type])} />
              {i < events.length - 1 && <span className="w-0.5 flex-1 bg-neutral-200" />}
            </span>
            <div className={cn("flex min-w-0 flex-col gap-1.5 text-sm", i < events.length - 1 && "pb-5")}>
              <p>
                <b>{event.by}</b> {EVENT_VERB[event.type]}
                <span className="text-neutral-500"> · {event.at}</span>
              </p>
              {event.type === "edited" && (
                <>
                  <ul className="flex flex-col gap-1.5 rounded-xl border border-neutral-200 px-3 py-2.5">
                    {event.changes.map((change) => (
                      <li key={change.field} className="flex flex-wrap gap-x-2">
                        <span className="w-20 shrink-0 text-neutral-500">{FIELD_LABELS[change.field]}</span>
                        <s className="text-neutral-500">{fieldText(change.field, change.from)}</s>
                        <span aria-label="改成">→</span>
                        <b>{fieldText(change.field, change.to)}</b>
                      </li>
                    ))}
                  </ul>
                  <p className="text-neutral-700">原因：「{event.reason}」</p>
                </>
              )}
              {event.type === "archived" && <p className="text-neutral-700">原因：「{event.reason}」</p>}
              {event.type === "created" && (
                <p className="text-neutral-600">
                  {original.description} · {fieldText("amount", original.amount)} · {original.category} ·{" "}
                  {original.branch} · {original.holder}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EntryEditForm({
  tx,
  onCancel,
  onSave,
}: {
  tx: Transaction;
  onCancel: () => void;
  onSave: (tx: Transaction) => void;
}) {
  const id = useId();
  const income = tx.amount > 0;
  const [amountText, setAmountText] = useState(String(Math.abs(tx.amount)));
  const [description, setDescription] = useState(tx.description);
  const [category, setCategory] = useState(tx.category);
  const [date, setDate] = useState(isoFromShortDate(tx.date));
  const [branch, setBranch] = useState(tx.branch);
  const [holder, setHolder] = useState(tx.holder);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();

  const categories = [...new Set([...categoriesFor(income ? "income" : "expense"), tx.category])];
  const control = cn(fieldControlClass(), "h-12");

  const save = () => {
    const amount = Number(amountText.replace(/[,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return setError("請輸入大於 0 的金額");
    if (!description.trim()) return setError("請寫說明");
    const after: EntryValues = {
      date: shortDateFromISO(date),
      category,
      description: description.trim(),
      branch,
      holder,
      amount: income ? amount : -amount,
    };
    if (diffEntry(entryValues(tx), after).length === 0) return setError("沒有改到任何東西");
    if (!reason.trim()) return setError("請寫下為什麼要改");
    onSave(editEntry(tx, after, stampNow(), reason.trim()));
    toast.success("（示意）已儲存修改，原本的內容留在修改紀錄");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      <Dialog.Title className="text-lg font-bold text-neutral-900">編輯這筆</Dialog.Title>
      <LabeledControl label={income ? "金額（收入）" : "金額（支出）"} htmlFor={`${id}-amount`}>
        <input
          id={`${id}-amount`}
          inputMode="numeric"
          className={cn(control, "tabular-nums", income ? INCOME_TEXT : EXPENSE_TEXT)}
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
        />
      </LabeledControl>
      <LabeledControl label="說明" htmlFor={`${id}-desc`}>
        <input id={`${id}-desc`} className={control} value={description} onChange={(e) => setDescription(e.target.value)} />
      </LabeledControl>
      <div className="grid grid-cols-2 gap-3">
        <LabeledControl label="類別" htmlFor={`${id}-category`}>
          <Select id={`${id}-category`} value={category} onChange={setCategory} options={textOptions(categories)} />
        </LabeledControl>
        <LabeledControl label="日期" htmlFor={`${id}-date`}>
          <input id={`${id}-date`} type="date" className={control} value={date} onChange={(e) => setDate(e.target.value)} />
        </LabeledControl>
        <LabeledControl label="據點" htmlFor={`${id}-branch`}>
          <Select id={`${id}-branch`} value={branch} onChange={setBranch} options={textOptions(BRANCH_OPTIONS)} />
        </LabeledControl>
        <LabeledControl label="錢在誰手上" htmlFor={`${id}-holder`}>
          <Select id={`${id}-holder`} value={holder} onChange={setHolder} options={textOptions(FUND_HOLDERS)} />
        </LabeledControl>
      </div>
      <LabeledControl
        label={
          <>
            為什麼要改？<span className="ml-1 font-normal text-danger-700">（必填）</span>
          </>
        }
        htmlFor={`${id}-reason`}
        hint="原本的內容會留在修改紀錄，誰改的、什麼時候改的都看得到。"
      >
        <textarea
          id={`${id}-reason`}
          rows={2}
          className={cn(fieldControlClass(!!error && !reason.trim()), "py-3")}
          placeholder="例：收據上是 360，原本打錯"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(undefined);
          }}
        />
      </LabeledControl>
      <FieldError>{error}</FieldError>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">儲存修改</Button>
      </div>
    </form>
  );
}

function ArchiveConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return setError("請寫下為什麼要封存");
        onConfirm(reason.trim());
      }}
      className="flex flex-col gap-3 border-t border-danger-200 bg-danger-50 px-5 py-4"
    >
      <div className="flex flex-col gap-1">
        <p className="text-base font-bold text-danger-700">封存這筆？</p>
        <p className="text-sm leading-relaxed text-neutral-700">
          封存後不算進收支，但不會消失：大家都看得到是誰、什麼時候、為什麼封存，也能還原。
        </p>
      </div>
      <LabeledControl
        label={
          <>
            原因<span className="ml-1 font-normal text-danger-700">（必填）</span>
          </>
        }
        htmlFor={`${id}-reason`}
      >
        <textarea
          id={`${id}-reason`}
          rows={2}
          autoFocus
          className={cn(fieldControlClass(!!error), "py-3")}
          placeholder="例：重複記了"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(undefined);
          }}
        />
      </LabeledControl>
      <FieldError>{error}</FieldError>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" variant="danger">
          確認封存
        </Button>
      </div>
    </form>
  );
}

// ── 一筆轉移 ──

function TransferDetail({
  transfer,
  canEdit,
  onClose,
  onChange,
}: {
  transfer: Transfer;
  canEdit: boolean;
  onClose: () => void;
  onChange: (transfer: Transfer) => void;
}) {
  const status = transferStatus(transfer);

  const confirm = () => {
    onChange({ ...transfer, confirmed: { ...stampNow(), by: transfer.receiver } });
    toast.success(`（示意）已用${transfer.receiver}的身分確認收到`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailHeader onClose={onClose}>
        <span className="text-sm text-neutral-500">{transfer.id}</span>
        <StatusTag tone="neutral">轉移</StatusTag>
        <StatusTag tone={status.tone}>{status.label}</StatusTag>
      </DetailHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-1">
          <Money value={transfer.amount} className="text-[34px] font-bold leading-tight text-neutral-900" />
          <Dialog.Title className="flex flex-wrap items-center gap-2 text-lg font-semibold text-neutral-900">
            {transfer.from}
            <ArrowRight className="size-5 text-neutral-500" aria-label="交給" />
            {transfer.to}
          </Dialog.Title>
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-[15px]">
          <Row label="日期">{shortDateLabel(transfer.date)}</Row>
          <Row label="據點">
            {transfer.fromBranch} → {transfer.toBranch}
          </Row>
          <Row label="方式">
            {transfer.method === "cash" ? "現金面交" : "銀行轉帳"}
            {transfer.ref && ` · 末五碼 ${transfer.ref}`}
          </Row>
          {transfer.note && <Row label="為什麼轉">{transfer.note}</Row>}
        </dl>
        <section aria-label="記錄" className="flex flex-col gap-2.5 rounded-2xl bg-neutral-50 px-4 py-3.5 text-sm">
          <StampRow stamp={transfer.sent} action="送出" />
          {transfer.confirmed ? (
            <StampRow stamp={transfer.confirmed} action="確認收到" />
          ) : (
            <p className="text-warning-950">還在等{transfer.receiver}確認收到。</p>
          )}
        </section>
      </div>

      {!transfer.confirmed && (
        <footer className="flex flex-col gap-2 border-t border-neutral-200 px-5 py-4">
          {canEdit ? (
            <>
              <Button onClick={confirm}>確認收到</Button>
              <p className="text-[13px] text-neutral-500">示意：之後只有{transfer.receiver}本人看得到這顆按鈕。</p>
            </>
          ) : (
            <NeedsEditNotice action="確認收到" />
          )}
        </footer>
      )}
    </div>
  );
}

function DetailHeader({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="關閉" className="shrink-0 text-neutral-500">
        <X className="size-5" />
      </Button>
    </header>
  );
}
