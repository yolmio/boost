import { getScriptModel, runScript, writeAppModelToDisk } from "./utils";

const appModel = await getScriptModel();
writeAppModelToDisk(appModel);
runScript(process.argv[process.argv.length - 1]);
