"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import InputField from "@/components/InputField";
import {
  useCreateLocationMutation,
  useUpdateLocationMutation,
  type Location,
} from "@/store/slices/locations";

/**
 * Create (`location` undefined) or edit a 分部. Mount it with a `key` per open
 * so the fields start from the location being edited.
 */
const LocationForm = ({
  open,
  onClose,
  location,
  all,
}: {
  open: boolean;
  onClose: () => void;
  location?: Location;
  /** Every location, archived included — names are unique across all of them. */
  all: Location[];
}) => {
  const [name, setName] = useState(location?.name ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [error, setError] = useState<string>();
  const [createLocation, { isLoading: creating }] = useCreateLocationMutation();
  const [updateLocation, { isLoading: updating }] = useUpdateLocationMutation();

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入分部名稱");
      return;
    }
    if (all.some((other) => other.id !== location?.id && other.name === trimmed)) {
      setError("已經有同名的分部了");
      return;
    }
    const body = { name: trimmed, address: address.trim() || null };
    try {
      if (location) await updateLocation({ id: location.id, ...body }).unwrap();
      else await createLocation(body).unwrap();
      onClose();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const message = status === 409 ? "已經有同名的分部了" : "儲存失敗，請稍後再試";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Drawer
      title={location ? `編輯 ${location.name}` : "新增分部"}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={creating || updating}
      submitText={location ? "儲存" : "建立"}
    >
      <form
        className="mb-6 flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <InputField
          label="名稱"
          value={name}
          placeholder="例如 台南"
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(undefined);
          }}
        />
        <div className="flex flex-col gap-1">
          <InputField
            label="地址（選填）"
            value={address}
            placeholder="例如 台南市東區…"
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="text-[13px] text-neutral-500">填了的話，LINE 課表會附「地圖」按鈕。</p>
        </div>
      </form>
    </Drawer>
  );
};

export default LocationForm;
