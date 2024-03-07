import {
  getSystemYolmConfig,
  getScriptModel,
  writeModelToDisk,
  yolmPath,
} from "./utils";

process.env.YOLM_BOOST_ENV = "deploy";
const appModel = await getScriptModel();
if ((appModel.region as any) === "not-set") {
  throw new Error("Please set the region before attempting to deploy");
}
writeModelToDisk(appModel);
const config = await getSystemYolmConfig();
const cmd = [yolmPath(), "deploy"];
if (config.deployed) {
  cmd.push("-f");
  cmd.push("true");
}
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
