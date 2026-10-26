"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useGetInviteTokenQuery } from "@/store/slices/memberships";
import { useGetMeQuery } from "@/store/slices/me";
import KiwiLogo from "@/components/KiwiLogo";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import Link from "next/link";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { useJoinInviteTokenMutation } from "@/store/slices/memberships";

function InvitationsContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { data: inviteToken, isLoading: isLoadingInviteToken } =
    useGetInviteTokenQuery({ token }, { skip: !token });
  const { data: user, isLoading: isUserLoading } = useGetMeQuery();
  const { data: classrooms, isLoading: isClassroomsLoading } =
    useGetClassroomsQuery(undefined, { skip: !user });
  const [joinInviteToken, { isLoading: isJoiningInviteToken }] =
    useJoinInviteTokenMutation();
  const [hasJoined, setHasJoined] = useState(false);

  const isLoggedIn = !!user;
  const isValidToken = !!inviteToken;
  const alreadyJoined =
    !hasJoined &&
    classrooms?.classrooms.some(
      (classroom) => classroom.id === inviteToken?.classroomId
    );
  const isLoading =
    isUserLoading ||
    isLoadingInviteToken ||
    isClassroomsLoading ||
    isJoiningInviteToken;

  useEffect(() => {
    if (
      isLoggedIn &&
      isValidToken &&
      !alreadyJoined &&
      !hasJoined &&
      !isLoading
    ) {
      joinInviteToken({ token });
      setHasJoined(true);
    }
  }, [
    isLoggedIn,
    isValidToken,
    alreadyJoined,
    hasJoined,
    joinInviteToken,
    token,
    isLoading,
  ]);

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center flex-col gap-1 mt-4">
          <h4 className="text-lg font-bold text-neutral-900 flex items-center gap-1">
            確認邀請中
            <span className="inline-flex">
              {Array.from({ length: 3 }).map((_, index) => (
                <motion.span
                  key={index}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: index * 0.5,
                  }}
                >
                  .
                </motion.span>
              ))}
            </span>
          </h4>
          <p className="text-sm text-neutral-600">稍等一下，很快就好</p>
        </div>
      </Container>
    );
  }

  if (!isLoggedIn && isValidToken) {
    return (
      <Container>
        <div className="flex items-start flex-col gap-1 mt-4">
          <h4 className="text-lg font-bold text-neutral-900 flex items-center gap-1">
            來自 `{inviteToken?.classroom?.name}` 的邀請
          </h4>
          <p className="text-sm text-neutral-600">
            歡迎使用 GoogooCard <br />
            只差一步就能加入{" "}
            <span className="font-bold">{inviteToken?.classroom?.name}</span>
          </p>
        </div>
        <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center justify-center gap-3 p-4">
          <Button asChild size="lg" className="w-full">
            <Link href={`/signup?token=${token}`}>註冊</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href={`/login?token=${token}`}>登入</Link>
          </Button>
        </div>
      </Container>
    );
  }

  if (!isLoggedIn && !isValidToken) {
    return (
      <Container>
        <div className="flex items-start flex-col gap-1 mt-4 px-8">
          <h4 className="text-lg font-bold text-neutral-900 flex items-center gap-1">
            邀請連結無效
          </h4>
          <p className="text-sm text-neutral-600">
            很抱歉，這個連結已經失效了，請向教室擁有者索取新的連結。
            <br />
            或者你也可以直接註冊開始使用。
          </p>
        </div>
        <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center justify-center gap-3 p-4">
          <Button asChild size="lg" className="w-full">
            <Link href="/signup">註冊</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href="/login">登入</Link>
          </Button>
        </div>
      </Container>
    );
  }

  if (alreadyJoined) {
    return (
      <Container>
        <div className="flex items-start flex-col gap-1 mt-4 px-8">
          <h4 className="text-lg font-bold text-neutral-900 flex items-center gap-1">
            你已經加入 {inviteToken?.classroom?.name} 了
          </h4>
          <p className="text-sm text-neutral-600">
            是不是又點了一次連結呀？
            <br />
            為什麼呢？
          </p>
        </div>
        <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center justify-center gap-3 p-4">
          <Button asChild size="lg" className="w-full">
            <Link href="/lessons">回到課程</Link>
          </Button>
        </div>
      </Container>
    );
  }

  if (isLoggedIn && !isValidToken) {
    return (
      <Container>
        <div className="flex items-start flex-col gap-1 mt-4 px-8">
          <h4 className="text-lg font-bold text-neutral-900 flex items-center gap-1">
            邀請連結無效
          </h4>
          <p className="text-sm text-neutral-600">
            I’m sorry to tell you the link was invalid, please ask the owner to
            regenerate the link.
          </p>
        </div>
        <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center justify-center gap-3 p-4">
          <Button asChild size="lg" className="w-full">
            <Link href="/lessons">回到課程</Link>
          </Button>
        </div>
      </Container>
    );
  }

  if (isLoggedIn && isValidToken && hasJoined) {
    return (
      <Container>
        <div className="flex items-start flex-col gap-1 mt-4 px-8">
          <h4 className="text-lg font-bold text-neutral-900 flex items-center gap-1">
            成功加入 `{inviteToken?.classroom?.name}`
          </h4>
          <p className="text-sm text-neutral-600">
            恭喜！
            <br />
            現在就回到課程看看裡面有什麼吧
          </p>
        </div>
        <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center justify-center gap-3 p-4">
          <Button asChild size="lg" className="w-full">
            <Link href="/lessons">回到課程</Link>
          </Button>
        </div>
      </Container>
    );
  }

  return <div>你不該出現在這裡</div>;
}

const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center flex-col gap-4 w-full bg-primary-50 pb-16">
      <div className="flex items-center justify-center flex-col gap-2">
        <div className="w-24 h-24 bg-primary-900 rounded-full flex items-center justify-center">
          <KiwiLogo className="w-14 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-primary-900">GoogooCard</h1>
      </div>
      {children}
    </div>
  );
};

function InvitationsPageFallback() {
  return <p>載入中…</p>;
}

export default function InvitationsPage() {
  return (
    <Suspense fallback={<InvitationsPageFallback />}>
      <InvitationsContent />
    </Suspense>
  );
}
