import {
  getSystemYolmConfig,
  getScriptModel,
  writeModelToDisk,
  yolmPath,
} from "./utils";

process.env.YOLM_BOOST_ENV = "migrate";
const appModel = await getScriptModel();
writeModelToDisk(appModel);
const config = await getSystemYolmConfig();
const cmd = [yolmPath(), "migrate"];
if (config.profile.length > 0) {
  cmd.push("-p");
  cmd.push(config.profile);
}
const proc = Bun.spawn({
  cmd,
  stdout: "inherit",
  env: process.env,
});
const exitCode = await proc.exited;
process.exit(exitCode);
