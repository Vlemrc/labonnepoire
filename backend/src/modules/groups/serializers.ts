import type { GroupSummary } from "@bluff/shared";
import { toPublicUser } from "../users/serializers.js";
import type { GroupWithMembers } from "./service.js";

export function toGroupSummary(group: GroupWithMembers): GroupSummary {
  return {
    id: group.id,
    code: group.code,
    name: group.name,
    ownerId: group.ownerId,
    startingPoints: group.startingPoints,
    stakeBudget: group.stakeBudget,
    themes: group.themes,
    allowNoneOption: group.allowNoneOption,
    twistsEnabled: group.twistsEnabled,
    roundDurationHours: group.roundDurationHours,
    members: group.members.map((m) => toPublicUser(m.user)),
    activeSessionId: group.sessions[0]?.id ?? null,
  };
}
