"use client";

import { Check, SquarePen } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import { StudentWithDetail } from "@/store/slices/students";
import InputField from "@/components/InputField";
import { useUpdateStudentMutation } from "@/store/slices/students";
import { Switch } from "@/components/ui/switch";

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

const EditStudent = ({ student }: { student: StudentWithDetail }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [note, setNote] = useState(student.note);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(student.avatarUrl);
  const [hasCompletedBachataLv1, setHasCompletedBachataLv1] = useState(student.hasCompletedBachataLv1);
  const [hasCompletedSalsaLv1, setHasCompletedSalsaLv1] = useState(student.hasCompletedSalsaLv1);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [updateStudent, { isLoading }] = useUpdateStudentMutation();

  const handleSubmit = async () => {
    if (!name) {
      setErrors({ name: "Name is required" });
    }
    await updateStudent({ id: student.id, name, note, avatarUrl: selectedAvatarUrl, hasCompletedBachataLv1, hasCompletedSalsaLv1 });
    setIsOpen(false);
  };

  return (
    <>
      <SquarePen
        className="w-5 h-5 text-gray-500 cursor-pointer"
        onClick={() => setIsOpen(true)}
      />
      <Drawer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={handleSubmit}
        title={`Edit ${student.name}`}
        isLoading={isLoading}
        submitText="Update"
      >
        <form className="mb-6 flex flex-col gap-4">
          <InputField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <InputField
            label="Note(Student doesn't see this)"
            value={note || ""}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex px-3 gap-3 items-center justify-center flex-wrap">
            {avatarUrls.map((avatarUrl) => (
              <div
                key={avatarUrl}
                className={`relative w-16 h-16 rounded-full ${
                  selectedAvatarUrl === avatarUrl ? "" : "brightness-75"
                }`}
                onClick={() => setSelectedAvatarUrl(avatarUrl)}
              >
                <img src={avatarUrl} className="w-full h-full object-cover" />
                {selectedAvatarUrl === avatarUrl && (
                  <div className="absolute bg-primary-500 flex items-center justify-center w-6 h-6 right-0 top-0 rounded-full">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={hasCompletedBachataLv1} onCheckedChange={setHasCompletedBachataLv1} />
            <span>Has completed Bachata LV1</span>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={hasCompletedSalsaLv1} onCheckedChange={setHasCompletedSalsaLv1} />
            <span>Has completed Salsa LV1</span>
          </div>
        </form>
      </Drawer>
    </>
  );
};

export default EditStudent;
