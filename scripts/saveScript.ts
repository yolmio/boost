import { getScriptModel, writeModelToDisk } from "./utils";

const scriptModel = await getScriptModel();
await writeModelToDisk(scriptModel);
