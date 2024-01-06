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

export async function runHubFile() {
  const tsPath = path.join(process.cwd(), "system.ts");
  const jsPath = path.join(process.cwd(), "system.js");
  if (fs.existsSync(tsPath)) {
    await import("file:///" + tsPath);
  } else if (fs.existsSync(jsPath)) {
    await import("file:///" + jsPath);
  } else {
    throw new Error("No system.ts or system.js file found");
  }
}

export async function getAppModel() {
  const start = performance.now();
  await runHubFile();
  const { system } = await import("../dist/index");
  const yom = system.generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms",
  );
  return yom;
}

export async function runScriptsFile() {
  const tsPath = path.join(process.cwd(), "scripts.ts");
  const jsPath = path.join(process.cwd(), "scripts.js");
  if (fs.existsSync(tsPath)) {
    await import("file:///" + tsPath);
  } else if (fs.existsSync(jsPath)) {
    await import("file:///" + jsPath);
  } else {
    throw new Error("No scripts.ts or scripts.js file found");
  }
}

export async function getScriptModel() {
  const start = performance.now();
  await runScriptsFile();
  const { system } = await import("../dist/index");
  const yom = system.generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms",
  );
  return yom;
}

export async function runTestTs() {
  const tsPath = path.join(process.cwd(), "test.ts");
  const jsPath = path.join(process.cwd(), "test.js");
  if (fs.existsSync(tsPath)) {
    await import("file:///" + tsPath);
  } else if (fs.existsSync(jsPath)) {
    await import("file:///" + jsPath);
  } else {
    throw new Error("No test.ts or test.js file found");
  }
}

export async function getTestModel() {
  const start = performance.now();
  await runTestTs();
  const { system } = await import("../dist/index");
  const yom = system.generateYom();
  console.log(
    "generating yom took",
    (performance.now() - start).toFixed(2) + "ms",
  );
  return yom;
}

export function writeHubModelToDisk(model) {
  fs.writeFileSync(
    path.join(process.cwd(), "system.json"),
    // JSON.stringify(model, undefined, 2)
    JSON.stringify(model),
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
  const appModel = await getScriptModel();
  writeHubModelToDisk(appModel);
  const config = getAppYolmConfig();
  const cmd = [yolmPath(), "deploy"];
  if (config.deployed) {
    cmd.push("-f");
    cmd.push("true");
  }
  if (config.profile.length > 0) {
    cmd.push("-p");
    cmd.push(config.profile);
  }
  if (majorDbVersion) {
    cmd.push("--major-db-version");
    cmd.push("true");
  }
  const proc = Bun.spawn({
    cmd,
    stdout: "inherit",
    env: process.env,
  })
  const exitCode = await proc.exited
  process.exit(exitCode)
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
