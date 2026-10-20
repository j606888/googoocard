import { apiRoute } from "@/lib/apiRoute";
import { getTodos } from "@/service/todos";

// 「待處理」清單（待確認收款／需續約／出席沒綁課卡），網頁鈴鐺與 App 共用。
export const GET = apiRoute(async ({ classroomId }) => getTodos(classroomId));
