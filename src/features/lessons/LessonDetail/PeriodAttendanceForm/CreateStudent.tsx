import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import Drawer from "@/components/Drawer";
import {
  Student,
  useCreateStudentMutation,
  useGetTagsQuery,
  useAddStudentTagMutation,
} from "@/store/slices/students";
import InputField from "@/components/InputField";
import AvatarPicker, { PRESET_AVATARS } from "@/features/students/AvatarPicker";

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
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(PRESET_AVATARS[0]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [note, setNote] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});

  const [createStudent, { isLoading: isCreatingStudent }] =
    useCreateStudentMutation();
  const { data: allTags = [] } = useGetTagsQuery();
  const [addStudentTag] = useAddStudentTagMutation();

  const addPendingTag = (tagName: string) => {
    const name = tagName.trim();
    if (!name || pendingTags.includes(name)) return;
    setPendingTags((prev) => [...prev, name]);
    setTagInput("");
  };

  const removePendingTag = (tagName: string) => {
    setPendingTags((prev) => prev.filter((t) => t !== tagName));
  };

  const handleSubmit = async () => {
    const errors = validateForm({ name: newStudentName });
    if (Object.keys(errors).length > 0) {
      setErrors(errors);
      return;
    }
    try {
      const student = await createStudent({
        name: newStudentName,
        avatarUrl: selectedAvatarUrl,
        note,
      }).unwrap();
      if (student) {
        for (const tagName of pendingTags) {
          await addStudentTag({ studentId: student.id, tagName });
        }
        onCreate(student);
      }
      setNewStudentName("");
      setNote("");
      setPendingTags([]);
      setTagInput("");
      setSelectedAvatarUrl(PRESET_AVATARS[0]);
      setIsDrawerOpen(false);
    } catch (error) {
      setErrors({ name: "Student already exists" });
      console.error(error);
    }
  };

  useEffect(() => {
    setNewStudentName(defaultName);
  }, [defaultName]);

  const selectableTags = allTags.filter(
    (t) => t.name !== "Needs Renewal" && !pendingTags.includes(t.name)
  );

  return (
    <>
      <button
        className="bg-primary-500 text-white px-4 py-1.5 rounded-3xl flex items-center gap-2 text-sm cursor-pointer hover:bg-primary-600"
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
        disabled={avatarUploading}
      >
        <form className="mb-6 flex flex-col gap-4">
          <InputField
            label="Student Name"
            value={newStudentName}
            placeholder="E.g. Dingding"
            onChange={(e) => {
              setNewStudentName(e.target.value);
              setErrors({});
            }}
            error={errors.name}
          />
          <InputField
            label="Note(Student doesn't see this)"
            value={note}
            placeholder="E.g. 紅色頭髮那個"
            onChange={(e) => setNote(e.target.value)}
          />
          <AvatarPicker
            value={selectedAvatarUrl}
            onChange={setSelectedAvatarUrl}
            onUploadingChange={setAvatarUploading}
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Tags</label>
            {pendingTags.length > 0 && (
              <div className="flex flex-wrap gap-2 min-h-8">
                {pendingTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full text-gray-600 bg-gray-100"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removePendingTag(tag)}
                      className="ml-0.5 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {selectableTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectableTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => addPendingTag(tag.name)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 border border-dashed border-gray-300 px-2 py-0.5 rounded-full hover:border-primary-400 hover:text-primary-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPendingTag(tagInput);
                  }
                }}
                placeholder="New tag name..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={() => addPendingTag(tagInput)}
                disabled={!tagInput.trim()}
                className="text-sm px-3 py-1.5 rounded-lg bg-primary-500 text-white disabled:opacity-40 hover:bg-primary-600 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      </Drawer>
    </>
  );
};

export default CreateStudent;
