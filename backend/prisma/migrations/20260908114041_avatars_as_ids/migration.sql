-- L'avatar devient un simple identifiant : les images vivent dans l'app, le
-- backend n'a plus a connaitre base / couleur / accessoires.
ALTER TABLE "User" DROP COLUMN "avatarConfig";
ALTER TABLE "User" ADD COLUMN "avatar" TEXT NOT NULL DEFAULT 'alien';
