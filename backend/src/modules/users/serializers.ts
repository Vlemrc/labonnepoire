import type { User } from "@prisma/client";
import type { AvatarId, PublicUser } from "@poire/shared";
import { DEFAULT_AVATAR } from "@poire/shared";

export function toPublicUser(user: Pick<User, "id" | "pseudo" | "avatar">): PublicUser {
  return {
    id: user.id,
    pseudo: user.pseudo,
    // Une valeur inconnue en base (avatar retire du catalogue) ne doit pas
    // casser l'affichage : on retombe sur celui par defaut.
    avatar: (user.avatar as AvatarId) ?? DEFAULT_AVATAR,
  };
}
