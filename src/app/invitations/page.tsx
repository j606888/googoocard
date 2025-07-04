"use client";

import { useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useJoinInviteTokenMutation } from "@/store/slices/membershipts";

function InvitationsContent() {
  const [joinInviteToken, { error }] = useJoinInviteTokenMutation();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  console.log("HI error");
  console.log({ error });

  const handleJoinInviteToken = useCallback(async () => {
    if (token) {
      try {
        await joinInviteToken({ token }).unwrap();
        router.push("/lessons");
      } catch (error) {
        console.error(error);
      }
    }
  }, [token, joinInviteToken, router]);

  useEffect(() => {
    handleJoinInviteToken();
  }, [handleJoinInviteToken]);

  return (
    <>
      {!error ? (
        <p>Processing...</p>
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <p>{(error as any)?.data?.error}</p>
      )}
    </>
  );
}

function InvitationsPageFallback() {
  return <p>Loading...</p>;
}

export default function InvitationsPage() {
  return (
    <Suspense fallback={<InvitationsPageFallback />}>
      <InvitationsContent />
    </Suspense>
  );
}
