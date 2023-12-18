import { getAppModel, writeHubModelToDisk } from "./utils.js";

const appModel = await getAppModel();
writeHubModelToDisk(appModel);
