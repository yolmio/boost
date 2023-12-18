import { getScriptModel, runScript, writeHubModelToDisk } from "./utils.js";

const appModel = await getScriptModel();
writeHubModelToDisk(appModel);
runScript(process.argv[process.argv.length - 1]);
