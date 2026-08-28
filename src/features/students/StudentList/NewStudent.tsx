import { Plus } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import { useCreateStudentMutation } from "@/store/slices/students";
import InputField from "@/components/InputField";
import AvatarPicker, { PRESET_AVATARS } from "@/features/students/AvatarPicker";

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
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(PRESET_AVATARS[0]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const [createStudent, { isLoading: isCreatingStudent }] = useCreateStudentMutation();

  const handleSubmit = async () => {
    setIsLoading(true);
    const errors = validateForm({ name });
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }
    try {
      await createStudent({ name, avatarUrl: selectedAvatarUrl, note }).unwrap();
      setName("");
      setNote("");
      setSelectedAvatarUrl(PRESET_AVATARS[0]);
      setOpen(false);
      setIsLoading(false);
    } catch (error) {
      setErrors({ name: "學生已存在" });
      console.error(error);
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
      <button className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-primary-600">
        <Plus className="w-4 h-4" />
        <span className="font-medium" onClick={() => setOpen(true)}>
          新增學生
        </span>
      </button>
      <Drawer
        title="新增學生"
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        isLoading={isLoading || isCreatingStudent}
        disabled={avatarUploading}
      >
        <form className="mb-6 flex flex-col gap-3">
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
            error={errors.name}
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
