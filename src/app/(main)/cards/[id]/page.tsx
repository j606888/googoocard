"use client";

import CardDetail from "@/features/cards/CardDetail";
import { useGetCardDetailQuery } from "@/store/slices/cards";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import CardListSkeleton from "@/features/cards/CardList/CardListSkeleton";
import { CardDetailSkeleton } from "@/features/cards/CardDetail/CardDetailBody";
import { useEffect } from "react";

const CardPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const isExpanded = useSizeClass() === "expanded";
  const { data, isLoading } = useGetCardDetailQuery({ id: Number(id) });

  // 桌面的方案詳情是價目表上的右側抽屜，這一頁只給手機用。
  useEffect(() => {
    if (isExpanded) router.replace(`/cards?card=${id}`);
  }, [isExpanded, id, router]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (isExpanded) return <CardListSkeleton />;

  return (
    <>
      <div className="relative h-14 bg-white border-b border-neutral-200 w-full flex items-center justify-center">
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <Link href="/cards" aria-label="回課卡" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ChevronLeft className="size-6 text-neutral-900" />
          </Link>
        </div>
        <h2 className="text-lg font-bold text-neutral-900">課卡</h2>
      </div>

      {isLoading || !data ? (
        <div className="w-full px-5 py-5">
          <CardDetailSkeleton />
        </div>
      ) : (
        <CardDetail detail={data} />
      )}
    </>
  );
};

export default CardPage;
