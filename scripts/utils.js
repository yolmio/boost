import { homedir } from "os";
import * as path from "path";
import * as fs from "fs";
import { spawn, spawnSync } from "child_process";

export function yolmPath() {
  if (process.env.YOLM_EXECUTABLE_PATH) {
    return process.env.YOLM_EXECUTABLE_PATH;
  }
  return path.join(homedir(), ".yolm", "bin", "yolm");
}

/**
 * @param {number} ms
 */
export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 *
 * @param {Request} request
 * @param {number} timeOutMs
 * @returns
 */
export function fetchWithTimeout(request, timeOutMs) {
  const controller = new AbortController();
  const config = { signal: controller.signal };
  const timeoutId = setTimeout(() => {
    controller.abort();
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

export async function runAppTs() {
  await import("file:///" + path.join(process.cwd(), "app.ts"));
}

export async function getAppModel() {
  const start = performance.now();
  await runAppTs();
  const { app } = await import("../dist/index");
  const yom = app.generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms"
  );
  return yom;
}

export async function runScriptTs() {
  await import("file:///" + path.join(process.cwd(), "scripts.ts"));
}

export async function getScriptModel() {
  const start = performance.now();
  await runScriptTs();
  const { app } = await import("../dist/index");
  const yom = app.generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms"
  );
  return yom;
}

export function writeAppModelToDisk(model) {
  fs.writeFileSync(
    path.join(process.cwd(), "app.json"),
    JSON.stringify(model, undefined, 2)
  );
}

export function runScript(name) {
  spawnSync(yolmPath(), ["script", name], {
    stdio: "inherit",
    env: {
      ...process.env,
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

export async function deploy(majorDbVersion) {
  process.env.YOLM_BOOST_ENV = "deploy";
  const appModel = await runAppTs();
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

export function createProfiles(profiles) {
  const computedProfile = {
    default: {
      db: "data/dev",
      ...profiles.default,
    },
  };
  for (const [name, profile] of Object.entries(profiles)) {
    if (name === "default") {
      continue;
    }
    computedProfile[name] = {
      db: "data/dev",
      ...profile,
    };
  }
  return computedProfile;
}
