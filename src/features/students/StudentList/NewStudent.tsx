import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { useCreateStudentMutation } from "@/store/slices/students";
import InputField from "@/components/InputField";
import AvatarPicker, { DEFAULT_AVATAR } from "@/features/students/AvatarPicker";

const validationErrors = {
  name: "請輸入姓名",
};

const validateForm = (data: { name: string }) => {
  const errors: { name?: string } = {};
  if (!data.name) {
    errors.name = validationErrors.name;
  }
  return errors;
};

const NewStudent = () => {
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(DEFAULT_AVATAR);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const [createStudent, { isLoading }] = useCreateStudentMutation();

  const handleSubmit = async () => {
    if (isLoading) return;
    const trimmed = name.trim();
    const errors = validateForm({ name: trimmed });
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }
    try {
      await createStudent({ name: trimmed, avatarUrl: selectedAvatarUrl, note }).unwrap();
      toast.success(`已新增 ${trimmed}`);
      setName("");
      setNote("");
      setSelectedAvatarUrl(DEFAULT_AVATAR);
      setOpen(false);
    } catch (error) {
      // 後端唯一會擋的是同教室同名（400 "Student already exists"）
      const status = (error as { status?: number })?.status;
      if (status === 400) {
        setErrors({ name: "已經有同名的學生" });
      } else {
        toast.error("新增失敗，請稍後再試");
      }
    }
  };

  const handleCardNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNote(e.target.value);
  };

  const handleClose = () => {
    setOpen(false);
    setErrors({});
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600"
      >
        <Plus className="w-4 h-4" />
        <span className="font-medium">新增學生</span>
      </button>
      <Drawer
        title="新增學生"
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        disabled={avatarUploading}
      >
        <form className="mb-6 flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
          <InputField
            label="學生姓名"
            value={name}
            placeholder="例：丁丁"
            onChange={handleCardNameChange}
            error={errors.name}
          />
          <InputField
            label="備註（學生看不到）"
            value={note}
            placeholder="E.g. 紅色頭髮那個"
            onChange={handleNoteChange}
          />
          <AvatarPicker
            value={selectedAvatarUrl}
            onChange={setSelectedAvatarUrl}
            onUploadingChange={setAvatarUploading}
          />
        </form>
      </Drawer>
    </>
  );
};

export default NewStudent;
