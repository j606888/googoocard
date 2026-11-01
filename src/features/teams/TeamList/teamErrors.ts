const MESSAGES: Record<string, string> = {
  TEACHER_ALREADY_LINKED: "這位老師已經連到別的成員了",
  TEACHER_NOT_FOUND: "找不到這位老師，請重新整理",
  TEACHER_REQUIRED: "老師要連結一筆老師資料",
  CANNOT_CHANGE_OWN_ROLE: "不能改自己的角色，請另一位管理員幫忙",
  CANNOT_CHANGE_OWNER_ROLE: "建立者的角色要用「把教室交給他」來換",
  NOT_CLASSROOM_ADMIN: "只有管理員可以做這件事",
};

/** A toast line for a failed team mutation (RTK Query error → API error code). */
export function teamErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { data?: { code?: string } })?.data?.code;
  return (code && MESSAGES[code]) || fallback;
}
