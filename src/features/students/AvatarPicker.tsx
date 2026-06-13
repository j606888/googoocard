"use client";

import { Check, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

export const PRESET_AVATARS = [
  "/images/avatar_1.png",
  "/images/avatar_2.png",
  "/images/avatar_3.png",
  "/images/avatar_4.png",
  "/images/avatar_5.png",
  "/images/avatar_6.png",
  "/images/avatar_7.png",
  "/images/avatar_8.png",
];

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
      <div className="flex px-3 gap-3 items-center justify-center flex-wrap">
        {/* 自訂上傳的頭像（若有）顯示在最前面 */}
        {isCustom && (
          <div className={`${tileBase}`}>
            <img src={value} className="w-full h-full object-cover" />
            <div className="absolute bg-primary-500 flex items-center justify-center w-6 h-6 right-0 top-0 rounded-full">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>
        )}

        {PRESET_AVATARS.map((avatarUrl) => (
          <div
            key={avatarUrl}
            className={`${tileBase} ${value === avatarUrl ? "" : "brightness-75"}`}
            onClick={() => onChange(avatarUrl)}
          >
            <img src={avatarUrl} className="w-full h-full object-cover" />
            {value === avatarUrl && (
              <div className="absolute bg-primary-500 flex items-center justify-center w-6 h-6 right-0 top-0 rounded-full">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* 上傳格子 */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span className="text-[10px] mt-0.5">上傳</span>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  );
};

export default AvatarPicker;
