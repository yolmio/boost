import { getAppModel, writeAppModelToDisk } from "./utils.js";

const appModel = await getAppModel();
writeAppModelToDisk(appModel);
