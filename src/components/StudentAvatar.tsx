"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

/** 跟 `DEFAULT_AVATAR`（AvatarPicker）同一張；這裡不 import 它，免得共用元件反過來依賴 feature。 */
const FALLBACK = "/images/avatars/not-sure.png";

/**
 * 學生頭像。LINE 的大頭照網址會過期（學生換照片、解除綁定），載不到就換成預設的奇異鳥，
 * 不要在名單上露出破圖和 alt 文字。用法同 `next/image`。
 */
const StudentAvatar = ({ src, alt = "", ...props }: Omit<ImageProps, "alt"> & { alt?: string }) => {
  // 記「哪一個網址壞了」而不是布林：同一列換了學生（src 變了）要重新試。
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  const broken = !src || failedSrc === src;
  return <Image {...props} src={broken ? FALLBACK : src} alt={alt} onError={() => setFailedSrc(src)} />;
};

export default StudentAvatar;
