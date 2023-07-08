import { getScriptModel, writeAppModelToDisk } from "./utils.js";

const scriptModel = await getScriptModel();
writeAppModelToDisk(scriptModel);
