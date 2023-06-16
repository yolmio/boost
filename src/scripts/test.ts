import { writeAppModelToDisk, getAppModel, yolmPath } from "./utils.js";
import { execFileSync } from "child_process";

const appModel = await getAppModel();
writeAppModelToDisk(appModel);

execFileSync(yolmPath(), ["test"], { stdio: "inherit", cwd: process.cwd() });
