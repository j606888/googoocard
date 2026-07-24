"use client";

import CardDetail from "@/features/cards/CardDetail";
import { useGetCardDetailQuery } from "@/store/slices/cards";
import { ArrowLeftIcon } from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { useEffect } from "react";

const CardPage = () => {
  const { id } = useParams();
  const { data, isLoading } = useGetCardDetailQuery({ id: Number(id) });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden relative h-16 bg-primary-500 w-full flex items-center justify-center">
        <div className="absolute left-5 top-1/2 -translate-y-1/2">
          <Link href="/cards">
            <ArrowLeftIcon className="w-6 h-6 text-white" />
          </Link>
        </div>
        <h2 className="text-white text-lg font-semibold">{data?.card.name}</h2>
      </div>

      {isLoading || !data ? <ListSkeleton /> : <CardDetail detail={data} />}
    </>
  );
};

export default CardPage;
