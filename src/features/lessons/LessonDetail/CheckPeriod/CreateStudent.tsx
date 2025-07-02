import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import Drawer from "@/components/Drawer";
import { Student, useCreateStudentMutation } from "@/store/slices/students";
import InputField from "@/components/InputField";

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

const CreateStudent = ({
  defaultName,
  onCreate,
}: {
  defaultName: string;
  onCreate: (student: Student) => void;
}) => {
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(avatarUrls[0]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});

  const [createStudent, { isLoading: isCreatingStudent }] =
    useCreateStudentMutation();

  const handleSubmit = async () => {
    const errors = validateForm({ name: newStudentName });
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }
    const student = await createStudent({
      name: newStudentName,
      avatarUrl: selectedAvatarUrl,
    });
    if (student.data) {
      onCreate(student.data);
    }
    setNewStudentName("");
    setIsDrawerOpen(false);
  };

  useEffect(() => {
    setNewStudentName(defaultName);
  }, [defaultName]);

  return (
    <>
      <button
        className="bg-primary-500 text-white px-4 py-1.5 rounded-3xl flex items-center gap-2 text-sm"
        onClick={() => setIsDrawerOpen(true)}
      >
        <Plus className="w-4 h-4" />
        <span className="font-medium">Create</span>
      </button>
      <Drawer
        title="Create Student"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleSubmit}
        isLoading={isCreatingStudent}
      >
        <form className="mb-6">
          <InputField
            label="Student Name"
            value={newStudentName}
            placeholder="E.g. Dingding"
            onChange={(e) => setNewStudentName(e.target.value)}
            error={errors.name}
          />
          <div className="flex px-3 gap-3 items-center justify-center flex-wrap mt-4">
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

export default CreateStudent;
