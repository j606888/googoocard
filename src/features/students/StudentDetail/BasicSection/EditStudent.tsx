"use client";

import { SquarePen, X, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import { StudentWithDetail } from "@/store/slices/students";
import InputField from "@/components/InputField";
import { useUpdateStudentMutation, useGetTagsQuery, useAddStudentTagMutation, useRemoveStudentTagMutation } from "@/store/slices/students";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { DANCE_LEVELS, DEFAULT_DANCE_LEVEL } from "@/lib/danceLevels";
import type { DanceLevels } from "@/domains/qualification";
import AvatarPicker from "@/features/students/AvatarPicker";

const NOT_DONE = { value: 0, label: "未完成" };
const LEVELED_OPTIONS = [NOT_DONE, ...DANCE_LEVELS];
const UNLEVELED_OPTIONS = [NOT_DONE, { value: DEFAULT_DANCE_LEVEL, label: "已完成" }];

const EditStudent = ({ student }: { student: StudentWithDetail }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [note, setNote] = useState(student.note);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(student.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [danceLevels, setDanceLevels] = useState<DanceLevels>(student.danceLevels ?? {});
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [tagInput, setTagInput] = useState("");
  const [updateStudent, { isLoading }] = useUpdateStudentMutation();
  const { data: allTags = [] } = useGetTagsQuery();
  const [addStudentTag] = useAddStudentTagMutation();
  const [removeStudentTag] = useRemoveStudentTagMutation();
  const { styles, byId } = useDanceStyles();
  // Archived styles aren't offered, but one the student already holds stays
  // listed — the PATCH is authoritative, so it must be visible to be removable.
  const styleChoices = [
    ...styles,
    ...[...byId.values()].filter(
      (style) => style.archivedAt && danceLevels[style.id] !== undefined
    ),
  ];

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

  // 0 = 未完成 (no qualification row). A style without levels only offers
  // 已完成, which keeps whatever level is stored — picking it again must not
  // downgrade a level set while the style still had levels.
  const pickLevel = (styleId: number, level: number, hasLevels: boolean) => {
    setDanceLevels((prev) => {
      const next = { ...prev };
      if (level === 0) delete next[styleId];
      else if (hasLevels || next[styleId] === undefined) next[styleId] = level;
      return next;
    });
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
        className="w-5 h-5 text-neutral-500 cursor-pointer"
        onClick={handleOpen}
      />
      <Drawer
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={handleSubmit}
        title={`編輯 ${student.name}`}
        isLoading={isLoading}
        disabled={avatarUploading}
        submitText="儲存"
      >
        <form className="mb-6 flex flex-col gap-4">
          <InputField
            label="姓名"
            value={name}
            onChange={handleNameChange}
            error={errors.name}
          />
          <InputField
            label="備註（學生看不到）"
            value={note || ""}
            onChange={(e) => setNote(e.target.value)}
          />
          <AvatarPicker
            value={selectedAvatarUrl}
            onChange={setSelectedAvatarUrl}
            onUploadingChange={setAvatarUploading}
          />
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-neutral-700">已完成（可使用複習卡）</span>
              <span className="text-xs text-neutral-500">「未完成」＝沒有這個舞種的複習資格</span>
            </div>
            {styleChoices.length === 0 && (
              <p className="text-sm text-neutral-500">教室還沒有舞種。</p>
            )}
            {styleChoices.map((danceStyle) => {
              const meta = danceStyleMeta(danceStyle);
              const current = danceLevels[danceStyle.id] ?? 0;
              const options = danceStyle.hasLevels ? LEVELED_OPTIONS : UNLEVELED_OPTIONS;
              return (
                <div key={danceStyle.id} className="flex items-center gap-3">
                  <div className="w-24 flex items-center gap-2 shrink-0 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                    <span className="text-sm font-medium truncate">{meta.label}</span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`${meta.label} 已完成階級`}
                    className="flex-1 grid gap-0 rounded-xl bg-neutral-100 p-0.5"
                    style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
                  >
                    {options.map((option) => {
                      // Without levels any stored level counts as 已完成.
                      const checked =
                        option.value === 0
                          ? current === 0
                          : danceStyle.hasLevels
                            ? current === option.value
                            : current > 0;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => pickLevel(danceStyle.id, option.value, danceStyle.hasLevels)}
                          className={`h-9 rounded-[10px] text-sm cursor-pointer transition-colors ${
                            !checked
                              ? "text-neutral-500"
                              : option.value === 0
                                ? "bg-white text-neutral-700 font-semibold shadow-sm"
                                : "bg-primary-600 text-white font-semibold"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-700">標籤</label>
            <div className="flex flex-wrap gap-2 min-h-8">
              {student.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                    tag.name === "Needs Renewal"
                      ? "text-danger-700 bg-danger-100"
                      : "text-neutral-600 bg-neutral-100"
                  }`}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className="ml-0.5 hover:text-danger-500 transition-colors"
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
                      className="inline-flex items-center gap-1 text-xs text-neutral-500 border border-dashed border-neutral-300 px-2 py-0.5 rounded-full hover:border-primary-400 hover:text-primary-600 transition-colors"
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
                placeholder="新標籤名稱…"
                className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />
              <button
                type="button"
                onClick={() => handleAddTag(tagInput)}
                disabled={!tagInput.trim()}
                className="text-sm px-3 py-1.5 rounded-lg bg-primary-500 text-white disabled:opacity-40 hover:bg-primary-600 transition-colors"
              >
                新增
              </button>
            </div>
          </div>
        </form>
      </Drawer>
    </>
  );
};

export default EditStudent;
