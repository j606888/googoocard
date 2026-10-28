"use client";

import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useCreateSkillTreeMutation } from "@/store/slices/curriculum";

/** 這個舞種還沒有樹：用預設的分類與等級，或完全空白。沒有編輯權限的人只看到一句話。 */
export default function EmptyTree({
  danceStyleId,
  styleName,
  canEdit,
  draftCount,
  onOpenDrafts,
}: {
  danceStyleId: number;
  styleName: string;
  canEdit: boolean;
  draftCount: number;
  onOpenDrafts: () => void;
}) {
  const [createTree, { isLoading, originalArgs }] = useCreateSkillTreeMutation();

  const create = async (template: "default" | "blank") => {
    try {
      await createTree({ danceStyleId, template }).unwrap();
      toast.success("技能樹建好了");
    } catch {
      toast.error("沒有建成功，請再試一次");
    }
  };

  if (!canEdit) {
    return (
      <EmptyState
        title="還沒有建立技能樹"
        description="老師建好之後，這裡會列出這個舞種想教的東西。"
        action={
          draftCount > 0 ? (
            <Button variant="secondary" onClick={onOpenDrafts}>
              看待定區 {draftCount}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <EmptyState
      title={`${styleName} 還沒有技能樹`}
      description="把想教的東西排成分類 × 等級。之後每個技能都可以留言討論。"
      action={
        <div className="flex w-full max-w-[340px] flex-col gap-2">
          <Button
            size="lg"
            isLoading={isLoading && originalArgs?.template === "default"}
            onClick={() => create("default")}
          >
            用預設的五個分類、一轉到三轉
          </Button>
          <Button
            size="lg"
            variant="secondary"
            isLoading={isLoading && originalArgs?.template === "blank"}
            onClick={() => create("blank")}
          >
            完全空白，自己建
          </Button>
          <Button variant="link" onClick={onOpenDrafts}>
            還沒想好？先把名字丟進待定區{draftCount > 0 ? `（${draftCount}）` : ""}
          </Button>
        </div>
      }
    />
  );
}
