import { getAppModel, writeAppModelToDisk } from "./utils";

const appModel = await getAppModel();
writeAppModelToDisk(appModel);
