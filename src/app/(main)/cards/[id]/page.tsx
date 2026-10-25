"use client";

import CardDetail from "@/features/cards/CardDetail";
import { useGetCardDetailQuery } from "@/store/slices/cards";
import { useSizeClass } from "@/hooks/useMediaQuery";
import { ArrowLeftIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
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

  if (isExpanded) return <ListSkeleton />;

  return (
    <>
      <div className="relative h-16 bg-primary-500 w-full flex items-center justify-center">
        <div className="absolute left-5 top-1/2 -translate-y-1/2">
          <Link href="/cards" aria-label="回課卡">
            <ArrowLeftIcon className="w-6 h-6 text-white" />
          </Link>
        </div>
        <h2 className="text-white text-lg font-semibold">課卡</h2>
      </div>

      {isLoading || !data ? <ListSkeleton /> : <CardDetail detail={data} />}
    </>
  );
};

export default CardPage;
