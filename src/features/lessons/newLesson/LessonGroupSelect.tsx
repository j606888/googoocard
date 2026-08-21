import { useState } from "react";
import Drawer from "@/components/Drawer";
import MultiSelect from "@/components/MultiSelect";
import {
  useGetLessonGroupsQuery,
  useCreateLessonGroupMutation,
} from "@/store/slices/lessonGroups";

// Single-select "which group does this lesson belong to" picker, built on
// the same MultiSelect + Drawer-create-new pattern as TeacherSelect/CardSelect
// — MultiSelect is capped to at most one value here (picking replaces the
// previous choice, clearing the chip's X goes back to 未分類/no group).
const LessonGroupSelect = ({
  groupId,
  onChange,
}: {
  groupId: number | null;
  onChange: (value: number | null) => void;
}) => {
  const { data: groups } = useGetLessonGroupsQuery();
  const [newGroupModalOpen, setNewGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [createLessonGroup, { isLoading }] = useCreateLessonGroupMutation();

  const groupOptions =
    groups?.map((group) => ({ label: group.name, value: group.id })) || [];

  const handleCreateGroup = async () => {
    const group = await createLessonGroup({ name: newGroupName });
    if (group.data) {
      onChange(group.data.id);
    }
    setNewGroupModalOpen(false);
    setNewGroupName("");
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="block font-medium mb-1">Group</label>
      <MultiSelect
        options={groupOptions}
        values={groupId !== null ? [groupId] : []}
        newOptionLabel="New group"
        placeholder="未分類（不加入群組）"
        newOptionOnClick={() => setNewGroupModalOpen(true)}
        onChange={(values) => {
          // MultiSelect appends the newly picked value last — take that as
          // the single selection, dropping whatever was picked before.
          const nextId = values.length > 0 ? (values[values.length - 1] as number) : null;
          onChange(nextId);
        }}
      />
      <Drawer
        title="Create Group"
        open={newGroupModalOpen}
        onClose={() => setNewGroupModalOpen(false)}
        onSubmit={handleCreateGroup}
        isLoading={isLoading}
      >
        <form>
          <label className="block mb-2 font-medium">Name</label>
          <input
            className="w-full mb-4 p-2 rounded bg-neutral-100 focus:outline-primary-500"
            placeholder="例如：週日課"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
        </form>
      </Drawer>
    </div>
  );
};

export default LessonGroupSelect;
