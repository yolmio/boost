import { getScriptModel, runScript, writeModelToDisk } from "./utils";

const appModel = await getScriptModel();
await writeModelToDisk(appModel);
await runScript(process.argv[process.argv.length - 1]);
