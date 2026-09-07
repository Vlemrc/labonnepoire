import type { User } from "@prisma/client";
import type { AvatarConfig, PublicUser } from "@bluff/shared";

export function toPublicUser(user: Pick<User, "id" | "pseudo" | "avatarConfig">): PublicUser {
  return {
    id: user.id,
    pseudo: user.pseudo,
    avatarConfig: user.avatarConfig as unknown as AvatarConfig,
  };
}
