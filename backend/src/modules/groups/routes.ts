import { Router } from "express";
import { requireAuth, currentUser } from "../../middleware/auth.js";
import { createGroupSchema, joinGroupSchema, updateSettingsSchema } from "./schemas.js";
import { toGroupSummary } from "./serializers.js";
import {
  assertMember,
  createGroup,
  joinGroup,
  listGroupsForUser,
  loadGroup,
  updateSettings,
} from "./service.js";
import { startSession } from "../sessions/service.js";
import { toSessionView } from "../sessions/serializers.js";

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

groupsRouter.get("/", async (req, res) => {
  const groups = await listGroupsForUser(currentUser(req).id);
  res.json({ groups: groups.map(toGroupSummary) });
});

groupsRouter.post("/", async (req, res) => {
  const body = createGroupSchema.parse(req.body);
  const group = await createGroup(currentUser(req).id, body);
  res.status(201).json({ group: toGroupSummary(group) });
});

groupsRouter.post("/join", async (req, res) => {
  const { code } = joinGroupSchema.parse(req.body);
  const group = await joinGroup(code, currentUser(req).id);
  res.json({ group: toGroupSummary(group) });
});

groupsRouter.get("/:groupId", async (req, res) => {
  const userId = currentUser(req).id;
  await assertMember(req.params.groupId, userId);
  res.json({ group: toGroupSummary(await loadGroup(req.params.groupId)) });
});

groupsRouter.patch("/:groupId/settings", async (req, res) => {
  const body = updateSettingsSchema.parse(req.body);
  const userId = currentUser(req).id;
  await assertMember(req.params.groupId, userId);
  const group = await updateSettings(req.params.groupId, userId, body);
  res.json({ group: toGroupSummary(group) });
});

/** Lance une partie avec les membres actuels du salon. */
groupsRouter.post("/:groupId/sessions", async (req, res) => {
  const userId = currentUser(req).id;
  await assertMember(req.params.groupId, userId);
  const session = await startSession(req.params.groupId, userId);
  res.status(201).json({ session: toSessionView(session, userId) });
});
