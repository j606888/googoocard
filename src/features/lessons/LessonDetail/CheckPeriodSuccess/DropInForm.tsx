import { useState } from "react";
import { Pencil } from "lucide-react";
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

/**
 * 金額大字，跟課卡的價錢區分開：單堂不扣卡。預設是牌價，數字本身就是輸入框
 * （特價直接改），改過就在下面標原價。
 */
const AmountPanel = ({
  value,
  listPrice,
  onChange,
}: {
  value: string;
  listPrice: number;
  onChange: (value: string) => void;
}) => (
  <label className="flex cursor-text flex-col items-center gap-0.5 rounded-2xl bg-primary-50 px-4 py-4">
    <span className="text-xs text-neutral-600">單堂費用</span>
    <span className="flex items-center gap-1.5 text-3xl font-extrabold tabular-nums text-neutral-900">
      $
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        aria-label="單堂費用"
        style={{ width: `${Math.max(value.length, 1) + 0.5}ch` }}
        className="border-b-2 border-dashed border-primary-300 bg-transparent text-center outline-none focus:border-primary-800"
      />
      <Pencil className="size-4 text-neutral-400" aria-hidden />
    </span>
    <span className="text-xs text-neutral-600">
      {value !== String(listPrice) && `原價 $${formatMoney(listPrice)} · `}不扣課卡
    </span>
  </label>
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
  const listPrice = lesson.dropInPrice ?? 0;
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(listPrice));
  const [pay, setPay] = useState<PayChoice>("CASH");
  const [reference, setReference] = useState("");
  const [chargeDropIn, { isLoading }] = useChargeDropInMutation();
  const amount = Number(price);
  // 改成 $0 = 這堂免收，不用選收款方式。
  const free = price !== "" && amount === 0;

  const close = () => {
    setOpen(false);
    setPrice(String(listPrice));
    setPay("CASH");
    setReference("");
    onDone?.();
  };

  const submit = async () => {
    const later = !free && pay === "LATER";
    const result = await chargeDropIn({
      id: lesson.id,
      periodId,
      studentId: record.studentId,
      amount,
      isPaid: !later,
      paymentMethod: free || pay === "LATER" ? null : pay,
      paymentReference: !free && pay === "TRANSFER" ? reference : null,
    });
    if ("error" in result) {
      toast.error("沒有記成功，請重新整理再試一次");
      return;
    }
    toast.success(free ? "已記單堂（免收）" : later ? "已記單堂，待收款" : `已收單堂 $${formatMoney(amount)}`);
    close();
  };

  return (
    <ExpandableAction
      triggerLabel={`單堂 $${formatMoney(listPrice)}`}
      title={`${record.studentName} 付單堂`}
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      inline={inline}
      onSubmit={submit}
      submitText={free ? "記下，免收" : pay === "LATER" ? "記下，下課收" : `收 $${formatMoney(amount)}`}
      disabled={price === ""}
      isLoading={isLoading}
    >
      <div className="mb-4 flex flex-col gap-4">
        <AmountPanel value={price} listPrice={listPrice} onChange={setPrice} />
        {!free && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>收款</FieldLabel>
            <PaySegment value={pay} onChange={setPay} options={["CASH", "TRANSFER", "LATER"]} />
          </div>
        )}
        {!free && pay === "TRANSFER" && <TransferReference value={reference} onChange={setReference} />}
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
  const [price, setPrice] = useState(String(amount));
  const [pay, setPay] = useState<PayChoice>("CASH");
  const [reference, setReference] = useState("");
  const [confirmPayment, { isLoading }] = useConfirmDropInPaymentMutation();
  const finalAmount = Number(price);
  const free = price !== "" && finalAmount === 0;

  const close = () => {
    setOpen(false);
    setPrice(String(amount));
    setPay("CASH");
    setReference("");
    onDone?.();
  };

  const submit = async () => {
    const result = await confirmPayment({
      chargeId,
      amount: finalAmount,
      paymentMethod: free ? undefined : pay === "TRANSFER" ? "TRANSFER" : "CASH",
      paymentReference: !free && pay === "TRANSFER" ? reference : null,
    });
    if ("error" in result) {
      toast.error("沒有確認成功，請重新整理再試一次");
      return;
    }
    toast.success(free ? "已結清（免收）" : `已收 $${formatMoney(finalAmount)}`);
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
      submitText={free ? "免收，結清" : `收 $${formatMoney(finalAmount)}`}
      disabled={price === ""}
      isLoading={isLoading}
    >
      <div className="mb-4 flex flex-col gap-4">
        <AmountPanel value={price} listPrice={amount} onChange={setPrice} />
        {!free && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel>收款方式</FieldLabel>
            <PaySegment value={pay} onChange={setPay} options={["CASH", "TRANSFER"]} />
          </div>
        )}
        {!free && pay === "TRANSFER" && <TransferReference value={reference} onChange={setReference} />}
      </div>
    </ExpandableAction>
  );
};
