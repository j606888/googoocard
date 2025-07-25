"use client";

import { SquarePen } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import { StudentWithDetail } from "@/store/slices/students";
import InputField from "@/components/InputField";
import { useUpdateStudentMutation } from "@/store/slices/students";

const EditStudent = ({ student }: { student: StudentWithDetail }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [updateStudent, { isLoading }] = useUpdateStudentMutation();

  const handleSubmit = async () => {
    if (!name) {
      setErrors({ name: "Name is required" });
    }
    await updateStudent({ id: student.id, name });
    setIsOpen(false);
  };

  return (
    <>
      <SquarePen
        className="w-5 h-5 text-gray-500"
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
        <form className="mb-6">
          <InputField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
        </form>
      </Drawer>
    </>
  );
};

export default EditStudent;
