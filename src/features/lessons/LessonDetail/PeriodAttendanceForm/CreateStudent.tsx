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
import AvatarPicker, { DEFAULT_AVATAR } from "@/features/students/AvatarPicker";
import { Button } from "@/components/ui/button";
import { FieldLabel, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";

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

const CreateStudent = ({
  defaultName,
  onCreate,
}: {
  defaultName: string;
  onCreate: (student: Student) => void;
}) => {
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(DEFAULT_AVATAR);
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
      setSelectedAvatarUrl(DEFAULT_AVATAR);
      setIsDrawerOpen(false);
    } catch (error) {
      setErrors({ name: "學生已存在" });
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
      <Button size="sm" onClick={() => setIsDrawerOpen(true)}>
        <Plus className="size-4" />
        新增
      </Button>
      <Drawer
        title="新增學生"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleSubmit}
        isLoading={isCreatingStudent}
        disabled={avatarUploading}
      >
        <form className="mb-6 flex flex-col gap-4">
          <InputField
            label="學生姓名"
            value={newStudentName}
            placeholder="例：丁丁"
            onChange={(e) => {
              setNewStudentName(e.target.value);
              setErrors({});
            }}
            error={errors.name}
          />
          <InputField
            label="備註（學生看不到）"
            value={note}
            placeholder="例如：紅色頭髮那個"
            onChange={(e) => setNote(e.target.value)}
          />
          <AvatarPicker
            value={selectedAvatarUrl}
            onChange={setSelectedAvatarUrl}
            onUploadingChange={setAvatarUploading}
          />

          <div className="flex flex-col gap-2">
            <FieldLabel>標籤</FieldLabel>
            {pendingTags.length > 0 && (
              <div className="flex flex-wrap gap-2 min-h-8">
                {pendingTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full text-neutral-600 bg-neutral-100"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removePendingTag(tag)}
                      aria-label={`移除標籤 ${tag}`}
                      className="ml-0.5 hover:text-danger-700 transition-colors cursor-pointer"
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
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 border border-dashed border-neutral-300 px-2 py-0.5 rounded-full hover:border-primary-400 hover:text-primary-700 transition-colors cursor-pointer"
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
                placeholder="新標籤名稱…"
                className={cn(fieldControlClass(), "h-11 flex-1 text-sm")}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => addPendingTag(tagInput)}
                disabled={!tagInput.trim()}
              >
                新增
              </Button>
            </div>
          </div>
        </form>
      </Drawer>
    </>
  );
};

export default CreateStudent;
