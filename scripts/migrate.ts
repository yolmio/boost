import {
  getSystemYolmConfig,
  getScriptModel,
  writeModelToDisk,
  yolmPath,
} from "./utils";

process.env.YOLM_BOOST_ENV = "migrate";
const model = await getScriptModel();
writeModelToDisk(model);
const config = await getSystemYolmConfig();
const cmd = [yolmPath(), "migrate"];
if (config.profile.length > 0) {
  cmd.push("-p");
  cmd.push(config.profile);
}
cmd.push("--pull-dir");
cmd.push("data/migrate");
const proc = Bun.spawn({
  cmd,
  stdout: "inherit",
  env: process.env,
});
const exitCode = await proc.exited;
process.exit(exitCode);
