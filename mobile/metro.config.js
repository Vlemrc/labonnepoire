// Configuration monorepo : Metro doit surveiller la racine du workspace pour
// resoudre @bluff/shared, qui vit en dehors de mobile/.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Sans ca, Metro remonte l'arborescence et peut charger deux copies de React.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
