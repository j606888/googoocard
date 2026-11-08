"use client";

import { useEffect, useState } from "react";
import { Link2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

interface Candidate {
  id: number;
  name: string;
  avatarUrl: string;
  remainingSessions: number;
}

/**
 * 「我來上過課」（FirstTimeGate）：找到自己、確認、綁定這個 LINE，接著就進簽到。
 * 名單要打字才查得到（不整份攤開），只會出現還沒綁 LINE 的人；老師會在
 * 「待處理」看到每一筆認領，認錯人可以解除。
 */
export default function ClaimSelf({
  idToken,
  checkinKey,
  onClaimed,
  onFirstTime,
}: {
  idToken: string;
  checkinKey: string;
  onClaimed: () => void;
  onFirstTime: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ key: checkinKey, q });
        const res = await fetch(`/api/liff/claim?${params}`, {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { students: Candidate[] };
        setResults(data.students);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, idToken, checkinKey]);

  const handleClaim = async () => {
    if (!picked) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/liff/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ key: checkinKey, studentId: picked.id }),
      });
      if (res.status === 409) {
        toast.error("這位已經綁定別的 LINE 了，請找小幫手");
        setPicked(null);
        setResults(null);
        setQuery("");
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      onClaimed();
    } catch (err) {
      console.error("[liff] claim error", err);
      toast.error("綁定失敗，請稍後再試或找小幫手");
      setSubmitting(false);
    }
  };

  if (picked) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picked.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          <h2 className="text-2xl font-bold">你是 {picked.name} 嗎？</h2>
          <p className="leading-relaxed text-neutral-600">
            確認後，這個 LINE 就會綁定到 {picked.name}，
            <br />
            以後打開 LINE 選單就能直接簽到、看剩幾堂。
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 pb-6">
          <Button size="lg" className="w-full" isLoading={submitting} onClick={handleClaim}>
            <Link2 className="h-5 w-5" />
            {submitting ? "綁定中…" : "是我，綁定並簽到"}
          </Button>
          <Button variant="ghost" size="lg" className="w-full" disabled={submitting} onClick={() => setPicked(null)}>
            不是，重新找
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div>
        <h2 className="text-xl font-semibold">找到你自己</h2>
        <p className="mt-1 text-sm text-neutral-600">輸入你在教室用的名字，選你自己就能綁定 LINE 並簽到。</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
        <input
          autoFocus
          value={query}
          maxLength={30}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(fieldControlClass(), "h-12 pl-11")}
          placeholder="輸入名字"
          aria-label="輸入名字"
        />
      </div>

      {results && results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setPicked(s)}
                className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left active:bg-neutral-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="text-sm text-neutral-500">
                  {s.remainingSessions > 0 ? `剩 ${s.remainingSessions} 堂` : "沒有剩餘堂數"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {results && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm leading-relaxed text-neutral-600">
          找不到「{query.trim()}」。換個寫法試試（中文名、英文名、暱稱）；
          如果還是找不到，可能已經綁過別的 LINE，請找小幫手。
        </div>
      )}

      <button type="button" onClick={onFirstTime} className="mt-auto text-sm text-neutral-500 underline">
        其實我是第一次來
      </button>
    </div>
  );
}
