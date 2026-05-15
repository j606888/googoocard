"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import Button from "@/components/Button";
import type { IncomeRecord, IncomeResponse } from "./types";

function formatDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchIncome(skip: number): Promise<IncomeResponse> {
  const res = await fetch(`/api/income?skip=${skip}`);
  if (!res.ok) throw new Error("Failed to fetch income records");
  return res.json();
}

export default function RecordsTab() {
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchIncome(0);
      setRecords(result.records);
      setHasMore(result.hasMore);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      const result = await fetchIncome(records.length);
      setRecords((prev) => [...prev, ...result.records]);
      setHasMore(result.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500 py-4">載入課卡紀錄中...</p>;
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm">
        <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
          <DollarSign className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="text-lg font-bold">尚無課卡紀錄</p>
          <p className="text-sm text-gray-500 text-center">購買的課卡將顯示於此。</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border border-gray-200 rounded-sm bg-white overflow-hidden">
        <div className="divide-y divide-gray-200">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <div className="w-24 shrink-0 text-xs text-gray-500">
                {formatDate(record.createdAt)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {record.student.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {record.card.name}
                </p>
              </div>
              <div className="shrink-0 text-right text-base font-bold text-green-600">
                ${record.finalPrice}
              </div>
            </div>
          ))}
        </div>
      </div>

      {hasMore && (
        <div className="mt-4">
          <Button
            className="max-w-[180px]"
            onClick={handleLoadMore}
            isLoading={isLoadingMore}
            disabled={isLoadingMore}
          >
            載入更多
          </Button>
        </div>
      )}
    </>
  );
}
