import { spawnSync } from "child_process";
import { getTestModel, writeAppModelToDisk, yolmPath } from "./utils.js";

const appModel = await getTestModel();
writeAppModelToDisk(appModel);

spawnSync(yolmPath(), ["test"], {
  stdio: "inherit",
  env: {
    ...process.env,
    RUST_BACKTRACE: "1",
  },
});
