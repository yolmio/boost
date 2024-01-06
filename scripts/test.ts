import { getTestModel, writeModelToDisk, yolmPath } from "./utils";

const appModel = await getTestModel();
await writeModelToDisk(appModel);

const child = Bun.spawn([yolmPath(), "test"], {
  stdout: "inherit",
  env: process.env,
});
const exitCode = await child.exited;
if (exitCode !== 0) {
  process.exit(exitCode);
}
