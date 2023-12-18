import { getScriptModel, writeHubModelToDisk } from "./utils.js";

const scriptModel = await getScriptModel();
writeHubModelToDisk(scriptModel);
