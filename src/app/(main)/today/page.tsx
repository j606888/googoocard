"use client";

import TodayScreen from "@/features/today/TodayScreen";

// 今天頁畫自己的綠色頁首（教室切換＋鈴鐺），不掛共用的 Navbar；
// 登入／沒教室的導向在 useToday 裡的 useClassroomGuard。
const TodayPage = () => <TodayScreen />;

export default TodayPage;
