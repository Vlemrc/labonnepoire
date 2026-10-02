import type { GroupSummary } from "@poire/shared";
import { toPublicUser } from "../users/serializers.js";
import type { GroupWithMembers } from "./service.js";

export function toGroupSummary(group: GroupWithMembers): GroupSummary {
  const latest = group.sessions[0];
  return {
    id: group.id,
    code: group.code,
    name: group.name,
    ownerId: group.ownerId,
    startingPoints: group.startingPoints,
    themes: group.themes,
    allowNoneOption: group.allowNoneOption,
    twistsEnabled: group.twistsEnabled,
    members: group.members.map((m) => toPublicUser(m.user)),
    activeSessionId:
      latest && (latest.status === "LOBBY" || latest.status === "IN_PROGRESS") ? latest.id : null,
    lastFinishedSessionId: latest?.status === "FINISHED" ? latest.id : null,
  };
}
