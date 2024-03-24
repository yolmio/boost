import { getScriptModel, writeModelToDisk, yolmPath } from "./utils";

const model = await getScriptModel();
await writeModelToDisk(model);

const child = Bun.spawn([yolmPath(), ...process.argv.slice(2)], {
  stdout: "inherit",
  env: process.env,
});
const exitCode = await child.exited;
if (exitCode !== 0) {
  process.exit(exitCode);
}
