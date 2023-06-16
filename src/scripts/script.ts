import { getScriptModel, runScript, writeAppModelToDisk } from "./utils.js";

const appModel = await getScriptModel();
writeAppModelToDisk(appModel);
runScript(process.argv[process.argv.length - 1]);
