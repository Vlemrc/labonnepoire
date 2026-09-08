import { Pill } from "./ui";
import { formatRemaining, isUrgent } from "../lib/time";

export function Deadline({ deadlineAt }: { deadlineAt: string | null }) {
  const label = formatRemaining(deadlineAt);
  if (!label) return null;
  return <Pill text={label} tone={isUrgent(deadlineAt) ? "bad" : "muted"} />;
}
