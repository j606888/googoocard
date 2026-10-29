import { useState } from "react";
import { toast } from "sonner";
import ExpandableAction from "@/components/ExpandableAction";
import { FieldLabel, fieldControlClass } from "@/components/Field";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  type AttendanceRecord,
  type Lesson,
  useChargeDropInMutation,
  useConfirmDropInPaymentMutation,
} from "@/store/slices/lessons";

/** 收款方式：現金、轉帳，或（只在記單堂時）下課再付。 */
type PayChoice = "CASH" | "TRANSFER" | "LATER";

const PAY_LABEL: Record<PayChoice, string> = { CASH: "現金", TRANSFER: "轉帳", LATER: "下課再付" };

const PaySegment = ({
  value,
  onChange,
  options,
}: {
  value: PayChoice;
  onChange: (value: PayChoice) => void;
  options: PayChoice[];
}) => (
  <div role="radiogroup" aria-label="收款方式" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map((option) => {
      const selected = value === option;
      return (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option)}
          className={cn(
            "h-11 cursor-pointer rounded-xl border-[1.5px] text-sm font-medium transition-colors",
            selected
              ? "border-primary-800 bg-primary-100 font-semibold text-primary-900"
              : "border-neutral-300 bg-white text-neutral-700 hover:border-primary-300"
          )}
        >
          {PAY_LABEL[option]}
        </button>
      );
    })}
  </div>
);

const TransferReference = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <div className="flex flex-col gap-1.5">
    <FieldLabel hint="（選填）">轉帳末五碼</FieldLabel>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="numeric"
      maxLength={20}
      aria-label="轉帳末五碼"
      className={cn(fieldControlClass(), "h-11")}
    />
  </div>
);

/** 金額大字，跟課卡的價錢區分開：單堂不扣卡。 */
const AmountPanel = ({ amount }: { amount: number }) => (
  <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-primary-50 px-4 py-4">
    <span className="text-xs text-neutral-600">單堂費用</span>
    <span className="text-3xl font-extrabold tabular-nums text-neutral-900">${formatMoney(amount)}</span>
    <span className="text-xs text-neutral-600">不扣課卡</span>
  </div>
);

/** 沒綁卡的出席改付單堂（點名結果頁、待處理）。 */
export const DropInForm = ({
  record,
  lesson,
  periodId,
  inline = false,
  onDone,
}: {
  record: AttendanceRecord;
  lesson: Lesson;
  periodId: number;
  inline?: boolean;
  onDone?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<PayChoice>("CASH");
  const [reference, setReference] = useState("");
  const [chargeDropIn, { isLoading }] = useChargeDropInMutation();
  const amount = lesson.dropInPrice ?? 0;

  const close = () => {
    setOpen(false);
    setPay("CASH");
    setReference("");
    onDone?.();
  };

  const submit = async () => {
    const result = await chargeDropIn({
      id: lesson.id,
      periodId,
      studentId: record.studentId,
      isPaid: pay !== "LATER",
      paymentMethod: pay === "LATER" ? null : pay,
      paymentReference: pay === "TRANSFER" ? reference : null,
    });
    if ("error" in result) {
      toast.error("沒有記成功，請重新整理再試一次");
      return;
    }
    toast.success(pay === "LATER" ? "已記單堂，待收款" : `已收單堂 $${formatMoney(amount)}`);
    close();
  };

  return (
    <ExpandableAction
      triggerLabel={`單堂 $${formatMoney(amount)}`}
      title={`${record.studentName} 付單堂`}
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      inline={inline}
      onSubmit={submit}
      submitText={pay === "LATER" ? "記下，下課收" : `收 $${formatMoney(amount)}`}
      isLoading={isLoading}
    >
      <div className="mb-4 flex flex-col gap-4">
        <AmountPanel amount={amount} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>收款</FieldLabel>
          <PaySegment value={pay} onChange={setPay} options={["CASH", "TRANSFER", "LATER"]} />
        </div>
        {pay === "TRANSFER" && <TransferReference value={reference} onChange={setReference} />}
      </div>
    </ExpandableAction>
  );
};

/** 單堂還沒付：確認收款。 */
export const ConfirmDropInForm = ({
  chargeId,
  amount,
  studentName,
  inline = false,
  onDone,
}: {
  chargeId: number;
  amount: number;
  studentName: string;
  inline?: boolean;
  onDone?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<PayChoice>("CASH");
  const [reference, setReference] = useState("");
  const [confirmPayment, { isLoading }] = useConfirmDropInPaymentMutation();

  const close = () => {
    setOpen(false);
    setPay("CASH");
    setReference("");
    onDone?.();
  };

  const submit = async () => {
    const result = await confirmPayment({
      chargeId,
      paymentMethod: pay === "TRANSFER" ? "TRANSFER" : "CASH",
      paymentReference: pay === "TRANSFER" ? reference : null,
    });
    if ("error" in result) {
      toast.error("沒有確認成功，請重新整理再試一次");
      return;
    }
    toast.success(`已收 $${formatMoney(amount)}`);
    close();
  };

  return (
    <ExpandableAction
      triggerLabel="收款"
      title={`${studentName} 的單堂費`}
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      inline={inline}
      onSubmit={submit}
      submitText={`收 $${formatMoney(amount)}`}
      isLoading={isLoading}
    >
      <div className="mb-4 flex flex-col gap-4">
        <AmountPanel amount={amount} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>收款方式</FieldLabel>
          <PaySegment value={pay} onChange={setPay} options={["CASH", "TRANSFER"]} />
        </div>
        {pay === "TRANSFER" && <TransferReference value={reference} onChange={setReference} />}
      </div>
    </ExpandableAction>
  );
};
