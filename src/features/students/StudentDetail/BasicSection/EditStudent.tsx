"use client";

import { SquarePen, X, Plus } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/Drawer";
import { StudentWithDetail } from "@/store/slices/students";
import InputField from "@/components/InputField";
import { useUpdateStudentMutation, useGetTagsQuery, useAddStudentTagMutation, useRemoveStudentTagMutation } from "@/store/slices/students";
import { DanceType } from "@prisma/client";
import { ALL_DANCE_TYPES, DANCE_TYPE_META } from "@/lib/danceTypes";
import AvatarPicker from "@/features/students/AvatarPicker";

const EditStudent = ({ student }: { student: StudentWithDetail }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [note, setNote] = useState(student.note);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(student.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [danceQualifications, setDanceQualifications] = useState<DanceType[]>(student.danceQualifications ?? []);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [tagInput, setTagInput] = useState("");
  const [updateStudent, { isLoading }] = useUpdateStudentMutation();
  const { data: allTags = [] } = useGetTagsQuery();
  const [addStudentTag] = useAddStudentTagMutation();
  const [removeStudentTag] = useRemoveStudentTagMutation();

  const handleSubmit = async () => {
    if (!name) {
      setErrors({ name: "Name is required" });
    }
    await updateStudent({ id: student.id, name, note, avatarUrl: selectedAvatarUrl, danceQualifications });
    setIsOpen(false);
  };

  const toggleQualification = (type: DanceType) => {
    setDanceQualifications((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return;
    await addStudentTag({ studentId: student.id, tagName: tagName.trim() });
    setTagInput("");
  };

  const handleRemoveTag = async (tagId: number) => {
    await removeStudentTag({ studentId: student.id, tagId });
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
        disabled={avatarUploading}
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
          <AvatarPicker
            value={selectedAvatarUrl}
            onChange={setSelectedAvatarUrl}
            onUploadingChange={setAvatarUploading}
          />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Completed LV1 (可購買複習卡)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_DANCE_TYPES.map((type) => {
                const style = DANCE_TYPE_META[type];
                const selected = danceQualifications.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleQualification(type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all cursor-pointer ${
                      selected
                        ? `${style.light} ${style.border} ${style.text}`
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Tags</label>
            <div className="flex flex-wrap gap-2 min-h-8">
              {student.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                    tag.name === "Needs Renewal"
                      ? "text-red-700 bg-red-100"
                      : "text-gray-600 bg-gray-100"
                  }`}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className="ml-0.5 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {allTags.filter((t) => !student.tags?.some((st) => st.id === t.id)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allTags
                  .filter((t) => !student.tags?.some((st) => st.id === t.id))
                  .map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleAddTag(tag.name)}
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
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(tagInput); } }}
                placeholder="New tag name..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
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

export default EditStudent;
