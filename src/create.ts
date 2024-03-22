import { arch as osArch, homedir, type as osType } from "os";
import { join } from "path";
import { chmodSync } from "fs";
import { exit } from "process";

function isWindows() {
  return osType().toLowerCase() === "windows_nt";
}

function getCompressedFileName() {
  const os = osType().toLowerCase();
  const arch = osArch();
  if (os === "windows_nt") {
    return `yolm_windows_amd.gz`;
  } else if (os === "darwin") {
    if (arch.startsWith("arm")) {
      return `yolm_mac_arm.gz`;
    } else {
      return `yolm_mac_amd.gz`;
    }
  } else if (os === "linux") {
    return `yolm_linux_amd.gz`;
  }
  throw new Error("unsupported operating system");
}

function getYolmPath() {
  const suffix = isWindows() ? ".exe" : "";
  return join(homedir(), ".yolm", "bin", "yolm", suffix);
}

async function downloadLatestYolm() {
  const fileUrl = `https://yolmcli.com/${getCompressedFileName()}`;
  const response = await fetch(fileUrl);
  const compressedBuffer = await response.arrayBuffer();
  const compressedArray = new Uint8Array(compressedBuffer);
  const data = await Bun.gunzipSync(compressedArray);
  const yolmPath = getYolmPath();
  Bun.write(yolmPath, data, { createPath: true });
  if (!isWindows()) {
    chmodSync(yolmPath, 0o777);
  }
  console.log(
    "Yolm CLI successfully installed. Please add $HOME/.yolm/bin to your path",
  );
}

async function createSystem() {
  const yolmPath = getYolmPath();
  if (!Bun.file(yolmPath).exists()) {
    await downloadLatestYolm();
  } else {
    const proc = Bun.spawn([yolmPath, "upgrade"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await proc.exited;
    if (proc.exitCode !== 0) {
      exit(1);
    }
  }
}

await createSystem();
