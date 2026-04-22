"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import Navbar from "@/features/Navbar";
import Button from "@/components/Button";

interface IncomeRecord {
  id: number;
  createdAt: string;
  finalPrice: number;
  student: {
    name: string;
  };
  card: {
    name: string;
  };
}

interface IncomeResponse {
  records: IncomeRecord[];
  hasMore: boolean;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const IncomePage = () => {
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchIncome = async (skip: number) => {
    const response = await fetch(`/api/income?skip=${skip}`);
    if (!response.ok) {
      throw new Error("Failed to fetch income records");
    }
    return (await response.json()) as IncomeResponse;
  };

  const loadInitial = async () => {
    try {
      setIsLoading(true);
      const result = await fetchIncome(0);
      setRecords(result.records);
      setHasMore(result.hasMore);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    try {
      setIsLoadingMore(true);
      const result = await fetchIncome(records.length);
      setRecords((prev) => [...prev, ...result.records]);
      setHasMore(result.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  return (
    <>
      <Navbar />
      <div className="px-5 py-3">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-6 h-6 text-primary-500" />
          <h2 className="text-2xl font-semibold">Income</h2>
        </div>

        {isLoading && (
          <div className="text-sm text-gray-500 py-4">Loading income records...</div>
        )}

        {!isLoading && records.length === 0 && (
          <div className="flex flex-col items-center justify-center p-6 gap-3 bg-primary-50 rounded-sm">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-full">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-lg font-bold">No income records yet</p>
              <p className="text-sm text-gray-500 text-center">
                Purchased cards will appear here.
              </p>
            </div>
          </div>
        )}

        {!isLoading && records.length > 0 && (
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
                  {isLoadingMore ? "Loading..." : "載入更多"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default IncomePage;
