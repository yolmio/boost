import { getScriptModel, writeAppModelToDisk } from "./utils";

const scriptModel = await getScriptModel();
writeAppModelToDisk(scriptModel);
