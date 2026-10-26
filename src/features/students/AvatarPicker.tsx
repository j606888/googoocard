"use client";

import { Check, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

// 預設頭像：奇異鳥 × 學生在雙人舞裡的身分。圖由 scripts/generate-avatars.mjs 產生。
const PRESETS = [
  { url: "/images/avatars/leader.png", label: "Leader" },
  { url: "/images/avatars/follower.png", label: "Follower" },
  { url: "/images/avatars/both.png", label: "Both" },
  { url: "/images/avatars/not-sure.png", label: "Not Sure" },
  { url: "/images/avatars/staff.png", label: "工作人員" },
];

export const PRESET_AVATARS = PRESETS.map((p) => p.url);

/** 新學生還不知道帶還是跟，先用 Not Sure。 */
export const DEFAULT_AVATAR = "/images/avatars/not-sure.png";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // Cloudinary 免費方案單張上限 10MB

async function uploadToCloudinary(file: File): Promise<string> {
  const sigRes = await fetch("/api/upload-signature", { method: "POST" });
  if (!sigRes.ok) throw new Error("Failed to get upload signature");
  const { signature, timestamp, apiKey, cloudName, folder, transformation } =
    await sigRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);
  form.append("transformation", transformation);

  const upRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  if (!upRes.ok) throw new Error("Upload failed");
  const data = await upRes.json();
  return data.secure_url as string;
}

const AvatarPicker = ({
  value,
  onChange,
  onUploadingChange,
}: {
  value: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUploadingState = (next: boolean) => {
    setUploading(next);
    onUploadingChange?.(next);
  };

  const isCustom = !!value && !PRESET_AVATARS.includes(value);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允許重複選同一檔案
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("檔案太大（上限 10MB）");
      return;
    }
    setError(null);
    setUploadingState(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (err) {
      console.error(err);
      setError("上傳失敗，請再試一次");
    } finally {
      setUploadingState(false);
    }
  };

  const tileBase =
    "relative w-16 h-16 rounded-full cursor-pointer overflow-hidden";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex px-3 gap-3 items-start justify-center flex-wrap">
        {/* 自訂上傳的頭像（若有）顯示在最前面 */}
        {isCustom && (
          <div className="flex flex-col items-center gap-1">
            <div className={`${tileBase}`}>
              <img src={value} alt="" className="w-full h-full object-cover" />
              <div className="absolute bg-primary-900 flex items-center justify-center w-6 h-6 right-0 top-0 rounded-full">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
            <span className="text-[11px] font-semibold text-primary-900">自訂</span>
          </div>
        )}

        {PRESETS.map(({ url: avatarUrl, label }) => (
          <button
            type="button"
            key={avatarUrl}
            aria-label={label}
            aria-pressed={value === avatarUrl}
            className="flex cursor-pointer flex-col items-center gap-1"
            onClick={() => onChange(avatarUrl)}
          >
            <div className={`${tileBase} ${value === avatarUrl ? "" : "brightness-75"}`}>
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              {value === avatarUrl && (
                <div className="absolute bg-primary-900 flex items-center justify-center w-6 h-6 right-0 top-0 rounded-full">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <span className={`text-[11px] ${value === avatarUrl ? "font-semibold text-primary-900" : "text-neutral-500"}`}>
              {label}
            </span>
          </button>
        ))}

        {/* 上傳格子 */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="group flex cursor-pointer flex-col items-center gap-1 disabled:opacity-60"
        >
          <span className="w-16 h-16 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-500 group-hover:border-primary-300 group-hover:text-primary-700 transition-colors">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          </span>
          <span className="text-[11px] text-neutral-500">上傳照片</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {error && <p className="text-[13px] text-danger-700 text-center">{error}</p>}
    </div>
  );
};

export default AvatarPicker;
