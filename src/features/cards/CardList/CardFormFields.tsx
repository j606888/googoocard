import InputField from "@/components/InputField";
import { Switch } from "@/components/ui/switch";
import { DanceType } from "@prisma/client";
import CardDanceTypeSelect from "./CardDanceTypeSelect";
import { perSessionPrice } from "../cardInsights";

export interface CardFormErrors {
  cardName?: string;
  price?: string;
  sessions?: string;
  danceType?: string;
}

export interface CardFormValues {
  cardName: string;
  price: string;
  sessions: string;
  isPracticeCard: boolean;
  danceType: DanceType | null;
}

/**
 * 新增與編輯課卡共用的表單欄位。兩邊各自持有 state 與驗證，
 * 只有欄位長相走同一份——之前是兩份幾乎一樣的 JSX，很容易改一邊忘一邊。
 */
const CardFormFields = ({
  values,
  errors,
  onChange,
  onErrorClear,
}: {
  values: CardFormValues;
  errors: CardFormErrors;
  onChange: <K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) => void;
  onErrorClear: (key: keyof CardFormErrors) => void;
}) => {
  const { cardName, price, sessions, isPracticeCard, danceType } = values;

  const digitsOnly = (value: string) => value.replace(/\D/g, "");

  // 兩欄都填好才顯示——定價時真正在比的是單堂價，不該等送出才知道。
  const showPerSession = Number(price) > 0 && Number(sessions) > 0;
  const perSession = perSessionPrice({
    price: Number(price),
    sessions: Number(sessions),
  });

  return (
    <>
      <InputField
        label="課卡名稱"
        value={cardName}
        placeholder="E.g. 初階6堂"
        onChange={(e) => {
          onChange("cardName", e.target.value);
          if (errors.cardName) onErrorClear("cardName");
        }}
        error={errors.cardName}
      />

      <div className="flex flex-col gap-2">
        <div className="flex gap-4">
          <InputField
            label="金額"
            value={price}
            onChange={(e) => {
              const next = digitsOnly(e.target.value);
              onChange("price", next);
              if (errors.price && next) onErrorClear("price");
            }}
            error={errors.price}
            type="number"
          />
          <InputField
            label="堂數"
            value={sessions}
            onChange={(e) => {
              const next = digitsOnly(e.target.value);
              onChange("sessions", next);
              if (errors.sessions && next) onErrorClear("sessions");
            }}
            error={errors.sessions}
            type="number"
          />
        </div>
        {showPerSession && (
          <div className="flex items-center justify-between gap-2 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2.5">
            <span className="text-[13px] text-neutral-600">單堂價</span>
            <span className="text-base font-bold text-primary-700">
              ${perSession.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Switch
            checked={isPracticeCard}
            onCheckedChange={(checked) => onChange("isPracticeCard", checked)}
          />
          <span>設為複習卡</span>
        </div>
        <p className="text-xs text-neutral-500 leading-relaxed pl-[52px]">
          只有取得該舞種 Lv1 資格的學生才買得到，也只能用在同舞種的課。
        </p>
      </div>

      <CardDanceTypeSelect
        value={danceType}
        optional={!isPracticeCard}
        onChange={(type) => {
          onChange("danceType", type);
          if (errors.danceType) onErrorClear("danceType");
        }}
        error={errors.danceType}
      />
    </>
  );
};

export default CardFormFields;
