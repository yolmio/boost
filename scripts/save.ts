import { getModel, writeModelToDisk } from "./utils";

const appModel = await getModel();
await writeModelToDisk(appModel);
