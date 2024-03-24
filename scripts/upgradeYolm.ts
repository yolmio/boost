import { isWindows, yolmPath } from "./utils";
import * as path from "path";
import { homedir } from "os";
import { unlinkSync } from "fs";

const proc = Bun.spawn([yolmPath(), "upgrade"], {
  stdout: "inherit",
  stderr: "inherit",
});
await proc.exited;
if (proc.exitCode !== 0) {
  process.exit(1);
}
if (isWindows()) {
  const downloadedPath = getDownloadedPath();
  const downloadedFile = Bun.file(downloadedPath);
  if (await downloadedFile.exists()) {
    await Bun.write(yolmPath(), downloadedFile);
    unlinkSync(downloadedPath);
  }
}

function getDownloadedPath() {
  return path.join(homedir(), ".yolm", "bin", "yolm_downloaded");
}
