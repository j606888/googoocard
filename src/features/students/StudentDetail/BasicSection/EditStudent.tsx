"use client";

import { SquarePen, X, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { StudentWithDetail } from "@/store/slices/students";
import InputField from "@/components/InputField";
import { useUpdateStudentMutation, useGetTagsQuery, useAddStudentTagMutation, useRemoveStudentTagMutation } from "@/store/slices/students";
import QualificationLevels, { applyLevelPick } from "../QualificationLevels";
import type { DanceLevels } from "@/domains/qualification";
import AvatarPicker from "@/features/students/AvatarPicker";
import ArchiveStudentDialog from "../ArchiveStudentDialog";
import { NEEDS_RENEWAL_TAG, tagLabel } from "../../StudentList/studentFilters";

const EditStudent = ({
  student,
  trigger,
}: {
  student: StudentWithDetail;
  /** Custom opener (e.g. the header's 「編輯」 button); default is a pen icon. */
  trigger?: (open: () => void) => ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [note, setNote] = useState(student.note);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(student.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [danceLevels, setDanceLevels] = useState<DanceLevels>(student.danceLevels ?? {});
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [tagInput, setTagInput] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [updateStudent, { isLoading }] = useUpdateStudentMutation();
  const { data: allTags = [] } = useGetTagsQuery();
  const [addStudentTag] = useAddStudentTagMutation();
  const [removeStudentTag] = useRemoveStudentTagMutation();
  // 表單 state 只在掛載時初始化；分割畫面切換學生不會重新掛載，
  // 所以每次打開都從當下的 student 重設，避免沿用上一位學生的資料。
  const handleOpen = () => {
    setName(student.name);
    setNote(student.note);
    setSelectedAvatarUrl(student.avatarUrl);
    setDanceLevels(student.danceLevels ?? {});
    setErrors({});
    setTagInput("");
    setIsOpen(true);
  };

  const handleSubmit = async () => {
    if (!name) {
      setErrors({ name: "請輸入姓名" });
      return;
    }
    try {
      await updateStudent({ id: student.id, name, note, avatarUrl: selectedAvatarUrl, danceLevels }).unwrap();
      toast.success("已儲存");
      setIsOpen(false);
    } catch (err) {
      const message = (err as { data?: { error?: string } })?.data?.error ?? "更新失敗，請稍後再試";
      setErrors({ name: message });
      toast.error(message);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleAddTag = async (tagName: string) => {
    if (!tagName.trim()) return;
    try {
      await addStudentTag({ studentId: student.id, tagName: tagName.trim() }).unwrap();
      setTagInput("");
    } catch {
      toast.error("新增標籤失敗，請稍後再試");
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await removeStudentTag({ studentId: student.id, tagId }).unwrap();
    } catch {
      toast.error("移除標籤失敗，請稍後再試");
    }
  };

  // 「需續約」由系統依剩餘堂數維護（refreshNeedsRenewalTag），手動加減會被下一次刷新蓋掉。
  const studentTags = student.tags ?? [];
  const addableTags = allTags.filter(
    (tag) => tag.name !== NEEDS_RENEWAL_TAG && !studentTags.some((st) => st.id === tag.id)
  );

  return (
    <>
      {trigger ? (
        trigger(handleOpen)
      ) : (
        <button type="button" onClick={handleOpen} aria-label={`編輯 ${student.name}`} className="cursor-pointer">
          <SquarePen className="w-5 h-5 text-neutral-500" />
        </button>
      )}
      <Drawer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={handleSubmit}
        title="編輯學生"
        subtitle={`${student.name} · #${student.number}`}
        isLoading={isLoading}
        disabled={avatarUploading}
        submitText="儲存"
        secondaryText="取消"
        footerStart={
          !student.archivedAt && (
            <button
              type="button"
              onClick={() => setConfirmArchive(true)}
              className="text-sm font-semibold text-danger-700 hover:text-danger-900 cursor-pointer py-2"
            >
              封存學生
            </button>
          )
        }
      >
        <form className="mb-6 flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
          <AvatarPicker
            value={selectedAvatarUrl}
            onChange={setSelectedAvatarUrl}
            onUploadingChange={setAvatarUploading}
          />
          <InputField
            label="姓名"
            value={name}
            onChange={handleNameChange}
            error={errors.name}
          />

          <section className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-neutral-700">舞種資格</h3>
              <span className="text-xs text-neutral-500">決定能買哪些複習卡</span>
            </div>
            <QualificationLevels
              levels={danceLevels}
              onPick={(styleId, level, hasLevels) =>
                setDanceLevels((prev) => applyLevelPick(prev, styleId, level, hasLevels))
              }
            />
          </section>

          <section className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-neutral-700">標籤</h3>
              <span className="text-xs text-neutral-500">改了馬上生效</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {studentTags.map((tag) =>
                tag.name === NEEDS_RENEWAL_TAG ? (
                  <span
                    key={tag.id}
                    title="由系統依剩餘堂數自動標記"
                    className="text-xs font-semibold px-2.5 py-1 rounded-full text-danger-700 bg-danger-100"
                  >
                    {tagLabel(tag.name)}
                  </span>
                ) : (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 text-xs pl-2.5 pr-1.5 py-1 rounded-full border border-neutral-300 text-neutral-700"
                  >
                    {tag.name}
                    <button
                      type="button"
                      aria-label={`移除 ${tag.name}`}
                      onClick={() => handleRemoveTag(tag.id)}
                      className="p-0.5 text-neutral-500 hover:text-danger-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              )}
              {addableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleAddTag(tag.name)}
                  className="inline-flex items-center gap-1 text-xs text-neutral-600 border border-dashed border-neutral-400 px-2.5 py-1 rounded-full hover:border-primary-500 hover:text-primary-700 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag(tagInput);
                  }
                }}
                placeholder="新標籤名稱…"
                aria-label="新標籤名稱"
                className="flex-1 min-w-0 text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                disabled={!tagInput.trim()}
                className="text-sm px-3 py-2 rounded-lg border border-neutral-300 font-semibold text-neutral-800 disabled:opacity-40 hover:bg-neutral-50 cursor-pointer"
              >
                新增
              </button>
            </div>
            <p className="text-xs text-neutral-500">「需續約」由系統自動標記</p>
          </section>

          <label className="flex flex-col gap-1.5 border-t border-neutral-100 pt-4">
            <span className="text-sm font-bold text-neutral-700">
              備註 <span className="font-normal text-neutral-500">（學生看不到）</span>
            </span>
            <textarea
              value={note || ""}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </label>
        </form>
      </Drawer>
      <ArchiveStudentDialog
        student={student}
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onArchived={() => setIsOpen(false)}
      />
    </>
  );
};

export default EditStudent;
