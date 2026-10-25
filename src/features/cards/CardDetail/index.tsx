"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CardDetail as CardDetailType } from "@/store/slices/cards";
import CardFormDrawer from "../CardForm/CardFormDrawer";
import CardDetailBody, { cardFromDetail } from "./CardDetailBody";

/**
 * 手機版的方案詳情整頁。桌面不會停在這裡——`/cards/[id]` 在桌面會導回
 * `/cards?card=<id>`，詳情在價目表的右側抽屜裡看。
 */
const CardDetail = ({ detail }: { detail: CardDetailType }) => {
  const router = useRouter();
  const [form, setForm] = useState<"edit" | "duplicate" | null>(null);

  return (
    <div className="w-full px-5 py-5">
      <CardDetailBody
        detail={detail}
        onEdit={() => setForm("edit")}
        onDuplicate={() => setForm("duplicate")}
        onDeleted={() => router.replace("/cards")}
      />
      {form && (
        <CardFormDrawer
          key={form}
          target={{ mode: form, card: cardFromDetail(detail) }}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            if (id !== detail.card.id) router.push(`/cards/${id}`);
          }}
        />
      )}
    </div>
  );
};

export default CardDetail;
