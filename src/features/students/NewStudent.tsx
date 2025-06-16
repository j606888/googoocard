import { Check, Plus } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import { useCreateStudentMutation } from "@/store/slices/students";
import InputField from "@/components/InputField";

const validationErrors = {
  name: "Must provide a name",
};

const validateForm = (data: { name: string }) => {
  const errors: { name?: string } = {};
  if (!data.name) {
    errors.name = validationErrors.name;
  }
  return errors;
};

const avatarUrls = [
  "/images/avatar_1.png",
  "/images/avatar_2.png",
  "/images/avatar_3.png",
  "/images/avatar_4.png",
  "/images/avatar_5.png",
  "/images/avatar_6.png",
  "/images/avatar_7.png",
  "/images/avatar_8.png",
];

const NewStudent = () => {
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(avatarUrls[0]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const [createStudent, { isLoading: isCreatingStudent }] = useCreateStudentMutation();

  const handleSubmit = async () => {
    setIsLoading(true);
    const errors = validateForm({ name });
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }
    await createStudent({ name, avatarUrl: selectedAvatarUrl });
    setName("");
    setOpen(false);
  };

  const handleCardNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleClose = () => {
    setOpen(false);
    setErrors({});
  };

  return (
    <>
      <button className="bg-primary-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2">
        <Plus className="w-4 h-4" />
        <span className="font-medium" onClick={() => setOpen(true)}>
          New Student
        </span>
      </button>
      <Drawer
        title="New Student"
        open={open}
        onClose={handleClose}
        onSubmit={handleSubmit}
        isLoading={isLoading || isCreatingStudent}
      >
        <form className="mb-6">
          <InputField
            label="Student Name"
            value={name}
            placeholder="E.g. Dingding"
            onChange={handleCardNameChange}
            error={errors.name}
          />
          <div className="flex gap-3 items-center justify-center flex-wrap">
            {avatarUrls.map((avatarUrl) => (
              <div
                key={avatarUrl}
                className={`relative w-16 h-16 rounded-full ${
                  selectedAvatarUrl === avatarUrl ? "" : "brightness-75"
                }`}
                onClick={() => setSelectedAvatarUrl(avatarUrl)}
              >
                <img src={avatarUrl} className={`w-full h-full object-cover`} />
                {selectedAvatarUrl === avatarUrl && (
                  <div className="absolute bg-primary-500 flex items-center justify-center w-6 h-6 right-0 top-0 rounded-full">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </form>
      </Drawer>
    </>
  );
};

export default NewStudent;
