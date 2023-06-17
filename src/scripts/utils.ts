import { homedir } from "os";
import * as path from "path";
import * as fs from "fs";
import { generateYom } from "../generate.js";
import { Model } from "../yom.js";
import { spawn, spawnSync } from "child_process";
import fetch, { Request } from "node-fetch";

export function yolmPath() {
  if (process.env.YOLM_EXECUTABLE_PATH) {
    return process.env.YOLM_EXECUTABLE_PATH;
  }
  return path.join(homedir(), ".yolm", "bin", "yolm");
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function fetchWithTimeout(request: Request, timeOutMs: number) {
  const controller = new AbortController();
  const config = { signal: controller.signal };
  const timeoutId = setTimeout(() => {
    (controller as any).abort();
  }, timeOutMs);
  return fetch(request, config)
    .then((response) => {
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(response.status + ": " + response.statusText);
      }
      return response;
    })
    .catch((error) => {
      if (error.name === "AbortError") {
        throw new Error("Response timed out");
      }
      throw new Error(error.message);
    });
}

export async function getAppModel(): Promise<Model> {
  const start = performance.now();
  const module = await import(path.join(process.cwd(), "app.ts"));
  const app = "app" in module ? module.app : generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms"
  );
  return app;
}

export async function getScriptModel(): Promise<Model> {
  const start = performance.now();
  const module = await import(path.join(process.cwd(), "scripts.ts"));
  const app = "app" in module ? module.app : generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms"
  );
  return app;
}

export function writeAppModelToDisk(model: Model) {
  fs.writeFileSync(
    path.join(process.cwd(), "app.json"),
    JSON.stringify(model, undefined, 2)
  );
}

export function runScript(name: string) {
  spawnSync(yolmPath(), ["script", name], {
    stdio: [process.stdin, process.stdout, process.stderr],
    env: {
      ...process.env,
      RUST_MIN_STACK: "10000000",
      RUST_BACKTRACE: "1",
    },
  });
}

export function getAppYolmConfig() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  if (packageJson.yolm === undefined) {
    return {
      deployed: false,
      profile: "",
    };
  }
  const yolm = packageJson.yolm;
  const deployed = yolm.deployed !== undefined;
  const profile = yolm.profile ?? "";
  return {
    deployed,
    profile,
  };
}

export async function deploy(majorDbVersion: boolean) {
  const appModel = await getAppModel();
  writeAppModelToDisk(appModel);
  const config = getAppYolmConfig();
  const args = ["deploy"];
  if (config.deployed) {
    args.push("-f");
    args.push("true");
  }
  if (config.profile.length > 0) {
    args.push("-p");
    args.push(config.profile);
  }
  if (majorDbVersion) {
    args.push("--major_db_version");
    args.push("true");
  }
  try {
    spawn(yolmPath(), args, {
      detached: false,
      stdio: [process.stdin, process.stdout, process.stderr],
    });
  } catch (e) {
    console.error("Unable to spawn yolm run");
    throw e;
  }
}
