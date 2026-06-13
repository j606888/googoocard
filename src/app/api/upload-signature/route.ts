import { NextResponse } from "next/server";
import crypto from "crypto";
import { decodeAuthToken } from "@/lib/auth";

// 上傳頭像時，前端先跟這支 API 要一個 Cloudinary 簽章，
// 再帶著簽章把檔案「直接」上傳到 Cloudinary（避開 serverless body 大小限制）。
// API secret 只留在伺服器端，不外洩。

// 統一的頭像裁切設定：填滿、自動取景、256x256、自動壓縮。
// 必須與前端送出的 transformation 完全一致，否則簽章驗證會失敗。
const AVATAR_TRANSFORMATION = "c_fill,g_auto,h_256,w_256,q_auto";
const AVATAR_FOLDER = "student-avatars";

export async function POST() {
  const { userId } = await decodeAuthToken();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!apiSecret || !apiKey || !cloudName) {
    return NextResponse.json(
      { error: "Cloudinary is not configured" },
      { status: 500 }
    );
  }

  const timestamp = Math.round(Date.now() / 1000);

  // 待簽章參數需依字母排序、以 & 串接，最後接上 api_secret 再做 sha1。
  const paramsToSign = `folder=${AVATAR_FOLDER}&timestamp=${timestamp}&transformation=${AVATAR_TRANSFORMATION}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  return NextResponse.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder: AVATAR_FOLDER,
    transformation: AVATAR_TRANSFORMATION,
  });
}
