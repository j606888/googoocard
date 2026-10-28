import { Fragment } from "react";
import type { Person } from "@/domains/curriculum/talk";

/** The text with every @名字 of a member in colour. */
export default function Mentions({ text, people }: { text: string; people: Person[] }) {
  const names = people
    .map((p) => p.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!names.length) return <>{text}</>;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-semibold text-primary-700">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
