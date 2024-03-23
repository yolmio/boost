import { arch as osArch, homedir, type as osType } from "node:os";
import { join } from "node:path";
import { exit } from "node:process";
import { chmodSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";

function isWindows() {
  return osType().toLowerCase() === "windows_nt";
}

export async function ensureDir(dir: string) {
  if (!(await Bun.file(dir).exists())) {
    await mkdir(dir, { recursive: true });
  }
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

function getYolmDir() {
  return join(homedir(), ".yolm", "bin");
}

function getYolmPath() {
  const suffix = isWindows() ? ".exe" : "";
  return join(getYolmDir(), "yolm", suffix);
}

function getDownloadedPath() {
  return join(homedir(), ".yolm", "bin", "yolm_downloaded");
}

async function downloadLatestYolm() {
  const fileUrl = `https://yolmcli.com/${getCompressedFileName()}`;
  const response = await fetch(fileUrl);
  const compressedBuffer = await response.arrayBuffer();
  const compressedArray = new Uint8Array(compressedBuffer);
  const data = await Bun.gunzipSync(compressedArray);
  const yolmPath = getYolmPath();
  await Bun.write(yolmPath, data, { createPath: true });
  if (!isWindows()) {
    chmodSync(yolmPath, 0o777);
  }
  console.log("Yolm development executable successfully installed.");
}

async function initSystem() {
  const yolmPath = getYolmPath();
  await ensureDir(getYolmDir());
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
    if (isWindows()) {
      const downloadedPath = getDownloadedPath();
      const downloadedFile = Bun.file(downloadedPath);
      if (await downloadedFile.exists()) {
        Bun.write(yolmPath, downloadedFile);
        unlinkSync(downloadedPath);
      }
    }
  }
}

await initSystem();
